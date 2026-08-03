# Task MAG-46 - `promote` resolves a plain rebase-forward (`action: "rebased"`)

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/promote/rebased-forward.test.ts`.
See `task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task promote [--confirm-rebase] [--json]`, covering the two plain
rebase-forward triggers from §3.5 that were missed between MAG-46-10 and
MAG-46-14: **spec amended after `test/{ref}` already forked from it**, and
**`origin/main` drifting ahead of `spec/{ref}`/`task/{ref}`** (§2.1 — the
trunk reference is `origin/main`, not local `main`). Both resolve to
`PromoteCommandResult.action: "rebased"` — distinct from MAG-46-14's
`"pulled-and-rebased"`, which only applies to the merged-pending-pull
case. `git.rebase` itself is mocked here (the real primitive was proven in
MAG-46-13); this chunk is about `promote` correctly *detecting* the
trigger and calling it with the right arguments.

## 2. Deliverable
- Derived phase is `spec`, but `test/{ref}` already exists and `spec/{ref}`
  is not an ancestor of it (§3.2's staleness check fails) → `promote`
  rebases `test/{ref}` onto `spec/{ref}`'s new HEAD and force-pushes,
  gated by `--confirm-rebase`/prompt (§3.5's first case, Appendix §3.5.a).
- `spec/{ref}` (or `task/{ref}`) is behind `origin/main`'s current tip →
  `promote` rebases it onto `origin/main` and force-pushes, same
  confirmation gate, no extra `merge-base` verification needed since the
  trunk is the trunk (§3.5's final paragraph). See §2.1 on why the
  reference is `origin/main` and not local `main`.
- Missing confirmation in `--json` mode refuses cleanly, same pattern as
  MAG-46-14 §3.3.

### 2.1 Deliverable Notes For Agent
- **The staleness/drift detection driving these two triggers lives in
  `lib/repo-state.ts`'s `deriveRepoState()`** (LLD §4.5, §3.5) — `promote`
  reacts to what derivation already reports, it doesn't re-check
  `isAncestor` itself against `spec`/`main` a second time.
- These two triggers are mutually exclusive per invocation — a single
  `promote` call resolves whichever one derivation actually surfaced, not
  both at once. Cover them as separate fixtures, not a combined one.
  Rely on MAG-46-13 for the underlying `rebase()` primitive's mocked
  return values; this chunk asserts *which* branch/onto-ref `promote`
  passes to it, and how it reacts to each `RebaseOutcome` variant
  (`ok`/`conflict`/`unexpected-commit-count`) at the `promote` level.
- The `unexpected-commit-count` outcome needs its own assertion here too
  — it was proven at the primitive level in MAG-46-13, but never at the
  `promote` level in either this chunk or MAG-46-14. Cover it in both.
- **Correction: the drift reference is `origin/main`, not local `main`.**
  Local `main` is an ordinary branch that only moves when something moves
  it; it is not a live view of the trunk. In a repo with several
  worktrees sharing one ref namespace it is routinely stale, and
  `@magpieweaver/gate-checks` already defaults its own destination to
  `origin/main` for exactly this reason. Deriving "behind the trunk"
  against a stale local `main` produces a false negative — the drift goes
  unreported, and `promote` proceeds on a branch that really is behind.
  Every ancestry check in this chunk that names the trunk must therefore
  resolve `origin/main`. `deriveState()`'s own
  `hasCommitsBeyond(canonicalBranch, "main")` in `lib/repo-state.ts`
  needs the same treatment, but only for the two phases whose parent
  *is* the trunk — MAG-46-10 replaces the literal `"main"` with a
  per-phase parent (`spec`/`quick` → `origin/main`, `test` →
  `spec/{ref}`, `build` → `origin/build/{ref}`), and this correction
  fixes what the `spec`/`quick` entries resolve to. The `spec/{ref}` →
  `test/{ref}` ancestry check in §3.1 is unaffected: both sides are the
  tool's own local phase branches, which are current by construction.

## 3. Required Behaviors
* Spec amended under an existing `test/{ref}` → `promote` rebases
  `test/{ref}` onto the new `spec/{ref}` HEAD, confirmation-gated.
* `origin/main` ahead of `spec/{ref}`/`task/{ref}` → `promote` rebases it
  onto `origin/main`, confirmation-gated.
* Missing `--confirm-rebase` in `--json` mode refuses, takes no action.
* A real conflict or unexpected commit count is surfaced, not silently
  handled.

### 3.1 Spec amended under existing test/{ref}, confirmed
* Given
  * `git.currentBranch()` returns `"spec/AAA-123"`
  * `git.branchExists("test/AAA-123", ...)` returns `true`
  * `git.isAncestor("spec/AAA-123", "test/AAA-123")` returns `false`
    (spec was amended after test forked)
  * `git.rebase("test/AAA-123", "spec/AAA-123")` resolves `{status: "ok"}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.rebase("test/AAA-123", "spec/AAA-123")` was called
  * `git.push("test/AAA-123", {force: true})` was called afterward
  * `PromoteCommandResult.action` is `"rebased"`
  * `PromoteCommandResult.rebaseOutcome` is `{status: "ok"}`
  * Exit code 0

### 3.2 origin/main drifted ahead of spec/{ref}, confirmed
* Given
  * `git.currentBranch()` returns `"spec/AAA-124"`
  * `git.branchExists("test/AAA-124", ...)` returns `false`
  * `git.isAncestor("origin/main", "spec/AAA-124")` returns `false`
    (the trunk has commits not yet reachable from `spec/AAA-124`)
  * `git.rebase("spec/AAA-124", "origin/main")` resolves `{status: "ok"}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.rebase("spec/AAA-124", "origin/main")` was called
  * `git.push("spec/AAA-124", {force: true})` was called afterward
  * `PromoteCommandResult.action` is `"rebased"`
  * Exit code 0

### 3.3 origin/main drifted ahead of task/{ref} (quick route), confirmed
* Given
  * Derived phase is `quick` for `AAA-125`
  * `git.isAncestor("origin/main", "task/AAA-125")` returns `false`
  * `git.rebase("task/AAA-125", "origin/main")` resolves `{status: "ok"}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.rebase("task/AAA-125", "origin/main")` was called
  * `PromoteCommandResult.action` is `"rebased"`

### 3.4 Missing confirmation refuses in --json mode
* Given - as §3.1, but `--confirm-rebase` is **not** given
* When - `pnpm task promote --json`
* Then -
  * `git.rebase(...)` and `git.push(...)` were **not** called
  * A message states a rebase is required and `--confirm-rebase` must be
    supplied
  * `PromoteCommandResult.action` is `"none"`
  * Exit code 1

### 3.5 Conflict is surfaced, not resolved
* Given
  * As §3.1, but `git.rebase(...)` resolves
    `{status: "conflict", details: "..."}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.push(...)` was **not** called
  * `PromoteCommandResult.rebaseOutcome.status` is `"conflict"`
  * Exit code 1

### 3.6 Unexpected commit count is surfaced, not silently rewritten
* Given
  * As §3.1, but `git.rebase(...)` resolves
    `{status: "unexpected-commit-count", expected: 1, actual: 3, ...}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.push(...)` was **not** called
  * `PromoteCommandResult.rebaseOutcome.status` is
    `"unexpected-commit-count"`
  * The reported message states the branch has more than one commit of
    its own and the agent must squash before promoting
  * Exit code 1
