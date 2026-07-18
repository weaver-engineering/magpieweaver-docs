name: Build Gate

# Build Gate: PR from test/{ref} -> build/{ref}
# Validates the 2 inbound commits (specification-commit, test-commit).
# Human approval (required reviewers) and human override (admin bypass of a
# failing required check) are configured in branch protection, not here —
# see the notes at the bottom of this file.

on:
  pull_request:
    branches:
      - 'build/**'

concurrency:
  group: build-gate-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  validate-build-gate:
    if: startsWith(github.head_ref, 'test/')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR head (full history)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Derive {ref} and verify branch pairing
        id: ref
        run: |
          HEAD_REF="${{ github.head_ref }}"
          BASE_REF="${{ github.event.pull_request.base.ref }}"
          REF="${HEAD_REF#test/}"

          if [ -z "$REF" ] || [ "$REF" = "$HEAD_REF" ]; then
            echo "::error::Could not derive {ref} from head branch '$HEAD_REF' (expected test/{ref})"
            exit 1
          fi

          if [ "$BASE_REF" != "build/$REF" ]; then
            echo "::error::Base branch '$BASE_REF' does not match expected 'build/$REF' for head 'test/$REF'"
            exit 1
          fi

          echo "ref=$REF" >> "$GITHUB_OUTPUT"
          echo "Derived ref: $REF"

      - name: Identify the 2 inbound commits
        id: commits
        run: |
          BASE_SHA="${{ github.event.pull_request.base.sha }}"
          HEAD_SHA="${{ github.event.pull_request.head.sha }}"
          COMMITS=$(git rev-list --reverse "$BASE_SHA".."$HEAD_SHA")
          COUNT=$(printf '%s\n' "$COMMITS" | grep -c . || true)

          if [ "$COUNT" -ne 2 ]; then
            echo "::error::Expected exactly 2 inbound commits, found $COUNT"
            exit 1
          fi

          SPEC_SHA=$(printf '%s\n' "$COMMITS" | sed -n '1p')
          TEST_SHA=$(printf '%s\n' "$COMMITS" | sed -n '2p')

          echo "spec_sha=$SPEC_SHA" >> "$GITHUB_OUTPUT"
          echo "test_sha=$TEST_SHA" >> "$GITHUB_OUTPUT"
          echo "Specification commit: $SPEC_SHA"
          echo "Test commit: $TEST_SHA"

      - name: Validate specification-commit
        env:
          REF: ${{ steps.ref.outputs.ref }}
          SPEC_SHA: ${{ steps.commits.outputs.spec_sha }}
        run: |
          MSG=$(git log -1 --format=%s "$SPEC_SHA")
          echo "Specification commit message: $MSG"

          if ! printf '%s' "$MSG" | grep -Eq "^\[$REF\]"; then
            echo "::error::Specification commit message must start with [$REF]"
            exit 1
          fi

          DESC=$(printf '%s' "$MSG" | sed -E "s/^\[$REF\][[:space:]:]*//")
          if [ -z "$DESC" ]; then
            echo "::error::Specification commit message has no description after [$REF]"
            exit 1
          fi

          CHANGED=$(git diff-tree --no-commit-id --name-only -r "$SPEC_SHA")
          echo "Changed files:"; echo "$CHANGED"

          BAD=$(printf '%s\n' "$CHANGED" | grep -v "^docs/tasks/task-$REF/" || true)
          if [ -n "$BAD" ]; then
            echo "::error::Specification commit touches files outside docs/tasks/task-$REF/:"
            echo "$BAD"
            exit 1
          fi

          if [ ! -f "docs/tasks/task-$REF/task-$REF.md" ]; then
            echo "::error::Missing docs/tasks/task-$REF/task-$REF.md"
            exit 1
          fi
          if [ ! -f "docs/tasks/task-$REF/task-$REF-spec.md" ]; then
            echo "::error::Missing docs/tasks/task-$REF/task-$REF-spec.md"
            exit 1
          fi

          echo "✅ Specification commit valid"

      - name: Validate test-commit (structure)
        id: test_commit
        env:
          REF: ${{ steps.ref.outputs.ref }}
          SPEC_SHA: ${{ steps.commits.outputs.spec_sha }}
          TEST_SHA: ${{ steps.commits.outputs.test_sha }}
        run: |
          MSG=$(git log -1 --format=%s "$TEST_SHA")
          echo "Test commit message: $MSG"

          if ! printf '%s' "$MSG" | grep -Eq "^$REF"; then
            echo "::error::Test commit message must start with $REF"
            exit 1
          fi

          DESC=$(printf '%s' "$MSG" | sed -E "s/^$REF[[:space:]:]*//")
          if [ -z "$DESC" ]; then
            echo "::error::Test commit message has no description after $REF"
            exit 1
          fi

          CHANGED=$(git diff-tree --no-commit-id --name-only -r "$TEST_SHA")
          echo "Changed files:"; echo "$CHANGED"

          BAD=$(printf '%s\n' "$CHANGED" | grep -v "^test/" || true)
          if [ -n "$BAD" ]; then
            echo "::error::Test commit touches files outside /test:"
            echo "$BAD"
            exit 1
          fi

          ADDED=$(git diff --diff-filter=A --name-only "$SPEC_SHA" "$TEST_SHA" -- test)
          MODIFIED=$(git diff --diff-filter=M --name-only "$SPEC_SHA" "$TEST_SHA" -- test)
          DELETED=$(git diff --diff-filter=D --name-only "$SPEC_SHA" "$TEST_SHA" -- test)

          if [ -n "$MODIFIED" ]; then
            echo "::error::Existing test files were modified (not permitted):"
            echo "$MODIFIED"
            exit 1
          fi
          if [ -n "$DELETED" ]; then
            echo "::error::Existing test files were deleted (not permitted):"
            echo "$DELETED"
            exit 1
          fi
          if [ -z "$ADDED" ]; then
            echo "::error::No new test files found under /test"
            exit 1
          fi

          echo "Added test files:"; echo "$ADDED"
          {
            echo "new_test_files<<EOF"
            echo "$ADDED"
            echo "EOF"
          } >> "$GITHUB_OUTPUT"

          echo "✅ Test commit structurally valid"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Existing tests must still pass
        env:
          SPEC_SHA: ${{ steps.commits.outputs.spec_sha }}
        run: |
          EXISTING=$(git ls-tree -r --name-only "$SPEC_SHA" -- test)
          if [ -z "$EXISTING" ]; then
            echo "No pre-existing tests; skipping."
          else
            pnpm test -- $EXISTING
          fi

      - name: At least 1 new test must fail (no implementation yet)
        env:
          NEW_TESTS: ${{ steps.test_commit.outputs.new_test_files }}
        run: |
          set +e
          pnpm test -- $NEW_TESTS
          RESULT=$?
          set -e
          if [ "$RESULT" -eq 0 ]; then
            echo "::error::New test(s) passed with no implementation present — they must fail until the build phase implements a solution."
            exit 1
          fi
          echo "✅ New test(s) fail as expected"

# ---------------------------------------------------------------------------
# Configure alongside this workflow, in GitHub repo settings (not expressible
# in the workflow file itself):
#
# 1. Branch protection on build/** (Settings → Branches):
#    - Require a pull request before merging
#    - Require status checks to pass: select
#      "Build Gate / validate-build-gate" once it has run once
#    - Require approvals (>=1) — this is the "requires human approval" rule
#    - Allow specified actors to bypass required status checks — grants the
#      architect the ability to perform the "human override of failing
#      validation" the Build Gate spec calls for
#
# 2. origin/test/** and origin/build/** should reject direct pushes from
#    remotes and only accept PRs from spec/{ref} and test/{ref} respectively,
#    per the branching rules — enforce via branch protection rules scoped to
#    those patterns (restrict who can push directly to none).
#
# 3. This assumes a pnpm-based test runner that accepts file paths as
#    positional arguments (e.g. `pnpm test -- path/to/file.test.ts`, as with
#    vitest/jest). Adjust the two test-running steps if the actual test
#    command differs.
# ---------------------------------------------------------------------------
