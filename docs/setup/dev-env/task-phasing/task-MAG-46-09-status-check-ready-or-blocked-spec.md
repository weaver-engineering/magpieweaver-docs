# Task MAG-46 - `task status --check` resolves `ready?`

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:**
`test/packages/task-phases/status/check-ready-or-blocked.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task status [--ref <ref>] [--check] [--json]`, extending MAG-46-06's
derivation with `ready?` resolution via `gateChecks.run` (injected test
double), and the `--ref`+`--check` refusal rule from §3.9.

## 2. Deliverable
- A phase branch with commits, none WIP-marked, and no PR yet raised is
  `ready?` on a plain `status` call, and resolves to `ready`/`blocked` only
  when `--check` is given.
- `status --ref <other-ref> --check` fails outright (exit 1) when
  `<other-ref>` isn't the currently checked-out task's ref.

### 2.1 Deliverable Notes For Agent
- **This extends `lib/repo-state.ts`'s `deriveRepoState()`** (LLD §4.5),
  not `status.ts` directly — the `ready?` resolution belongs in the shared
  derivation pipeline so `promote`/`list`/the `<ref>` switch see it too,
  not just `status`. Modify `deriveState()`'s no-PR branch there; don't
  fork a parallel resolution path in `status.ts`.
- `gateChecks.run` must be called with the phase currently derived, not a
  guessed one — assert the exact `phase` argument passed.
- The `--ref --check` refusal is a **failure with `success: false`**, not a
  crash — `taskStatus` for `<ref>` itself is still fully populated in the
  result, only `checked`/`checkRefused` reflect the refusal (§2's
  `StatusCommandResult`).

## 3. Required Behaviors
* Plain `status` reports `ready?` unresolved when commits exist and no PR
  has been raised.
* `status --check` runs `gateChecks.run` and reports `ready` or `blocked`.
* `status --ref <other> --check` refuses when `<other>` isn't checked out.

### 3.1 Plain status leaves ready? unresolved
* Given
  * `git.hasCommitsBeyond("test/AAA-123", "spec/AAA-123")` returns `true`
  * `git.headCommitTitle("test/AAA-123")` returns `"AAA-123: add tests"`
    (no `WIP`)
  * No merged/open PR exists for any relevant base/head pair
* When - `pnpm task status --ref AAA-123`
* Then -
  * `gateChecks.run(...)` was **not** called
  * The reported `state` is `"ready?"`
  * `StatusCommandResult.checked` is `false`

### 3.2 --check resolves to ready
* Given
  * As §3.1
  * `gateChecks.run("test", {ref: "AAA-123"})` resolves to a `passed: true`
    result
* When - `pnpm task status --ref AAA-123 --check`
* Then -
  * `gateChecks.run` was called with `phase: "test"` and `ref: "AAA-123"`
    in `args`
  * The reported `state` is `"ready"`
  * `StatusCommandResult.checked` is `true`
  * Exit code 0

### 3.3 --check resolves to blocked
* Given
  * As §3.1
  * `gateChecks.run(...)` resolves to `passed: false`, with
    `violations: ["commit title must start with AAA-123"]`
* When - `pnpm task status --ref AAA-123 --check`
* Then -
  * The reported `state` is `"blocked"`
  * `TaskPhasingCommandResult.violation` reflects the gate's own violation
    message directly, not a reworded version of it
  * Exit code 0 (a successfully-resolved `blocked` read is still a
    successful `status` invocation, per §3.9 — it isn't the same as the
    `--ref --check` refusal below)

### 3.4 --ref + --check refuses on a different task
* Given
  * `git.currentBranch()` resolves to a branch for ref `AAA-123`
  * `<ref>` given is `ABC-789`, a different ref
* When - `pnpm task status --ref ABC-789 --check`
* Then -
  * `gateChecks.run(...)` was **not** called
  * A message states `--check` requires `ABC-789` to be the checked-out
    task
  * `StatusCommandResult.checkRefused` is `true`
  * `TaskPhasingCommandResult.success` is `false`
  * Exit code 1
  * The reported `taskStatus` for `ABC-789` is still fully populated
    (phase/state derived as far as possible, just with `ready?`
    unresolved)

### 3.5 --check resolves ready/blocked on the quick route too
All of §3.1–§3.3 were fixtured against the `test` phase only; this repeats
the resolution behavior against `task/{ref}`/`main-gate` to confirm it
isn't accidentally coupled to the regular route.
* Given
  * `git.hasCommitsBeyond("task/AAA-234", "main")` returns `true`
  * `git.headCommitTitle("task/AAA-234")` returns `"AAA-234: quick fix"`
    (no `WIP`)
  * No merged/open PR exists for any relevant base/head pair
* When - `pnpm task status --ref AAA-234`
* Then -
  * The reported `phase` is `"quick"`
  * The reported `state` is `"ready?"`
* When - `pnpm task status --ref AAA-234 --check`, given
  `gateChecks.run("quick", {ref: "AAA-234"})` resolves `passed: true`
* Then -
  * `gateChecks.run` was called with `phase: "quick"`
  * The reported `state` is `"ready"`
* When - the same call, given `gateChecks.run(...)` instead resolves
  `passed: false` with `violations: ["task doc missing"]`
* Then - the reported `state` is `"blocked"`
