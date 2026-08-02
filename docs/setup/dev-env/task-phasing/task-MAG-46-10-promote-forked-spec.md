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
  `gateChecks.run` itself, always, per §3.2), creates and checks out
  `test/{ref}` from `spec/{ref}`.
- `promote`, finding `spec/{ref}` `blocked`, takes no git action and relays
  the gate's own violations.
- `promote` refuses to act at all when the checked-out branch doesn't match
  the derived canonical branch.

### 2.1 Deliverable Notes For Agent
- **`promote`'s derived phase/state/canonicalBranch/branchMismatch come
  from `lib/repo-state.ts`'s `deriveRepoState()`** (LLD §4.5) — the same
  function `status` calls, not a private re-derivation. `promote` is a
  consumer here, not a second implementation.
- `promote` **always** runs `gateChecks.run` when state is `ready?` —
  unlike `status`, there's no flag gating this; assert it's called
  unconditionally in the ready?-resolution path.
- `git.push` for the newly-forked `test/{ref}` is **not** part of this
  action per §3.11's example output (`Create and checkout new branch` is
  the only step shown) — don't assert a push here unless the LLD's own
  promote-from-spec example is re-checked; if in doubt, flag rather than
  assert.

## 3. Required Behaviors
* `promote` on a ready spec phase creates `test/{ref}` off `spec/{ref}` and
  checks it out.
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
  * `git.checkout("test/AAA-123")` was called (or `createBranch` itself
    leaves it checked out, per §4.8's own docstring — assert whichever the
    implementation actually does, but assert the end state: current branch
    is `test/AAA-123`)
  * `PromoteCommandResult.action` is `"forked"`
  * A re-derived status afterward reports `phase: "test"`,
    `state: "not-started"`
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
