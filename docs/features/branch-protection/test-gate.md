name: Test Gate

# Test Gate: PR from build/{ref} OR task/{ref} -> uat
# Validates inbound commits differently depending on origin branch, then
# applies a shared quality bar (full test pass + coverage thresholds).
# Human approval and human override of failing validation are configured in
# branch protection, not here — see the notes at the bottom of this file.

on:
  pull_request:
    branches:
      - uat

concurrency:
  group: test-gate-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  validate-test-gate:
    if: startsWith(github.head_ref, 'build/') || startsWith(github.head_ref, 'task/')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR head (full history)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Determine origin path and {ref}
        id: origin
        run: |
          HEAD_REF="${{ github.head_ref }}"

          if [[ "$HEAD_REF" == build/* ]]; then
            PATH_TYPE="build"
            REF="${HEAD_REF#build/}"
          else
            PATH_TYPE="task"
            REF="${HEAD_REF#task/}"
          fi

          if [ -z "$REF" ]; then
            echo "::error::Could not derive {ref} from head branch '$HEAD_REF'"
            exit 1
          fi

          echo "path_type=$PATH_TYPE" >> "$GITHUB_OUTPUT"
          echo "ref=$REF" >> "$GITHUB_OUTPUT"
          echo "Path: $PATH_TYPE, ref: $REF"

      - name: Identify inbound commits
        id: commits
        env:
          PATH_TYPE: ${{ steps.origin.outputs.path_type }}
        run: |
          BASE_SHA="${{ github.event.pull_request.base.sha }}"
          HEAD_SHA="${{ github.event.pull_request.head.sha }}"
          COMMITS=$(git rev-list --reverse "$BASE_SHA".."$HEAD_SHA")
          COUNT=$(printf '%s\n' "$COMMITS" | grep -c . || true)

          if [ "$PATH_TYPE" = "build" ]; then
            EXPECTED=3
          else
            EXPECTED=1
          fi

          if [ "$COUNT" -ne "$EXPECTED" ]; then
            echo "::error::Expected exactly $EXPECTED inbound commit(s) for the $PATH_TYPE path, found $COUNT"
            exit 1
          fi

          i=1
          while IFS= read -r sha; do
            echo "commit_${i}=$sha" >> "$GITHUB_OUTPUT"
            echo "Commit $i: $sha"
            i=$((i + 1))
          done <<< "$COMMITS"

      - name: Validate build/{ref} path — commit 1 (specification)
        if: steps.origin.outputs.path_type == 'build'
        env:
          REF: ${{ steps.origin.outputs.ref }}
          SHA: ${{ steps.commits.outputs.commit_1 }}
        run: |
          MSG=$(git log -1 --format=%s "$SHA")
          echo "Message: $MSG"

          if ! printf '%s' "$MSG" | grep -Eq "^$REF"; then
            echo "::error::Commit 1 message must start with $REF"; exit 1
          fi
          DESC=$(printf '%s' "$MSG" | sed -E "s/^$REF[[:space:]:]*//")
          if [ -z "$DESC" ]; then
            echo "::error::Commit 1 message has no description"; exit 1
          fi

          CHANGED=$(git diff-tree --no-commit-id --name-only -r "$SHA")
          BAD=$(printf '%s\n' "$CHANGED" | grep -v "^docs/tasks/task-$REF/" || true)
          if [ -n "$BAD" ]; then
            echo "::error::Commit 1 touches files outside docs/tasks/task-$REF/:"
            echo "$BAD"; exit 1
          fi

          if [ ! -f "docs/tasks/task-$REF/task-$REF.md" ]; then
            echo "::error::Missing docs/tasks/task-$REF/task-$REF.md"; exit 1
          fi
          if [ ! -f "docs/tasks/task-$REF/task-$REF-spec.md" ]; then
            echo "::error::Missing docs/tasks/task-$REF/task-$REF-spec.md"; exit 1
          fi

          echo "✅ Commit 1 (specification) valid"

      - name: Validate build/{ref} path — commit 2 (test)
        if: steps.origin.outputs.path_type == 'build'
        env:
          REF: ${{ steps.origin.outputs.ref }}
          PREV_SHA: ${{ steps.commits.outputs.commit_1 }}
          SHA: ${{ steps.commits.outputs.commit_2 }}
        run: |
          MSG=$(git log -1 --format=%s "$SHA")
          echo "Message: $MSG"

          if ! printf '%s' "$MSG" | grep -Eq "^$REF"; then
            echo "::error::Commit 2 message must start with $REF"; exit 1
          fi
          DESC=$(printf '%s' "$MSG" | sed -E "s/^$REF[[:space:]:]*//")
          if [ -z "$DESC" ]; then
            echo "::error::Commit 2 message has no description"; exit 1
          fi

          CHANGED=$(git diff-tree --no-commit-id --name-only -r "$SHA")
          BAD=$(printf '%s\n' "$CHANGED" | grep -v "^test/" || true)
          if [ -n "$BAD" ]; then
            echo "::error::Commit 2 touches files outside /test:"
            echo "$BAD"; exit 1
          fi

          MODIFIED=$(git diff --diff-filter=M --name-only "$PREV_SHA" "$SHA" -- test)
          DELETED=$(git diff --diff-filter=D --name-only "$PREV_SHA" "$SHA" -- test)
          ADDED=$(git diff --diff-filter=A --name-only "$PREV_SHA" "$SHA" -- test)

          if [ -n "$MODIFIED" ]; then
            echo "::error::Existing test files were modified:"; echo "$MODIFIED"; exit 1
          fi
          if [ -n "$DELETED" ]; then
            echo "::error::Existing test files were deleted:"; echo "$DELETED"; exit 1
          fi
          if [ -z "$ADDED" ]; then
            echo "::error::No new test files found under /test"; exit 1
          fi

          echo "✅ Commit 2 (test) valid"

      - name: Validate build/{ref} path — commit 3 (build)
        if: steps.origin.outputs.path_type == 'build'
        env:
          REF: ${{ steps.origin.outputs.ref }}
          SHA: ${{ steps.commits.outputs.commit_3 }}
        run: |
          MSG=$(git log -1 --format=%s "$SHA")
          echo "Message: $MSG"

          if ! printf '%s' "$MSG" | grep -Eq "^$REF"; then
            echo "::error::Commit 3 message must start with $REF"; exit 1
          fi
          DESC=$(printf '%s' "$MSG" | sed -E "s/^$REF[[:space:]:]*//")
          if [ -z "$DESC" ]; then
            echo "::error::Commit 3 message has no description"; exit 1
          fi

          CHANGED=$(git diff-tree --no-commit-id --name-only -r "$SHA")
          BAD=$(printf '%s\n' "$CHANGED" | grep -v "^src/" || true)
          if [ -n "$BAD" ]; then
            echo "::error::Commit 3 touches files outside /src:"
            echo "$BAD"; exit 1
          fi

          echo "✅ Commit 3 (build) valid"

      - name: Validate task/{ref} path — single commit
        if: steps.origin.outputs.path_type == 'task'
        env:
          REF: ${{ steps.origin.outputs.ref }}
          SHA: ${{ steps.commits.outputs.commit_1 }}
        run: |
          MSG=$(git log -1 --format=%s "$SHA")
          echo "Message: $MSG"

          if ! printf '%s' "$MSG" | grep -Eq "^$REF"; then
            echo "::error::Commit message must start with $REF"; exit 1
          fi
          DESC=$(printf '%s' "$MSG" | sed -E "s/^$REF[[:space:]:]*//")
          if [ -z "$DESC" ]; then
            echo "::error::Commit message has no description"; exit 1
          fi

          echo "✅ task/{ref} commit valid"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: All tests must pass
        run: pnpm test

      - name: Run coverage
        run: pnpm test -- --coverage

      - name: Check overall coverage >= 85%
        run: |
          PCT=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
          echo "Overall line coverage: $PCT%"
          awk -v pct="$PCT" 'BEGIN { exit !(pct >= 85) }' \
            || { echo "::error::Overall coverage $PCT% is below the required 85%"; exit 1; }

      - name: Check new/changed-line coverage >= 95%
        run: |
          git fetch origin main --depth=1
          pip install --quiet diff-cover
          diff-cover coverage/lcov.info \
            --compare-branch=origin/main \
            --fail-under=95

# ---------------------------------------------------------------------------
# Configure alongside this workflow, in GitHub repo settings:
#
# 1. Branch protection on uat (Settings → Branches):
#    - Require a pull request before merging, from build/** or task/** only
#    - Require status checks: select "Test Gate / validate-test-gate" once
#      it has run once
#    - Require approvals (>=1) — the "requires human approval" rule
#    - Allow specified actors to bypass required status checks — grants the
#      "human override of failing validation" this gate calls for
#
# 2. This assumes:
#    - pnpm test runs the full suite and exits non-zero on any failure
#    - pnpm test -- --coverage produces coverage/coverage-summary.json
#      (istanbul/nyc-style) and coverage/lcov.info
#    - diff-cover (Python) is available for new/changed-line coverage against
#      origin/main as the comparison point — adjust the comparison branch if
#      build/{ref}/task/{ref} diverge from main differently in practice
#    Adjust the coverage steps if the actual test/coverage tooling differs.
# ---------------------------------------------------------------------------
