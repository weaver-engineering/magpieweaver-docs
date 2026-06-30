# E1-S3-T1 — Contributing Guidelines

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S3-T1`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S3`](E1-S3-git-governance.md) / `E1`                    |
| Output(s)    | `magpie-weaver/CONTRIBUTING.md`                               |
| Depends on   | `E1-S2`                                                       |
| Branch       | `feature/E1-S3-T1`                                            |
| Status       | Proposed                                                      |
| PRs          | —                                                             |

## Purpose

Codify a clear branching and commit standard for engineers building the
`magpie-weaver` platform, ensuring a deterministic code integration workflow
for both human contributors and AI agents.

## Steps

1. Create `CONTRIBUTING.md` at the repository root.
2. Document the semantic branch prefix layout:
   - `feat/` — new product features.
   - `fix/` — bug fixes.
   - `docs/` — documentation-only changes.
   - `ops/` — infrastructure, CI/CD, and tooling.
   - Each branch name must include a tracking issue ID (e.g.
     `feat/MW-102_tauri-ipc-bridge`).
3. Define the commit message syntax using Conventional Commits:
   - Format: `<type>(<scope>): <description>` (e.g.
     `feat(filestore): implement local native file system writer`).
   - List permitted types: `feat`, `fix`, `docs`, `ops`, `chore`, `test`.
4. Include concrete examples of passing and failing branch names and commit
   messages.
5. Update this task file and the register to Done with PR link.
6. Raise the implementation PR.

## Acceptance criteria

- `CONTRIBUTING.md` is committed at the repository root.
- Contains concrete passing vs. failing branch name and commit message examples.
- Branch prefix layout and commit syntax are unambiguous and cover all
  categories needed for platform development.

## Measure of done

`CONTRIBUTING.md` is merged with the author's approval.

## Estimated duration

Two hours (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (documentation file). Depends on `E1-S2`
being Done (repository and directory structure must exist before contributing
docs are committed).

Branch naming conventions here are for the `magpie-weaver` implementation repo
and may differ from the `magpie-weaver-docs` ways-of-working conventions
(`feature/`, `setup/`, `planning/`, etc.). Confirm alignment with the project's
overall convention before starting — see the open question in
[`docs/research/e1-sub-plan.md`](../../../../../research/e1-sub-plan.md) under
"Our stance".
