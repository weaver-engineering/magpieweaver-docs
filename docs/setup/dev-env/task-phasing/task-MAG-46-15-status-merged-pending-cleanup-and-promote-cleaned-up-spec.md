# Task MAG-46 - `merged-pending-cleanup` and `promote`'s final cleanup

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** split by which command each section invokes (per
`task-MAG-46-test-file-layout-design.md` §4) —
§3.1/§3.2 (`status`) → `test/packages/task-phases/status/merged-pending-cleanup.test.ts`;
§3.3–3.6 (`promote`, incl. §3.5's post-cleanup `status` check, which stays
here as a side-effect verification rather than moving to the `status`
file) → `test/packages/task-phases/promote/cleaned-up.test.ts`.

## 1. Interface Under Test
`pnpm task status` deriving `merged-pending-cleanup` (§3.2, both the
ordinary route and the interrupted-cleanup retrigger), and
`pnpm task promote`'s `cleaned-up` action (§3.6) — against injected
`git`/`github` test doubles.

## 2. Deliverable
- `status` reports `phase: "build"` (or `"quick"`),
  `state: "merged-pending-cleanup"` once the Main Gate PR is confirmed
  merged and `main` hasn't caught up locally yet — including the
  interrupted-cleanup case, where a phase branch survives but is already
  an ancestor of local `main`.
- `promote` in this state fetches, updates local `main`, deletes every
  surviving phase branch (local and remote), and requires **no**
  confirmation (§3.3 — nothing is lost once the merge is confirmed).
- After cleanup, the same ref reports `not-initialised` again.

### 2.1 Deliverable Notes For Agent
- **`merged-pending-cleanup` detection extends `lib/repo-state.ts`'s
  `deriveRepoState()`** (LLD §4.5), same as MAG-46-11/12's states —
  `promote`'s `cleaned-up` action consumes the derived state, it doesn't
  duplicate the merged/ancestor checks itself.
- The interrupted-cleanup retrigger (branch survives as an ancestor of
  `main`) must resolve to the same `merged-pending-cleanup` state and the
  same `cleaned-up` action as the ordinary route — assert both fixtures
  converge on identical `PromoteCommandResult`, not two different code
  paths that happen to look similar.
- `deleteBranch` tolerating "doesn't exist locally" as a no-op matters here
  specifically — assert cleanup succeeds even when only some of
  `spec/test/build` branches actually survived to be deleted.
- No `--confirm-rebase` or prompt of any kind gates this action — assert
  it proceeds without one, unlike MAG-46-14.

## 3. Required Behaviors
* Merged Main Gate PR + local `main` behind → `merged-pending-cleanup`.
* An interrupted prior cleanup (surviving branch, already an ancestor of
  `main`) also derives `merged-pending-cleanup`.
* `promote` cleans up: updates `main`, deletes all surviving phase
  branches locally and on `origin`, no confirmation required.
* After cleanup, the ref reports `not-initialised`.

### 3.1 Ordinary merged-pending-cleanup detection
* Given
  * `github.findMergedPR("main", "build/AAA-123")` resolves a merged PR
  * Local `main`'s HEAD doesn't yet include that merge (confirmed via
    `git.isAncestor`)
* When - `pnpm task status --ref AAA-123`
* Then -
  * The reported `phase` is `"build"`
  * The reported `state` is `"merged-pending-cleanup"`

### 3.2 Interrupted-cleanup retrigger
* Given
  * No merged/open Main Gate PR is found via `github` for `AAA-124`
    (e.g. the API call is being re-derived after a partial run)
  * `test/AAA-124` still exists locally
  * `git.isAncestor("test/AAA-124", "main")` returns `true`
* When - `pnpm task status --ref AAA-124`
* Then -
  * The reported `phase` is `"build"`
  * The reported `state` is `"merged-pending-cleanup"` — identical to
    §3.1's derivation, not a distinct "stale" or "broken" state

### 3.3 promote performs cleanup, no confirmation required
* Given
  * Derived state is `merged-pending-cleanup` for `AAA-123`
  * `spec/AAA-123`, `test/AAA-123`, `build/AAA-123` all exist locally and
    on `origin`
  * `git.isDirty()` returns `false`
* When - `pnpm task promote`
* Then -
  * `git.checkout("main")` and a local `main` update were performed
  * `git.deleteBranch("spec/AAA-123")`, `("test/AAA-123")`,
    `("build/AAA-123")` were all called
  * No `--confirm-rebase` flag was required and none was given
  * `PromoteCommandResult.action` is `"cleaned-up"`
  * `PromoteCommandResult.branchesDeleted` contains all three branch names
  * Exit code 0

### 3.4 Cleanup tolerates partially-already-deleted branches
* Given
  * As §3.3, except `test/AAA-124` was already deleted in a prior,
    interrupted cleanup attempt (only `spec/AAA-124` and `build/AAA-124`
    survive)
* When - `pnpm task promote`
* Then -
  * `git.deleteBranch("test/AAA-124")` is called and tolerates "doesn't
    exist" as a no-op (no error raised)
  * `PromoteCommandResult.action` is still `"cleaned-up"`
  * Exit code 0

### 3.5 Ref reports not-initialised after cleanup
* Given - cleanup from §3.3 has completed
* When - `pnpm task status --ref AAA-123`
* Then - the reported `state` is `"not-initialised"`

### 3.6 Cleanup on the quick route deletes only task/{ref}
All of §3.1–§3.5 fixture the regular `spec`/`test`/`build` branch set;
this repeats the cleanup action for the quick route, where only
`task/{ref}` ever existed.
* Given
  * Derived state is `merged-pending-cleanup` for `AAA-234`, phase
    `"quick"` (Main Gate PR `task/AAA-234` → `main` confirmed merged)
  * `task/AAA-234` exists locally and on `origin`; no `spec/AAA-234` or
    `test/AAA-234` ever existed
  * `git.isDirty()` returns `false`
* When - `pnpm task promote`
* Then -
  * `git.checkout("main")` and a local `main` update were performed
  * `git.deleteBranch("task/AAA-234")` was called
  * `git.deleteBranch("spec/AAA-234")`/`("test/AAA-234")`/
    `("build/AAA-234")` were **not** called — nothing to delete on a route
    that never created them
  * `PromoteCommandResult.action` is `"cleaned-up"`
  * `PromoteCommandResult.branchesDeleted` is exactly `["task/AAA-234"]`
  * Exit code 0
