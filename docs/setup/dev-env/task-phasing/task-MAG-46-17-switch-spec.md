# Task MAG-46 - `task <ref>` switches to another task's canonical branch

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/task/switch.test.ts` — note the
directory is `task/`, matching `commands/task.ts`'s actual filename, not
`ref/` (the CLI command name). See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task <ref> [--wip [title] [message]] [--json]` (§3.13), against
injected `git` test doubles. Reuses the ref-derivation pipeline already
proven (MAG-46-04 onward) and the WIP-commit logic already proven
(MAG-46-07).

## 2. Deliverable
`<ref>` derives `<ref>`'s current canonical branch and checks it out,
optionally committing WIP on the branch being left first when `--wip` is
given.

### 2.1 Deliverable Notes For Agent
- **The canonical branch to switch to comes from `lib/repo-state.ts`'s
  `deriveRepoState()`** (LLD §4.5) — the same derivation `status`/`list`/
  `promote` all use, not a fresh lookup built for this command.
- The ref-matching regex (`/^[A-Z]+-[0-9]+$/`, §2's `TaskRef`) is what lets
  `cli.ts`/`registry.ts` tell `pnpm task AAA-234` apart from a genuine
  subcommand name — assert an input that looks like a subcommand
  (`status`, `list`, etc.) is **not** misrouted here, and vice versa.
- Without `--wip`, switching branches under uncommitted changes is allowed
  to proceed and can fail on a real merge conflict (§2's `--wip` flag
  description) — that failure is an ordinary `git checkout` conflict, not
  bespoke logic this chunk needs to build; just don't block it.

## 3. Required Behaviors
* `<ref>` checks out the derived canonical branch for that ref.
* `--wip [title] [message]` commits work in progress on the current branch
  before switching.
* A bare subcommand name is never misinterpreted as a ref, and vice versa.
* Without `--wip`, a switch that hits a real merge conflict surfaces that
  conflict rather than silently discarding it or the uncommitted changes.

### 3.1 Switches to another task's canonical branch
* Given
  * `git.currentBranch()` returns `"task/AAA-123"`
  * `AAA-234`'s derived canonical branch is `"test/AAA-234"`
  * `git.isDirty()` returns `false`
* When - `pnpm task AAA-234`
* Then -
  * `git.checkout("test/AAA-234")` was called
  * `RefCommandResult.switchedFrom` is `"task/AAA-123"`
  * `RefCommandResult.switchedTo` is `"test/AAA-234"`
  * Exit code 0

### 3.2 --wip commits before switching
* Given
  * As §3.1, except `git.isDirty()` returns `true`
  * `git.commitAll(...)` resolves a SHA
* When - `pnpm task AAA-234 --wip "pausing here"`
* Then -
  * `git.commitAll` was called before `git.checkout`
  * `RefCommandResult.wipCommitSha` equals the SHA `commitAll` resolved to
  * `git.checkout("test/AAA-234")` was still called afterward
  * Exit code 0

### 3.3 Subcommand names are never treated as a ref
* When - `pnpm task status`
* Then - `status`'s own handler runs, not the `<ref>` switch path (no
  attempt is made to derive a canonical branch for a ref literally named
  `"status"`)

### 3.4 An invalid ref format is rejected before dispatch
* When - `pnpm task not-a-valid-ref`
* Then -
  * `git.checkout(...)` was **not** called
  * Exit code 2 (invalid argument — `TaskRef`'s
    `/^[A-Z]+-[0-9]+$/` pattern rejects it before any command logic runs)

### 3.5 Without --wip, a real checkout conflict is surfaced, not swallowed
* Given
  * `git.currentBranch()` returns `"task/AAA-123"`
  * `AAA-234`'s derived canonical branch is `"test/AAA-234"`
  * `git.isDirty()` returns `true`
  * No `--wip` is given
  * `git.checkout("test/AAA-234")` rejects with a real merge-conflict error
    (uncommitted changes on `task/AAA-123` collide with `test/AAA-234`'s
    content)
* When - `pnpm task AAA-234`
* Then -
  * `git.commitAll(...)` was **not** called (no `--wip` given)
  * The real conflict error is surfaced in the output, not swallowed or
    reworded into a generic failure
  * `RefCommandResult.switchedTo` is **not** reported as `"test/AAA-234"`
    (the switch did not actually complete)
  * Exit code 1
