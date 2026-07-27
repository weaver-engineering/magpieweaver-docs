# Task MAG-46 - `task list` aggregates every active ref

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/list/active-tasks.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task list [--json]` (§3.10), running the full derivation pipeline
proven by MAG-46-04 through MAG-46-15 across every branch matching
`*/{ref}`, grouped by ref — against injected `git`/`github` test doubles.

## 2. Deliverable
`list` enumerates every distinct `{ref}` with an active branch, derives
each one's `TaskStatus` using the same pipeline `status` uses (never
resolving `ready?` — no `--check` equivalent, per §3.14), and marks which
entry is the currently checked-out task.

### 2.1 Deliverable Notes For Agent
- `list` must **never** call `gateChecks.run` — assert this explicitly,
  since it's the one thing that would make its cost scale badly with the
  number of active refs (§3.14's open question, deliberately left
  undecided, not silently resolved by this chunk).
- Grouping by ref means a task with `spec/AAA-001` present should appear
  once, not once per matching branch pattern — cover a ref with only one
  phase branch existing, not multiples, to keep this chunk's fixture
  simple; multi-branch-per-ref grouping is implied by MAG-46-06 onward's
  derivation already being ref-scoped, not new logic here.
- `list` reuses whatever ref-derivation function `status` already calls
  per ref — this chunk should not duplicate that logic.

## 3. Required Behaviors
* Lists every ref with an active branch, each with its derived phase/state.
* Marks the currently checked-out task's entry.
* Flags a `branchMismatch` entry distinctly.
* Never calls `gateChecks.run`.

### 3.1 Multiple active tasks, one current
* Given
  * Branches exist for `test/AAA-123` (current) and `test/ABC-789` (an
    open Build Gate PR)
  * `git.currentBranch()` returns `"test/AAA-123"`
* When - `pnpm task list`
* Then -
  * The reported `ListCommandResult.tasks` contains exactly 2 entries: one
    for `AAA-123` (`phase: "test"`, some non-`ready?`-resolved state) and
    one for `ABC-789` (`phase: "test"`, `state: "awaiting-pr"`)
  * `ListCommandResult.currentRef` is `"AAA-123"`
  * `gateChecks.run(...)` was **not** called at all
  * Exit code 0

### 3.2 branchMismatch surfaced per-entry
* Given
  * As §3.1, plus the checked-out branch is actually `build/AAA-123`
    while `AAA-123`'s canonical branch is `test/AAA-123` (an open Build
    Gate PR)
* When - `pnpm task list`
* Then -
  * The `AAA-123` entry in `tasks` has `branchMismatch: true`
  * The `ABC-789` entry has `branchMismatch: false`

### 3.3 No active tasks
* Given - no branch on `origin` or locally matches `*/{ref}` for any ref
* When - `pnpm task list`
* Then -
  * `ListCommandResult.tasks` is an empty array
  * `ListCommandResult.currentRef` is `null`
  * Exit code 0
