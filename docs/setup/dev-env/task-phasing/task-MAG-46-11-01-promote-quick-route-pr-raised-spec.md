# Task MAG-46 - `promote` raises the Main Gate PR on the quick route

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** §3.1–3.3 (`promote`) →
`test/packages/task-phases/promote/quick-route-pr-raised.test.ts`; §3.4
(`status`) adds a case to the existing
`test/packages/task-phases/status/awaiting-pr.test.ts` from MAG-46-11 —
not a new file, per `task-MAG-46-test-file-layout-design.md` §5.

## 1. Interface Under Test
`pnpm task promote [--json]`, covering the quick route's own `ready →
pr-raised` action (`task/{ref}` → `main`, per §3.7's gate table) — a case
MAG-46-11 never covered, since that chunk only proved the `test`-phase
PR-raise (`test/{ref}` → `build/{ref}`). This closes a gap surfaced during
system-behaviors review: the quick route's promote-to-PR action had no
spec at all.

## 2. Deliverable
- `promote`, finding `task/{ref}` `ready`, raises the Main Gate PR
  directly against `main` and reports `action: "pr-raised"`.
- `promote`, finding `task/{ref}` `blocked`, performs no action and relays
  `main-gate`'s own violations — same treatment as every other blocked
  case (MAG-46-10 §3.2, MAG-46-10.01's rebased cases), just against
  `main-gate` instead of `test-gate`/`build-gate`.
- A repeated `promote` call while the Main Gate PR is open (`awaiting-pr`
  on the `quick` phase) is the same safe, idempotent no-op as the
  `test`-phase case (MAG-46-11 §3.3).

### 2.1 Deliverable Notes For Agent
- `gateFor("quick")` already resolves to `"main-gate"` (proven for real in
  MAG-46-08 §3.1) — this chunk's mocked `gateChecks.run` calls should use
  `phase: "quick"`, not `"build"`, even though the destination gate name
  is the same string (`"main-gate"`) as the regular route's final gate;
  don't conflate the two phases just because the gate name matches.
- `main-gate`'s validation differs for this inbound path (§3.7 table:
  "same gate, different inbound-commit-count validation") — that
  difference lives entirely inside `gate-check` itself, not in anything
  `promote` needs to know or branch on; `promote`'s own logic here is
  identical in shape to MAG-46-11's, just against a different base/head
  pair.

## 3. Required Behaviors
* `quick::ready` → `promote` opens a real PR from `task/{ref}` into `main`
  and reports `pr-raised`.
* `quick::blocked` → `promote` takes no action, relays the gate's
  violations.
* A repeated `promote` call while that PR is open is an idempotent no-op.

### 3.1 promote raises the Main Gate PR from the quick route
* Given
  * `git.currentBranch()` returns `"task/AAA-234"` (canonical for the
    quick route)
  * Derived state is `ready?`; `gateChecks.run("quick", {ref: "AAA-234"})`
    resolves `passed: true`
  * `github.findOpenPR("main", "task/AAA-234")` currently returns `null`
  * `github.createPR("main", "task/AAA-234", {title: ...})` resolves
    `{number: 52, url: "https://github.com/.../pull/52"}`
* When - `pnpm task promote`
* Then -
  * `github.createPR` was called with base `"main"`, head `"task/AAA-234"`
  * `PromoteCommandResult.action` is `"pr-raised"`
  * `PromoteCommandResult.prNumber` is `52`
  * Exit code 0

### 3.2 quick::blocked performs no action
* Given
  * As §3.1, but `gateChecks.run("quick", {ref: "AAA-234"})` resolves
    `passed: false` with `violations: ["task doc missing"]`
* When - `pnpm task promote`
* Then -
  * `github.createPR(...)` was **not** called
  * `PromoteCommandResult.action` is `"none"`
  * `TaskPhasingCommandResult.violation` reflects the gate's own violation
    text directly
  * Exit code 0

### 3.3 Repeated promote while the Main Gate PR is open is idempotent
* Given
  * `github.findOpenPR("main", "task/AAA-234")` resolves the PR from §3.1
* When - `pnpm task promote`
* Then -
  * `github.createPR(...)` was **not** called again
  * `PromoteCommandResult.action` is `"none"`
  * The reported message re-states the existing PR's number
  * Exit code 0

### 3.4 status reports awaiting-pr on the quick phase for this PR
* Given - as §3.3
* When - `pnpm task status --ref AAA-234`
* Then -
  * The reported `phase` is `"quick"`
  * The reported `state` is `"awaiting-pr"`
