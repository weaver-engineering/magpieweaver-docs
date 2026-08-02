# Task MAG-46 - `status` derives `merged-pending-pull`

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:**
`test/packages/task-phases/status/merged-pending-pull.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task status`, extended to derive `phase: "build"`,
`state: "merged-pending-pull"` once `github.findMergedPR` confirms the
Build Gate PR merged but local `build/{ref}` doesn't yet reflect it (§3.2,
§3.3).

## 2. Deliverable
`status` reports `merged-pending-pull` in both of its sub-cases: local
`build/{ref}` doesn't exist at all yet, and local `build/{ref}` exists but
is behind `origin/build/{ref}`. Neither case performs any git mutation —
resolving this state is `promote`-only (MAG-46-14).

### 2.1 Deliverable Notes For Agent
- **This extends `lib/repo-state.ts`'s `deriveRepoState()`** (LLD §4.5),
  same as MAG-46-11's `awaiting-pr` — add `merged-pending-pull` detection
  there, not as separate logic in `status.ts`.
- This state's derivation depends on comparing `test/{ref}`'s current HEAD
  against the merged PR's recorded `headRefOid`, not just "a merged PR
  exists" — assert this comparison is actually made, since it's what
  distinguishes an ordinary merge from the superseded-merge case (§3.5,
  MAG-46-13/14's concern, not this one's).
- No `git.pullFastForward` or `git.rebase` call should happen anywhere in
  this chunk — `status` only ever reports this state, never resolves it.

## 3. Required Behaviors
* Merged Build Gate PR + no local `build/{ref}` → `merged-pending-pull`.
* Merged Build Gate PR + local `build/{ref}` behind `origin/build/{ref}` →
  `merged-pending-pull`.
* `status` takes no git action in either case.

### 3.1 No local build/{ref} yet
* Given
  * `github.findMergedPR("build/AAA-123", "test/AAA-123")` resolves a
    merged PR whose `headRefOid` equals `git.headSha("test/AAA-123")`'s
    current value
  * `git.branchExists("build/AAA-123", {remote: false})` returns `false`
* When - `pnpm task status --ref AAA-123`
* Then -
  * The reported `phase` is `"build"`
  * The reported `state` is `"merged-pending-pull"`
  * No `git.pullFastForward`/`git.rebase`/`git.checkout` call was made

### 3.2 Local build/{ref} exists but is behind origin
* Given
  * As §3.1, except `git.branchExists("build/AAA-124", {remote: false})`
    returns `true`
  * `git.headSha("build/AAA-124")` differs from
    `git.headSha("origin/build/AAA-124")`
* When - `pnpm task status --ref AAA-124`
* Then -
  * The reported `phase` is `"build"`
  * The reported `state` is `"merged-pending-pull"`

### 3.3 Local build/{ref} already caught up falls through to ordinary states
* Given
  * As §3.1, except `git.branchExists("build/AAA-125", {remote: false})`
    returns `true`
  * `git.headSha("build/AAA-125")` equals
    `git.headSha("origin/build/AAA-125")`
* When - `pnpm task status --ref AAA-125`
* Then -
  * The reported `state` is **not** `"merged-pending-pull"` — it falls
    through to `not-started`/`work-in-progress`/`ready?` per MAG-46-06's
    ordinary derivation, now applied to the `build` phase
