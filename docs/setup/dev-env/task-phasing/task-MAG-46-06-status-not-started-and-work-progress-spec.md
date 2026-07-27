# Task MAG-46 - `task status` derives `not-started` / `work-in-progress`

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:**
`test/packages/task-phases/status/not-started-and-work-in-progress.test.ts`.
See `task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task status [--ref <ref>]`, extending MAG-46-04's derivation to the
case where a phase branch exists but no gate PR has ever been raised —
against injected `git`/`github` test doubles.

## 2. Deliverable
`status` distinguishes `not-started` (branch exists, no commits beyond its
parent) from `work-in-progress` (commits exist, none of them a WIP-marked
commit) for both `spec/{ref}` (normal route) and `task/{ref}` (quick
route). Also covers three related derivation behaviors surfaced by
system-behaviors review as needing their own coverage here rather than
only being exercised indirectly by `promote`: the ancestry-staleness
fallback (§3.2's closing rule), the `branchMismatch` field itself, and a
WIP-marked head commit correctly holding derivation at
`work-in-progress` rather than reaching `ready?`. `ready?`/`ready`/
`blocked` resolution itself is out of scope here (MAG-46-09).

### 2.1 Deliverable Notes For Agent
- `hasCommitsBeyond` and `headCommitTitle` are the two `GitTool` methods
  this chunk newly exercises — assert both are called with the right
  arguments, not just that the right state comes out.
- §3.5 below is where the ancestry staleness check actually becomes
  relevant — once `test/{ref}` exists alongside `spec/{ref}`. Don't
  conflate it with §3.9's separate `ready?`→`ready`/`blocked` resolution;
  this is purely about which *phase* gets reported, before any gate-check
  is involved.

## 3. Required Behaviors
* No PR (merged or open) exists, and the phase branch has no commits beyond
  `main` → `not-started`.
* No PR exists, and the phase branch has commits, none titled with `WIP` →
  `work-in-progress`.
* Both cases work identically for `spec/{ref}` and `task/{ref}`.
* `test/{ref}` exists but `spec/{ref}` is not its ancestor (spec amended
  after test forked) → derivation falls back to reporting `phase: "spec"`,
  `test/{ref}` is not consulted.
* `currentBranch` differing from the derived canonical branch is reflected
  in `TaskStatus.branchMismatch`.
* A WIP-marked head commit holds derivation at `work-in-progress`, never
  `ready?`.

### 3.1 spec/{ref}, not-started
* Given
  * `github.findMergedPR`/`findOpenPR` all return `null` for every
    base/head pair checked
  * `git.branchExists("spec/AAA-001", ...)` returns `true`
  * `git.branchExists("test/AAA-001", ...)` returns `false`
  * `git.hasCommitsBeyond("spec/AAA-001", "main")` returns `false`
* When - `pnpm task status --ref AAA-001`
* Then -
  * The reported `phase` is `"spec"`
  * The reported `state` is `"not-started"`
  * `git.headCommitTitle(...)` was **not** called (nothing to check a
    title on)

### 3.2 spec/{ref}, work-in-progress
* Given
  * As §3.1, except `git.hasCommitsBeyond("spec/AAA-002", "main")` returns
    `true`
  * `git.headCommitTitle("spec/AAA-002")` returns `"Draft the interface"`
    (no `WIP` substring)
* When - `pnpm task status --ref AAA-002`
* Then -
  * The reported `phase` is `"spec"`
  * The reported `state` is `"work-in-progress"`

### 3.3 task/{ref} (quick route), not-started
* Given
  * `git.branchExists("task/AAA-003", ...)` returns `true`
  * `git.branchExists("spec/AAA-003", ...)` and `("test/AAA-003", ...)`
    both return `false`
  * `git.hasCommitsBeyond("task/AAA-003", "main")` returns `false`
* When - `pnpm task status --ref AAA-003`
* Then -
  * The reported `phase` is `"quick"`
  * The reported `state` is `"not-started"`

### 3.4 task/{ref}, work-in-progress
* Given
  * As §3.3, except `hasCommitsBeyond` returns `true` and
    `headCommitTitle("task/AAA-004")` returns `"AAA-004: first pass"`
* When - `pnpm task status --ref AAA-004`
* Then -
  * The reported `phase` is `"quick"`
  * The reported `state` is `"work-in-progress"`

### 3.5 Ancestry-staleness fallback: spec amended after test forked
* Given
  * `github.findMergedPR`/`findOpenPR` all return `null` for every
    base/head pair checked
  * `git.branchExists("test/AAA-006", ...)` returns `true`
  * `git.isAncestor("spec/AAA-006", "test/AAA-006")` returns `false`
    (spec was amended after test forked, per §3.5 — this is the same
    condition `promote` reacts to in MAG-46-10.01, but this spec is about
    `status`'s own reporting, not any action)
  * `git.hasCommitsBeyond("spec/AAA-006", "main")` returns `true`
  * `git.headCommitTitle("spec/AAA-006")` returns `"AAA-006: revise
    interface"` (no `WIP`)
* When - `pnpm task status --ref AAA-006`
* Then -
  * The reported `phase` is `"spec"` — **not** `"test"`, even though
    `test/AAA-006` exists
  * The reported `state` is `"work-in-progress"`
  * `git.hasCommitsBeyond`/`headCommitTitle` were called against
    `spec/AAA-006`, never against `test/AAA-006` — confirming `test/{ref}`
    genuinely wasn't consulted, not merely that the right phase happened
    to come out

### 3.6 branchMismatch field reflects currentBranch vs. canonical
* Given
  * As §3.1 (derived canonical branch is `spec/AAA-007`)
  * `git.currentBranch()` returns `"build/XYZ-999"` instead (an agent
    sitting on an unrelated branch)
* When - `pnpm task status --ref AAA-007`
* Then -
  * `TaskStatus.canonicalBranch` is `"spec/AAA-007"`
  * `TaskStatus.currentBranch` is `"build/XYZ-999"`
  * `TaskStatus.branchMismatch` is `true`
* Given - as §3.1, but `git.currentBranch()` returns `"spec/AAA-001"`
  (matches canonical)
* When - `pnpm task status --ref AAA-001`
* Then - `TaskStatus.branchMismatch` is `false`

### 3.7 A WIP-marked head commit holds state at work-in-progress
* Given
  * As §3.2, except `git.headCommitTitle("spec/AAA-008")` returns
    `"AAA-008: - WIP"` (the confirmed bare-`wip` format, MAG-46-07 §3.3)
  * No PR (merged or open) exists for `AAA-008`
* When - `pnpm task status --ref AAA-008`
* Then -
  * The reported `phase` is `"spec"`
  * The reported `state` is `"work-in-progress"` — **not** `"ready?"`,
    even though commits exist beyond `main`
