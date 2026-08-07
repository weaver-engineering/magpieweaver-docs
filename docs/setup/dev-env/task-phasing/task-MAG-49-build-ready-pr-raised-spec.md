# Task MAG-49 - `promote`'s `build::ready -> pr-raised` action

**Companion to:** `task-MAG-49.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/promote/build-ready.test.ts` —
matches the existing per-action file layout `promote/cleaned-up.test.ts`
already established (`task-MAG-46-test-file-layout-design.md`).

## 1. Interface Under Test
`pnpm task promote [--json]`, specifically the `taskStatus.state ===
"ready" && taskStatus.phase === "build"` case — currently unhandled,
falling through to `promote.ts`'s final `throw new Error("not
implemented")` — against injected `git`/`github`/`gateChecks` test
doubles. Reuses the derivation pipeline already proven since spec 04 and
the `createBranch`/`push`/`checkout`/`github.createPR` primitives already
proven by `spec::ready -> forked` (spec 10) and `test::ready`/
`quick::ready -> pr-raised` (specs 11/11.01).

## 2. Deliverable
Once `build/{ref}`'s derived state resolves `ready` (the build gate
passes against the local worktree's own commits — no push required
first, matching `main-gate.ts`'s existing local-`build/{ref}`-equals-
`ready/{ref}` self-verification design), `promote` creates `ready/{ref}`
from `build/{ref}`'s current HEAD, pushes it, and raises the Main Gate PR
(`ready/{ref}` -> `main`) — then restores the starting branch
(`build/{ref}`), per the branch-restoration invariant every other fork
action already follows. Trunk drift on the build phase (`origin/build/
{ref}` advanced since local `build/{ref}` forked) surfaces as an ordinary
rebase-forward trigger, resolved the same way `spec`/`quick`'s already
do. A pre-existing `ready/{ref}` is either a safe-to-discard stale
attempt (recreated fresh) or already-merged history (refused cleanly) —
never silently overwritten without that check.

### 2.1 Deliverable Notes For Agent
- **No new phase, no new derivation logic.** `build`'s existing state
  machinery (`lib/repo-state.ts`'s `deriveState`, parent
  `origin/build/{ref}`) already produces `not-started`/`ready?`/
  `work-in-progress`/`ready` correctly the moment commits exist locally
  on `build/{ref}` — confirm this rather than re-deriving it; do not add
  a `ready`-phase concept anywhere.
- **No new `GitTool` primitives.** `createBranch(newBranch, from)`,
  `push(branch)`, `checkout(branch)`, and `github.createPR(base, head,
  opts)` already exist and are already used by `spec::ready -> forked`
  and `test::ready`/`quick::ready -> pr-raised` — this action is a
  straightforward composition of primitives already proven, not new
  surface.
- **Model this closer to `quick::ready -> pr-raised` than
  `test::ready`'s version.** `test::ready` first checks whether
  `build/{ref}` exists on origin and creates it fresh from `origin/main`
  if not (nothing earlier in that workflow creates it). This chunk's
  destination (`main`) always exists, same as `quick::ready` — the only
  step neither template needs is creating `ready/{ref}` itself, carrying
  `build/{ref}`'s actual accumulated commits (not an empty branch off
  `origin/main`).
- **Trunk drift reuses the existing rebase-forward mechanism wholesale**
  (`task-MAG-49.md` §3, correction) — widen `lib/repo-state.ts`'s
  trunk-drift trigger (`else if (phase === "spec" || phase === "quick")`)
  to also cover `phase === "build"`, with `trunk = origin/build/{ref}`
  for that case specifically (not `origin/main`, which is what `spec`/
  `quick` check against). Once `taskStatus.rebase` is populated,
  `promote`'s existing generic rebase-forward block (the one that already
  handles `--confirm-rebase`, conflict/unexpected-commit-count outcomes,
  force-push, and branch restoration) fires automatically — **do not**
  write new rebase-handling code inside the `build::ready` branch itself;
  it should never even be reached in the drifted case, since the generic
  block runs first and returns its own result. §3.4 below is a
  regression-style confirmation this reuse actually works for `build`,
  not new `promote.ts` logic beyond the one-line phase-check widening in
  `repo-state.ts`.
- **A pre-existing `ready/{ref}` needs one safety check before touching
  it** (`task-MAG-49.md` §3, correction): `isAncestor("origin/ready/
  {ref}", "origin/main")`. If true (already merged), refuse — `success:
  false`, `action: "none"`, no git mutation, clear message. If false (a
  stale, unmerged leftover — the old raw-`git` workflow or an
  interrupted `promote` attempt), `deleteBranch("ready/{ref}")` first
  (tolerates partial local/remote state, same as `promote`'s existing
  cleanup action already relies on), then proceed through the normal
  §3.1 happy path unchanged — `createBranch`/`push`/`createPR` don't need
  to know whether they're running fresh or after a discard. This check
  only applies when `origin/ready/{ref}` exists at all; skip straight to
  §3.1 when it doesn't.
- **A `blocked` gate result needs no new code** — `promote.ts`'s existing
  `taskStatus.state === "blocked" && taskStatus.gate?.result` branch
  (checked *before* the final fallthrough) already handles this
  generically for every phase. §3.3 below is a regression-style
  confirmation that this generic branch is actually reached for `build`
  once your new `ready` branch is added above the fallthrough — not new
  behavior to implement.

## 3. Required Behaviors
* `build::ready` creates `ready/{ref}` from `build/{ref}`'s HEAD, pushes
  it, and raises the Main Gate PR against `main`.
* The starting branch (`build/{ref}`) is restored afterward.
* Trunk drift on the build phase (`origin/build/{ref}` advanced since
  local `build/{ref}` forked) surfaces as a rebase-forward trigger,
  resolved via the existing generic mechanism.
* A pre-existing, unmerged `ready/{ref}` is discarded and recreated
  fresh from current `build/{ref}`.
* A pre-existing `ready/{ref}` already merged into `main` is refused
  cleanly, never overwritten.
* A `blocked` build-phase gate result is relayed via the existing generic
  handling, not silently swallowed by the new code path.

### 3.1 build::ready creates ready/{ref}, pushes, and raises the Main Gate PR
* Given
  * `git.currentBranch()` returns `"build/AAA-123"`
  * `AAA-123`'s derived phase/state is `build`/`ready` (local
    `build/AAA-123` has a commit beyond `origin/build/AAA-123`; the
    build gate resolves it to `ready`)
  * `git.createBranch(...)`, `git.push(...)`, `git.checkout(...)`, and
    `github.createPR(...)` all resolve cleanly
* When - `pnpm task promote --json`
* Then -
  * `git.createBranch("ready/AAA-123", "build/AAA-123")` was called
  * `git.push("ready/AAA-123")` was called, after the branch creation
  * `github.createPR("main", "ready/AAA-123", { title: ... })` was
    called, after the push — the PR title names the ref and the
    `build::ready` promotion, matching the existing convention
    (`Task {ref}: promote {ref}::{phase}::ready to {destination} ({gate
    name})`)
  * `PromoteCommandResult.action` is `"pr-raised"`
  * `PromoteCommandResult.prNumber`/`prUrl` match what `createPR`
    resolved
  * Exit code 0

### 3.2 The starting branch is restored after raising the PR
* Given - as §3.1
* When - `pnpm task promote --json`
* Then -
  * `git.checkout("build/AAA-123")` was called last, after
    `createBranch`/`push`/`createPR` — `createBranch` itself checks the
    new branch out (`git checkout -b`), so an explicit restore is
    required, same as `spec::ready -> forked`'s existing precedent
  * A re-derived `status` immediately afterward would report
    `currentBranch: "build/AAA-123"` (not asserted via a second command
    in this test — asserting the `checkout` call directly is sufficient,
    matching how `spec::ready -> forked`'s own test asserts this)

### 3.3 A blocked build-phase gate result is relayed, not swallowed
* Given
  * `git.currentBranch()` returns `"build/AAA-123"`
  * `AAA-123`'s derived phase/state is `build`/`ready?`, and
    `resolveReady()` resolves it to `blocked` with a real gate violation
* When - `pnpm task promote --json`
* Then -
  * No git mutation of any kind occurs (`createBranch`/`push`/
    `checkout`/`createPR` are throw-mocks for this case)
  * `PromoteCommandResult.action` is `"none"`
  * `PromoteCommandResult.violation` carries the gate's own violation
    text verbatim
  * Exit code 0 (a successfully-determined `blocked` result is a
    successful invocation, per the existing generic handling's own
    precedent)

### 3.4 Trunk drift on the build phase resolves via the existing rebase-forward mechanism
* Given
  * `git.currentBranch()` returns `"build/AAA-123"`
  * Local `build/AAA-123` has a commit beyond its own fork point, but
    `origin/build/AAA-123` has since advanced past that fork point too
    (a second Build Gate PR merged cleanly while this session was open)
    — `git.isAncestor("origin/build/AAA-123", "build/AAA-123")` resolves
    `false`
* When - `pnpm task promote --confirm-rebase --json`
* Then -
  * `git.rebase("build/AAA-123", "origin/build/AAA-123")` was called —
    the same generic rebase-forward path `spec`/`quick` already use, not
    new logic reached via the `build::ready` branch
  * On a clean outcome, `git.push("build/AAA-123", { force: true })` was
    called and the starting branch was restored
  * `PromoteCommandResult.action` is `"rebased"`, not `"pr-raised"` — a
    second, separate `promote` call is required afterward to actually
    raise the PR, same two-call pattern `spec::ready`'s own stale-test
    case already has
  * Without `--confirm-rebase`, no git action occurs at all and the
    result names the required flag — the existing generic refusal
    contract, asserted here only to confirm it now fires for `build` too

### 3.5 A pre-existing, unmerged ready/{ref} is discarded and recreated
* Given
  * `git.currentBranch()` returns `"build/AAA-123"`
  * `AAA-123`'s derived phase/state is `build`/`ready`, as in §3.1
  * `origin/ready/AAA-123` already exists (a stale leftover) and
    `git.isAncestor("origin/ready/AAA-123", "origin/main")` resolves
    `false` — not yet merged
* When - `pnpm task promote --json`
* Then -
  * `git.deleteBranch("ready/AAA-123")` was called before
    `git.createBranch("ready/AAA-123", "build/AAA-123")`
  * `git.push("ready/AAA-123")` and `github.createPR("main",
    "ready/AAA-123", ...)` were called afterward, exactly as in §3.1 —
    the discard doesn't change anything about the happy-path tail
  * `PromoteCommandResult.action` is `"pr-raised"`, same shape as §3.1
  * Exit code 0

### 3.6 A pre-existing ready/{ref} already merged into main is refused, never overwritten
* Given
  * `git.currentBranch()` returns `"build/AAA-123"`
  * `AAA-123`'s derived phase/state is `build`/`ready`, as in §3.1
  * `origin/ready/AAA-123` already exists and
    `git.isAncestor("origin/ready/AAA-123", "origin/main")` resolves
    `true` — its content is already part of `main`'s history
* When - `pnpm task promote --json`
* Then -
  * No git mutation of any kind occurs (`deleteBranch`/`createBranch`/
    `push`/`checkout`/`createPR` are throw-mocks for this case)
  * `PromoteCommandResult.success` is `false`, `action` is `"none"`
  * The message clearly explains why: `ready/{ref}` already exists and
    is already merged into `main`
  * Exit code 1
