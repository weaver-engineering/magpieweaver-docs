# Task MAG-46 - `awaiting-pr` reporting and `promote`'s `pr-raised` action

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** split by which command each section invokes (per
`task-MAG-46-test-file-layout-design.md` §4) —
§3.1/§3.3 (`promote`) → `test/packages/task-phases/promote/pr-raised.test.ts`;
§3.2/§3.4 (`status`) → `test/packages/task-phases/status/awaiting-pr.test.ts`.

## 1. Interface Under Test
`pnpm task status` and `pnpm task promote`, extended to: derive `phase:
"test", state: "awaiting-pr"` from a real open PR (§3.2/§3.4), and
`promote`'s `test::ready → pr-raised` action (§3.11) that opens it.

## 2. Deliverable
- `promote`, finding `test/{ref}` `ready`, raises the Build Gate PR
  (`test/{ref}` → `build/{ref}`) via `github.createPR` and reports
  `action: "pr-raised"` with the PR's number/URL.
- `status`/`promote`, finding an open PR for that pair, derive
  `state: "awaiting-pr"`, attached to the `test` phase (not a new `Phase`),
  and `promote` is a safe no-op in this state.

### 2.1 Deliverable Notes For Agent
- **This replaces `lib/repo-state.ts`'s current `assertNoGatePR()`**,
  which today unconditionally throws `"not implemented"` the moment any
  gate PR is found (MAG-46-06.01) — that blanket defer is exactly what
  this chunk (and MAG-46-11.01/12/15) needs to turn into real derivation.
  Change `deriveRepoState()` itself; don't add a second PR-aware check
  inside `status.ts` or `promote.ts` alongside the existing one.
- `awaiting-pr` is attached to the **source** phase of the open PR (§3.4)
  — assert `phase` stays `"test"`, not something derived from the PR's
  destination.
- A second `promote` call while `awaiting-pr` must be idempotent — re-check
  `github.createPR` is **not** called again, and the result still reports
  success with the existing PR's number.
- This is also where `--confirm-rebase` first appears as a no-op concern:
  raising a PR isn't destructive, so it needs no confirmation gate at all
  (§3.5) — don't require the flag here.

## 3. Required Behaviors
* `test::ready` → `promote` opens a real PR and reports `pr-raised`.
* Once that PR is open, `status`/`promote` report `awaiting-pr` on the
  `test` phase.
* A repeated `promote` call while `awaiting-pr` is a safe, idempotent
  no-op that re-reports the same PR.

### 3.1 promote raises the Build Gate PR
* Given
  * `git.currentBranch()` returns `"test/AAA-123"` (canonical)
  * Derived state is `ready?`; `gateChecks.run("test", {ref: "AAA-123"})`
    resolves `passed: true`
  * `github.findOpenPR("build/AAA-123", "test/AAA-123")` currently returns
    `null`
  * `github.createPR("build/AAA-123", "test/AAA-123", {title: ...})`
    resolves `{number: 45, url: "https://github.com/.../pull/45"}`
* When - `pnpm task promote`
* Then -
  * `github.createPR` was called with base `"build/AAA-123"`, head
    `"test/AAA-123"`
  * `PromoteCommandResult.action` is `"pr-raised"`
  * `PromoteCommandResult.prNumber` is `45`
  * Exit code 0

### 3.2 status reports awaiting-pr once the PR is open
* Given
  * `github.findMergedPR(...)` returns `null` for every relevant pair
  * `github.findOpenPR("build/AAA-123", "test/AAA-123")` resolves the PR
    from §3.1
* When - `pnpm task status --ref AAA-123`
* Then -
  * The reported `phase` is `"test"`
  * The reported `state` is `"awaiting-pr"`

### 3.3 promote is an idempotent no-op while awaiting-pr
* Given - as §3.2
* When - `pnpm task promote`
* Then -
  * `github.createPR(...)` was **not** called again
  * `PromoteCommandResult.action` is `"none"`
  * The reported message re-states the existing PR's number, not a generic
    "nothing to do"
  * Exit code 0

### 3.4 Amending the test commit while awaiting-pr requires no tool action
* Given - as §3.2
* When - the agent pushes an amended commit directly to `test/AAA-123`
  (ordinary git, outside `task-phases` — §3.4)
* Then - a subsequent `pnpm task status --ref AAA-123` still correctly
  reports `awaiting-pr` against the same (now-updated) open PR, without
  `task-phases` having taken any action of its own
