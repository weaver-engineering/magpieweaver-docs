# Task MAG-46 - `promote` resolves `merged-pending-pull`

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:**
`test/packages/task-phases/promote/pulled-and-rebased.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task promote [--confirm-rebase] [--json]`, resolving
`merged-pending-pull` (derived in MAG-46-12) into either `pulled` or
`pulled-and-rebased` (§3.3, §3.5 step 4) — against injected `git`/`github`
test doubles, with `git.rebase`/`git.pullFastForward` mocked (the real
primitive was proven in MAG-46-13).

## 2. Deliverable
- Plain pull case: `build/{ref}` had no pre-existing build-phase commits →
  `promote` fast-forwards it locally, no confirmation needed.
- Cascading case: `build/{ref}` already had build-phase commits → `promote`
  pulls **and** rebases them onto the fresh merge, gated by
  `--confirm-rebase`/an interactive prompt, exactly like every other
  rewrite in this design.

### 2.1 Deliverable Notes For Agent
- **`merged-pending-pull` is read from `lib/repo-state.ts`'s
  `deriveRepoState()`** (derived in MAG-46-12) — `promote` consumes that
  state, it doesn't re-check `build/{ref}`'s ancestry itself.
- The plain-pull case is explicitly **not** automatic on `status`/`list` —
  it still requires an actual `promote` invocation (§3.3) even though it's
  non-destructive; assert `pullFastForward` is never called from a
  `status` test double in this chunk.
- `--confirm-rebase` absent in non-interactive (`--json`) mode must refuse
  and explain, never silently rebase and never block with an unexplained
  failure (§3.5) — assert the exact refusal message names what's required.
- The interactive (`y/N`) prompt path can be covered with a fake stdin/TTY
  test double if the test harness supports it; if it doesn't yet, flag
  that as a harness gap rather than skipping the behavior silently.

## 3. Required Behaviors
* `merged-pending-pull` with no pre-existing build commits → plain pull,
  no confirmation required.
* `merged-pending-pull` with pre-existing build commits → pull + rebase,
  requires `--confirm-rebase` (or interactive confirmation).
* Missing confirmation in `--json` mode refuses cleanly, takes no action.
* A rebase conflict or unexpected commit count is surfaced via
  `rebaseOutcome`, not silently resolved.
* The interactive (no `--json`) confirmation prompt gates the rebase+push
  identically to `--confirm-rebase`.

### 3.1 Plain pull, no pre-existing build commits
* Given
  * Derived state is `merged-pending-pull` for `AAA-123`
  * `git.branchExists("build/AAA-123", {remote: false})` returns `false`
    (nothing pre-existing to reorder)
* When - `pnpm task promote`
* Then -
  * `git.pullFastForward("build/AAA-123")` was called
  * `git.rebase(...)` was **not** called
  * `PromoteCommandResult.action` is `"pulled"`
  * No `--confirm-rebase` was required
  * Exit code 0

### 3.2 Pull + rebase, pre-existing build commits, confirmed
* Given
  * Derived state is `merged-pending-pull` for `AAA-124`
  * `git.branchExists("build/AAA-124", {remote: false})` returns `true`
    with one pre-existing build commit
  * `git.rebase("build/AAA-124", <fresh-merge-ref>)` resolves
    `{status: "ok"}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.pullFastForward(...)` and `git.rebase(...)` were both called, in
    that order
  * `git.push("build/AAA-124", {force: true})` was called afterward
  * `PromoteCommandResult.action` is `"pulled-and-rebased"`
  * `PromoteCommandResult.rebaseOutcome` is `{status: "ok"}`
  * Exit code 0

### 3.3 Missing confirmation refuses in --json mode
* Given
  * As §3.2, but `--confirm-rebase` is **not** given
* When - `pnpm task promote --json`
* Then -
  * `git.rebase(...)` and `git.push(...)` were **not** called
  * A message states a rebase is required and `--confirm-rebase` must be
    supplied
  * `PromoteCommandResult.action` is `"none"`
  * Exit code 1 (this command did not deliver the requested promotion)

### 3.4 Rebase conflict is surfaced, not silently resolved
* Given
  * As §3.2, but `git.rebase(...)` resolves
    `{status: "conflict", details: "..."}`
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.push(...)` was **not** called
  * `PromoteCommandResult.rebaseOutcome.status` is `"conflict"`
  * The reported message states the newly-merged test content takes
    precedence and the agent must adjust their build WIP to match it
  * Exit code 1

### 3.5 Unexpected commit count is surfaced, not silently rewritten
* Given
  * As §3.2, but `git.rebase(...)` resolves
    `{status: "unexpected-commit-count", expected: 1, actual: 2, ...}`
    (the pre-existing `build/{ref}` commits don't match what a clean
    reorder expects — e.g. an agent stacked an extra commit without
    squashing)
* When - `pnpm task promote --confirm-rebase`
* Then -
  * `git.push(...)` was **not** called
  * `PromoteCommandResult.action` is still reported as
    `"pulled-and-rebased"` — the pull half of this action did complete;
    only the rebase half failed, and `rebaseOutcome` is where that's
    visible, not a reversion to `"pulled"` or `"none"`
  * `PromoteCommandResult.rebaseOutcome.status` is
    `"unexpected-commit-count"`
  * Exit code 1

### 3.6 Interactive confirmation prompt (no --json)
* Given
  * As §3.2, but invoked without `--json` and without `--confirm-rebase`
  * The test harness supplies a fake TTY/stdin answering `y` to the
    resulting prompt
* When - `pnpm task promote`
* Then -
  * A `y/N` prompt is shown before any rebase/push is attempted
  * `git.rebase(...)` and `git.push(...)` proceed only after the `y`
    answer, identically to §3.2's `--confirm-rebase` path
  * `PromoteCommandResult.action` is `"pulled-and-rebased"`
* Given - as above, but the fake stdin answers `n` (or provides no input)
* When - `pnpm task promote`
* Then -
  * `git.rebase(...)` and `git.push(...)` were **not** called
  * `PromoteCommandResult.action` is `"none"`
  * Exit code 1

**Note for whoever picks this chunk up:** this section assumes the test
harness can simulate a TTY/stdin answer. If it can't yet, that's a real
harness gap to raise before writing this section's tests — don't quietly
skip the interactive path or substitute a second `--confirm-rebase`-mode
assertion in its place; §3.3 already covers that mode.
