# Main Gate — GitHub Actions Workflow

## Purpose
The Main Gate validates and blocks PRs from `uat` into `origin/main` (the
production branch) until all mechanical checks pass *and* a human architect
approves the merge. It is the final automated checkpoint before production
deployment.

---

## Trigger

```yaml
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
    branches:
      - main
```

- **Target branch:** `main`
- **Source branch:** `uat` (enforced by branch protection / required source
  branch rules)
- **Why `pull_request_target`:** allows the workflow to check out the target
  branch's commit (which the PR author can't modify) for trustworthy validation
  of commit structure, while still running for PRs from `uat`.

---

## Validation Checks (in order)

| # | Check | Implementation | Fail behaviour |
|---|---|---|---|
| 1 | **Single inbound commit** | `git log --oneline origin/main..HEAD` — assert exactly 1 commit | Comment on PR: "Expected 1 commit, found N. Main Gate requires a single squashed commit from uat." |
| 2 | **Commit title starts with `{ref}`** | `git log --format=%s -1` — match `^[A-Z]+-\d+` | Comment on PR: "Commit title must start with a task reference (e.g. `MAG-123: ...`)." |
| 3 | **Commit message has a description** | `git log --format=%b -1` — assert non-empty body | Comment on PR: "Commit message must include a description of the change." |
| 4 | **Ref is consistent with PR title** | Extract `{ref}` from commit title; assert PR title also contains the same `{ref}` | Comment on PR: "PR title must reference the same task ref as the commit." |
| 5 | **Task doc exists** | Check `git ls-tree -r HEAD --name-only` for `docs/tasks/task-{ref}/task-{ref}.md` | Comment on PR: "Required task doc `/docs/tasks/task-{ref}/task-{ref}.md` not found." |
| 6 | **All tests pass** | `pnpm test` (or the project's test script) — exit code 0, all suites green | Comment on PR with failed test output. |

---

## Approval Gate

All 6 checks above must pass. The PR also requires **at least 1 human
reviewer's approval** (configured in GitHub branch protection rules on `main`).

The workflow adds a required status check `main-gate` that is:
- `success` — all 6 checks pass
- `failure` — any check fails, blocking merge

Human override of a failed check is available only to the repository
administrator (architect) via GitHub's "override required checks" feature.

---

## Workflow File Location

```
magpie-weaver/.github/workflows/main-gate.yml
```

---

## Environment & Secrets

| Name | Source | Purpose |
|---|---|---|
| `NODE_VERSION` | `vars.NODE_VERSION` or hardcoded `22` | Node version for test runner |
| `ACTIONS_STEP_DEBUG` | `secrets.ACTIONS_STEP_DEBUG` | Optional debug logging |

No deploy credentials are needed — this gate is **validation only**.

---

## Example Workflow Skeleton

```yaml
name: Main Gate

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
    branches: [main]

concurrency:
  group: main-gate-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Check commit count
        run: |
          COUNT=$(git log --oneline origin/main..HEAD | wc -l)
          if [ "$COUNT" -ne 1 ]; then
            echo "Expected 1 commit, found $COUNT"
            exit 1
          fi

      - name: Extract ref from commit title
        id: ref
        run: |
          TITLE=$(git log --format=%s -1)
          if [[ ! "$TITLE" =~ ^([A-Z]+-[0-9]+) ]]; then
            echo "Commit title does not start with a task ref"
            exit 1
          fi
          echo "value=${BASH_REMATCH[1]}" >> "$GITHUB_OUTPUT"

      - name: Check commit has description
        run: |
          BODY=$(git log --format=%b -1)
          if [ -z "$BODY" ]; then
            echo "Commit message has no description"
            exit 1
          fi

      - name: Check PR title matches ref
        env:
          REF: ${{ steps.ref.outputs.value }}
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: |
          if [[ ! "$PR_TITLE" =~ $REF ]]; then
            echo "PR title does not reference $REF"
            exit 1
          fi

      - name: Check task doc exists
        env:
          REF: ${{ steps.ref.outputs.value }}
        run: |
          PATH="docs/tasks/task-${REF}/task-${REF}.md"
          if ! git ls-tree -r HEAD --name-only | grep -Fx "$PATH"; then
            echo "Required file $PATH not found"
            exit 1
          fi

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run tests
        id: tests
        run: pnpm test

      - name: Post failure comment
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Main Gate failed

See [workflow run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}) for details.

Required checks:
- [ ] Single squashed commit
- [ ] Commit title starts with task ref
- [ ] Commit has a description
- [ ] PR title matches commit ref
- [ ] Task doc exists
- [ ] All tests pass
`
            })

      - name: Post success comment
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            const comments = await github.rest.issues.listComments({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
            });
            const botComments = comments.data.filter(c =>
              c.user.type === 'Bot' && c.body?.startsWith('## Main Gate')
            );
            for (const c of botComments) {
              await github.rest.issues.deleteComment({
                comment_id: c.id,
                owner: context.repo.owner,
                repo: context.repo.repo,
              });
            }
```

---

## Dependencies

- GitHub branch protection on `main` requiring:
  - `main-gate` status check to pass
  - At least 1 approving review
  - Restrict PR source branches to `uat`
- `pnpm` setup action in the workflow
- GitHub token with `contents: read` and `pull-requests: write` permissions

---

## Related Workflows

- **Deploy Prod Action** — triggered on `push` to `main` (after Main Gate
  merge); deploys the production environment. Defined separately.

---

## References

- Architecture Definition Document — "Main Gate" § under Gates And Actions
- ADR-021 (GitHub Actions as CI/CD Provider)
- HLD §11.3 (Mechanical Checks)
- Branching strategy diagram in the architecture document
