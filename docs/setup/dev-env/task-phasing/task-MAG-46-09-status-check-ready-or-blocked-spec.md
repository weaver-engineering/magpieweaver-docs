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
`pnpm task status [--ref <ref>] [--check] [--json]`: `status.ts`'s
`--check`/refusal handling (§3.9), plus two changes to
`lib/repo-state.ts` (LLD §4.5) that make `ready?` reachable and
resolvable at all — `deriveState()`'s WIP-marker check, and a new
exported `resolveReady()`.

## 2. Deliverable
- A phase branch with commits, none WIP-marked, and no PR yet raised is
  `ready?` on a plain `status` call, and resolves to `ready`/`blocked` only
  when `--check` is given.
- A WIP-marked head never resolves past `work-in-progress`, `--check` or
  not.
- `status --ref <other-ref> --check` fails outright (exit 1) when
  `<other-ref>` isn't the currently checked-out task's ref.

### 2.1 Deliverable Notes For Agent
- **Two separate changes, not one — don't conflate them:**
  1. **`deriveState()`'s WIP-marker check** (`lib/repo-state.ts`, LLD
     §4.5/§3.12): it already calls `headCommitTitle()` but discards the
     result, always returning `"work-in-progress"` for any branch with
     commits. Consult that result for the literal substring `WIP`
     (§3.12's convention, exact string match) — WIP-marked stays
     `"work-in-progress"`; not WIP-marked becomes `"ready?"`. This is the
     *only* change the shared `deriveRepoState()` pipeline itself needs,
     and it stays entirely gate-check-free — `list`/every other caller of
     `deriveRepoState()` is unaffected.
  2. **A new exported `resolveReady()` in `lib/repo-state.ts`** — *not*
     inside `deriveRepoState()`/`deriveState()`, and *not* in
     `status.ts` either. Signature:
     `resolveReady(tools: ExternalTools, status: TaskStatus): Promise<TaskStatus>`.
     If `status.state !== "ready?"`, returns `status` unchanged and MUST
     NOT call `gateChecks.run` — a pure pass-through guard. If `"ready?"`,
     calls `gateChecks.run(status.phase, {ref: status.ref})` and returns
     an updated `TaskStatus` with `state` set to `"ready"`/`"blocked"`
     per the result's `passed`, and `gate: {name, enforced, result}`
     populated (`name`/`enforced` per the LLD's §3.7 gate table, keyed
     off `status.phase` — not this spec doc's own §3.7 below).
  - **Why a separate `lib/repo-state.ts` function instead of inline in
    `status.ts`:** `promote` (MAG-46-10/11) needs the identical
    resolve-and-reshape behavior **unconditionally**, per §3.11 — a
    second, independent caller of the exact same logic, not a fork of
    it. `status.ts` calls `resolveReady()` explicitly, only when
    `--check` is given and not refused; it is not invoked automatically
    by `deriveRepoState()`, so `list`/other future callers that never
    call `resolveReady()` themselves stay fast and gate-check-free, per
    §3.2/§3.10.
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
* A WIP-marked head stays `work-in-progress`, never reaching `ready?`,
  regardless of `--check`.
* `resolveReady()` is a pure pass-through for any status not already
  `ready?` — it never calls `gateChecks.run` speculatively, since
  `promote` (MAG-46-10/11) will depend on that guard unconditionally.

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

### 3.5 A WIP-marked head never resolves to ready?
* Given
  * `git.hasCommitsBeyond("test/AAA-123", "spec/AAA-123")` returns `true`
  * `git.headCommitTitle("test/AAA-123")` returns
    `"AAA-123: quick fix - WIP"` (the literal substring `WIP`, per
    §3.12's convention)
* When - `pnpm task status --ref AAA-123`
* Then -
  * The reported `state` is `"work-in-progress"` — not `"ready?"`
* When - `pnpm task status --ref AAA-123 --check`
* Then -
  * The reported `state` is still `"work-in-progress"`
  * `gateChecks.run(...)` was **not** called
  * `StatusCommandResult.checked` is `false`

### 3.6 resolveReady is a no-op for any non-ready? status
Direct unit coverage of `resolveReady()` itself (`lib/repo-state.ts`), not
routed through the CLI — the guarantee `promote` (MAG-46-10/11) will
depend on unconditionally.
* Given - a `TaskStatus` with `state: "work-in-progress"` (any state other
  than `"ready?"` is equally valid here; `"work-in-progress"` is
  representative)
* When - `resolveReady(tools, status)` is called directly
* Then -
  * The returned `TaskStatus` is exactly the input, unchanged
  * `gateChecks.run` was **not** called

### 3.7 --check resolves ready/blocked on the quick route too
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
