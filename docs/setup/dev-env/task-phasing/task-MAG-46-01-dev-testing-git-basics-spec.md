# Task MAG-46 - dev-testing entry point + real git primitives

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/deps/git-basics.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`cli.ts`'s new `--dev-testing <tool> <method> [--args-file <path> | -i]`
dispatch path (grammar fixed in `task-MAG-46-dev-testing-cli-design.md`),
and the subset of `GitTool` (§2/§4.8 of `task-phasing-lld.md`) it
exercises for real in this chunk: `fetch`, `currentBranch`,
`branchExists`, `headSha`, `createBranch`, `checkout`, `commitAll`, `push`.

`--dev-testing` bypasses `registry.ts`'s normal command dispatch entirely.
Instead of routing to a `commands/*.ts` handler with a mocked `ExternalTools`,
it calls exactly one method on exactly one *real* tool instance directly,
prints its return value, and exits. This exists because these wrapper
methods have no system-level behavior reachable through any ordinary
command — their only observable contract is "did the real git/gh/fs/
gate-check call actually do what we think it does," which can only be
asserted by actually running it against a real repository.

## 2. Deliverable
`pnpm task --dev-testing git <method> [-i | --args-file <path>] [--json]`
— a working CLI entry point that resolves `<method>` to the corresponding
`GitTool` method, invokes it with the JSON-object arguments (per the
design doc) against the real local checkout, and reports the result or
the thrown error.

### 2.1 Deliverable Notes For Agent
- This chunk does **not** implement `commands/*.ts`, `registry.ts`'s normal
  dispatch, or any phase-derivation logic. `--dev-testing` is parsed in
  `cli.ts` ahead of normal dispatch and short-circuits to the tool call.
- Each behavior below needs a real git repository fixture, not a mock —
  state it explicitly in the Given (branch names, existing commits) so the
  test can actually construct that repository before invoking the CLI.
- `--json` on `--dev-testing` wraps the return value / thrown error the
  same way `cli.ts` already does for ordinary commands (§4.1) — reuse that
  serialization, don't build a second one.
- All example invocations below use the `-i` stdin form for readability;
  `--args-file <path>` is equivalent and interchangeable per the design
  doc — don't treat the choice of source as behavior worth testing twice.

## 3. Required Behaviors
* Resolves `<tool> <method>` to a real method call and reports its result.
* Surfaces thrown errors as a failed result rather than crashing the process.
* Rejects an unknown tool or method name as an invalid-argument (exit 2).
* Exercises `fetch`, `currentBranch`, `branchExists`, `headSha`,
  `createBranch`, `checkout`, `commitAll`, `push` against a real repo.
* Resolves the target repository relative to `cwd`, never relative to
  wherever `task-phases` itself is installed.

### 3.1 Read-only Primitives
#### 3.1.1 fetch
* Given
  * A local clone with a valid `origin` remote
  * The remote has a commit not yet present locally
* When - `pnpm task --dev-testing git fetch` (no args — `fetch()` takes
  none)
* Then -
  * The command exits 0
  * `origin/main` (or equivalent tracking ref) now includes the new commit

#### 3.1.2 currentBranch
* Given
  * The repository has `test/AAA-001` checked out
* When - `pnpm task --dev-testing git currentBranch` (no args)
* Then -
  * The reported value is exactly `test/AAA-001`

#### 3.1.3 branchExists — local and remote
* Given
  * `spec/AAA-002` exists locally but has never been pushed
* When -
  ```bash
  pnpm task --dev-testing git branchExists -i << EOF
  {"branch": "spec/AAA-002"}
  EOF
  ```
* Then - the reported value is `true`
* When -
  ```bash
  pnpm task --dev-testing git branchExists -i << EOF
  {"branch": "spec/AAA-002", "opts": {"remote": true}}
  EOF
  ```
* Then - the reported value is `false`

#### 3.1.4 headSha
* Given
  * `build/AAA-003` exists with a known commit at its tip
* When -
  ```bash
  pnpm task --dev-testing git headSha -i << EOF
  {"branch": "build/AAA-003"}
  EOF
  ```
* Then -
  * The reported value equals that commit's real SHA (`git rev-parse
    build/AAA-003` independently confirms it)

### 3.2 Mutating Primitives
#### 3.2.1 createBranch does not push
* Given
  * `spec/AAA-004` exists and is checked out
  * `test/AAA-004` does not exist locally or on `origin`
* When -
  ```bash
  pnpm task --dev-testing git createBranch -i << EOF
  {"newBranch": "test/AAA-004", "fromRef": "spec/AAA-004"}
  EOF
  ```
* Then -
  * `test/AAA-004` now exists locally and is checked out
  * `test/AAA-004` does **not** exist on `origin`

#### 3.2.2 checkout an existing branch
* Given
  * `main` is checked out
  * `test/AAA-004` exists locally (from §3.2.1)
* When -
  ```bash
  pnpm task --dev-testing git checkout -i << EOF
  {"branch": "test/AAA-004"}
  EOF
  ```
* Then - the repository's current branch is `test/AAA-004`

#### 3.2.3 commitAll stages and commits everything, returns the SHA
* Given
  * `test/AAA-004` is checked out
  * A tracked file has an unstaged modification and a new untracked file
    exists
* When -
  ```bash
  pnpm task --dev-testing git commitAll -i << EOF
  {"title": "AAA-004 WIP", "message": "note"}
  EOF
  ```
* Then -
  * Both the modification and the new file are committed
  * The worktree is clean afterward
  * The reported value is the new commit's real SHA

#### 3.2.4 push publishes a local branch
* Given
  * `test/AAA-004` exists locally with the commit from §3.2.3
  * `test/AAA-004` does not yet exist on `origin`
* When -
  ```bash
  pnpm task --dev-testing git push -i << EOF
  {"branch": "test/AAA-004"}
  EOF
  ```
* Then - `origin/test/AAA-004` now exists and matches the local branch's SHA

### 3.2.5 Working-directory resolution — operates on cwd's repo, not task-phases's own
Per the design doc's §6 (never relative to where `task-phases` itself is
installed).
* Given
  * A fixture "sandbox" repo exists at a path entirely separate from
    wherever `task-phases`'s own source lives, with `sandbox-branch`
    checked out
  * The test process `cd`s into that sandbox path before invoking the CLI
* When - `pnpm task --dev-testing git currentBranch` (invoked with the
  sandbox as `cwd`)
* Then -
  * The reported value is `"sandbox-branch"` — the sandbox's own checked-
    out branch, not whatever's checked out in `task-phases`'s own working
    tree
* Given - the same sandbox, but a second fixture repo also exists with a
  different branch checked out
* When - the same command is invoked with `cwd` set to the *second* fixture
  instead
* Then - the reported value reflects the second fixture's branch, not the
  first — confirming resolution follows `cwd` on each invocation rather
  than caching or defaulting to whichever repo was resolved first

### 3.3 Error Handling
#### 3.3.1 Unknown tool
* When - `pnpm task --dev-testing frobnicate currentBranch`
* Then -
  * A message states `frobnicate` is not a recognised `--dev-testing` tool
  * Exit code 2

#### 3.3.2 Unknown method on a known tool
* When - `pnpm task --dev-testing git doesNotExist`
* Then -
  * A message states `doesNotExist` is not a method on `git`
  * Exit code 2

#### 3.3.3 Malformed JSON args is rejected before any git call
* When -
  ```bash
  pnpm task --dev-testing git headSha -i << EOF
  {not valid json
  EOF
  ```
* Then -
  * No git call was made
  * Exit code 2 (invalid argument, per the design doc's §5 exit-code
    table — not the same as a real git failure below)

#### 3.3.4 A real git failure is reported, not thrown uncaught
* Given
  * `does-not-exist` is not a valid ref in the repository
* When -
  ```bash
  pnpm task --dev-testing git headSha -i << EOF
  {"branch": "does-not-exist"}
  EOF
  ```
* Then -
  * The process exits nonzero (1)
  * The underlying git error message is surfaced in the output, not an
    unhandled stack trace
