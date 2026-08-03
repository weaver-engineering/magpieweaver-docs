# Task MAG-46 - `task promote` forks `spec/{ref}` into `test/{ref}`

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/promote/forked.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task promote [--json]`, the first real `promote` behavior — the
`spec::ready → forked` action (§3.11) — plus the `branchMismatch` guard
(§3.4) that gates every `promote` action from here on.

## 2. Deliverable
- `promote`, finding `spec/{ref}` in state `ready` (resolving `ready?` via
  `resolveReady()` unconditionally, per §3.2), creates `test/{ref}` from
  `spec/{ref}` and returns the worktree to `spec/{ref}` (§2.1's
  branch-restoration invariant).
- `promote`, finding `spec/{ref}` `blocked`, takes no git action and relays
  the gate's own violations.
- `promote` refuses to act at all when the checked-out branch doesn't match
  the derived canonical branch.

### 2.1 Deliverable Notes For Agent
- **`promote`'s derived phase/state/canonicalBranch/branchMismatch come
  from `lib/repo-state.ts`'s `deriveRepoState()`** (LLD §4.5) — the same
  function `status` calls, not a private re-derivation. `promote` is a
  consumer here, not a second implementation.
- **Resolution is `resolveReady()`, not a direct `gateChecks.run` call —
  the exact function MAG-46-09 built for this.** `promote` calls
  `deriveRepoState()`, then **unconditionally** calls
  `resolveReady(tools, taskStatus)` (`lib/repo-state.ts`, already
  exported) — the same function `status.ts` calls only when `--check` is
  given. Do not call `tools.gateChecks.run` directly here: `resolveReady`
  is the only place that knows how to populate `TaskStatus.gate.name`/
  `gate.enforced` (the phase → gate table is a private, unexported
  constant inside `repo-state.ts` for exactly this reason) — reaching
  into `gateChecks.run` directly would mean reimplementing that mapping
  from scratch, or silently never populating `gate` at all. Assert
  `gateChecks.run` was called (via the mock) to confirm resolution
  happened, but the call your own code makes is to `resolveReady`.
- `git.push` for the newly-forked `test/{ref}` is **not** part of this
  action per §3.11's example output (branch creation and the restoring
  checkout are the only steps shown) — the branch is pushed for the first
  time when the *next* phase's own work is committed, not here.
- **Correction, superseding the one made in PR #79: a phase's state is
  derived against that phase's own parent branch, not against `main`.**
  PR #79 changed §3.1's post-fork state from `not-started` to `ready?`,
  reasoning that `test/{ref}` inherits `spec/{ref}`'s commits so
  `hasCommitsBeyond("test/{ref}", "main")` is `true`. The observation
  about the code was accurate; the conclusion was not. `deriveState()`
  passing the literal `"main"` for every phase is itself the defect —
  it measures the *task's* total progress and calls the answer the
  *phase's* state, so a freshly-forked `test/{ref}` with no test work
  reports `ready?`, and `promote` then runs `build-gate` against a
  branch that has nothing to gate (1 commit where the gate wants 2,
  yielding a confusing `blocked`).

  A phase is `not-started` when it has no commit **of its own**, which
  means comparing against the branch it forked from:

  | Phase   | Parent branch to derive against |
  |---------|---------------------------------|
  | `spec`  | `origin/main`                   |
  | `test`  | `spec/{ref}`                    |
  | `build` | `origin/build/{ref}`            |
  | `quick` | `origin/main`                   |

  This is the same parent each gate already counts against —
  `test-gate` wants `test/{ref}` exactly 1 commit beyond `spec/{ref}`,
  and the agents' own protocols check the same thing — so derivation and
  the gates stop disagreeing about what a phase's work is. The
  `origin/main` entries are MAG-46-10.01's correction; both changes land
  in the same `deriveState()` signature.

  Every state assertion already merged is unaffected: they pin
  `spec/{ref}` or `task/{ref}` against `"main"`, where `origin/main` is
  the right parent anyway, and the one test-phase assertion
  (`check-ready-or-blocked.test.ts`) leaves the parent unconstrained.

- **Correction (branch-restoration invariant): the fork ends with
  `spec/{ref}` checked out again.** `GitTool.createBranch` is `git
  checkout -b <newBranch> <fromRef>` (LLD §4.8), so it leaves
  `test/{ref}` checked out in whichever worktree ran `promote`. That is
  harmless in the single-worktree model the LLD was written against, but
  the dev machine runs one clone with several linked worktrees
  (`architect`, `agent_1`) sharing a single ref namespace, and **git
  allows a branch to be checked out in only one worktree at a time**:

  ```
  fatal: 'test/AAA-123' is already checked out at '.../architect'
  ```

  The spec phase is the architect's. If the architect runs `promote` on
  `spec/{ref}` and it leaves the tree parked on `test/{ref}`, the agent
  cannot check that branch out at all — the fork hands the next phase's
  branch to the wrong worktree.

  So `promote` calls `createBranch("test/{ref}", "spec/{ref}")` as
  before, then `checkout("spec/{ref}")` to return. The architect's tree
  ends where it started, on the spec commit it owns, and `test/{ref}`
  is left free for the agent to check out. This is the general
  branch-restoration invariant in LLD §2.1 — every command except `<ref>`
  and `status --fix` leaves the worktree on the branch it found it on —
  and this is its first application. `wip` already observes it (§3.12).

## 3. Required Behaviors
* `promote` on a ready spec phase creates `test/{ref}` off `spec/{ref}`
  and returns the worktree to `spec/{ref}`.
* `promote` on a blocked spec phase performs no git action and reports the
  gate's violations directly.
* `promote` refuses outright when `currentBranch != canonicalBranch`.

### 3.1 Ready spec phase forks into test
* Given
  * `git.currentBranch()` returns `"spec/AAA-123"` (matches canonical)
  * Derived state is `ready?` (commits exist, no PR raised)
  * `gateChecks.run("spec", {ref: "AAA-123"})` resolves `passed: true`
* When - `pnpm task promote`
* Then -
  * `git.createBranch("test/AAA-123", "spec/AAA-123")` was called
  * `git.checkout("spec/AAA-123")` was called **afterward**, restoring
    the starting branch (§2.1's branch-restoration correction) — assert
    the ordering, not merely that both calls occurred
  * `git.currentBranch()` reports `"spec/AAA-123"` at the end, the same
    branch it reported at the start — the caller is not left parked on
    the branch it just created
  * `PromoteCommandResult.action` is `"forked"`
  * A re-derived status afterward reports `phase: "test"`, `state:
    "not-started"` — `test/AAA-123` exists, so the phase is `test`, and
    it carries no commit of its own yet, so the state is `not-started`.
    Assert `hasCommitsBeyond("test/AAA-123", "spec/AAA-123")` is what
    gets called, and that it returns `false`.
  * That re-derived status therefore also reports `branchMismatch: true`
    (checked out `spec/AAA-123`, canonical `test/AAA-123`). This is the
    expected, correct consequence of the branch-restoration invariant —
    the worktree that takes on the test phase resolves it by checking
    `test/AAA-123` out. It is **not** a refusal condition for the fork
    itself, which has already completed; §3.3's `branchMismatch` guard is
    evaluated on entry, against the pre-fork state.
  * Exit code 0

### 3.2 Blocked spec phase performs no action
* Given
  * As §3.1, but `gateChecks.run(...)` resolves `passed: false` with
    `violations: ["spec must define at least one behavior"]`
* When - `pnpm task promote`
* Then -
  * `git.createBranch(...)` was **not** called
  * `PromoteCommandResult.action` is `"none"`
  * `TaskPhasingCommandResult.violation` reflects the gate's own violation
    text directly
  * Exit code 0 (a successfully-determined `blocked` result — `promote`
    ran to completion and correctly reported it can't proceed; this is
    distinct from the usage/refusal failures below)

### 3.3 Branch mismatch refuses to act
* Given
  * Derived canonical branch for the current task is `"test/AAA-123"`
    (e.g. because a Build Gate PR is `awaiting-pr`)
  * `git.currentBranch()` returns `"build/AAA-123"` instead
* When - `pnpm task promote`
* Then -
  * No mutating `git`/`github` method was called
  * `PromoteCommandResult.action` is `"none"`
  * A message states the checked-out branch doesn't match the task's
    actual phase/state, naming both
  * `TaskStatus.branchMismatch` is `true`
