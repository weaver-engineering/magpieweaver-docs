# Task MAG-49 — `promote`'s `build::ready -> pr-raised` action

**State:** Complete
**Phase:** merged to main (2026-08-07) — [PR #155](https://github.com/weaver-engineering/magpie-weaver/pull/155) (quick-route prerequisite), [PR #156](https://github.com/weaver-engineering/magpie-weaver/pull/156) (test), [PR #157](https://github.com/weaver-engineering/magpie-weaver/pull/157) (build, Main Gate)
**Component:** Development tooling (`task-phases`)
**Depends on:** MAG-46 (`task-phases` itself — complete)
**Related design docs:**
- [`task-phasing-lld.md`](task-phasing-lld.md) — the task-phasing
  system's LLD. This chunk extends `promote`'s action set; it doesn't
  redesign anything the LLD already describes.
- `packages/gate-checks/src/checks/main-gate.ts` (code repo) — already
  treats a local, unpushed `build/{ref}` as equivalent to `ready/{ref}`
  for self-verification purposes. This chunk's whole design leans on
  that existing, already-shipped behavior rather than introducing a new
  one.

---

## 1. Summary

`promote.ts` implements a `*::ready -> forked`/`pr-raised` action for
every phase except `build`. This is that missing action: once
build-implementer's local `build/{ref}` resolves `ready` (the build gate
passes), `promote` creates `ready/{ref}` from it, pushes, and raises the
Main Gate PR — the exact gap the code's own fallthrough comment names:
*"the test->build / build->main ready hops belong to a later chunk."*
This is that later chunk.

## 2. Why This Task, Why Now

Found while dogfooding `task-phases` to manage its own development
throughout MAG-46. `build-implementer`'s standing instructions currently
hand-manage `ready/{ref}` entirely in raw `git` — creation at session
start, a base-still-current check, a commit transplant on drift —
because `promote` has no action for it and the derivation pipeline has
no concept of `ready/{ref}` at all.

`main-gate.ts` already anticipated a simpler design than what the
standing instructions actually do: it explicitly accepts a local,
unpushed `build/{ref}` as equivalent to `ready/{ref}` for self-
verification —

> "The full route's Main Gate PR is raised from `ready/{ref}` (created
> off `build/{ref}` once the build commit is ready), not from
> `build/{ref}` itself... This same check runs locally too, as the
> agent's own self-verification step, possibly before it has
> renamed/pushed `ready/{ref}` yet — so both names are accepted here as
> equivalent."

Building `promote`'s `build::ready` action around that existing,
already-shipped design means build-implementer can commit locally to
`build/{ref}` like every other phase, and `task-phases`'s existing state
machinery (`not-started`/`ready?`/`work-in-progress`/`ready` against
`origin/build/{ref}` as parent) just works — **no new phase, no new
derivation logic, no new `GitTool` primitives.** `createBranch`/`push`/
`checkout`/`github.createPR` already exist and are already used by the
other three `*::ready` actions.

## 3. In Scope

- `promote`'s new `build::ready -> pr-raised` action
  (`packages/task-phases/src/commands/promote.ts`), modeled on
  `quick::ready -> pr-raised` (raises the PR directly against an
  existing destination, no branch-existence dance) plus one step neither
  existing template needs: create `ready/{ref}` from local
  `build/{ref}`'s HEAD before pushing.
- The exact scope of what "resolves ready" means for the `build` phase
  under this new local-commits model, confirmed against
  `lib/repo-state.ts`'s existing `deriveState`/`resolveReady` — this
  should already work unmodified once commits land locally on
  `build/{ref}`, but confirm rather than assume (see working spec doc's
  Deliverable Notes).

  **Correction (2026-08-07, architect pre-handoff review):** it did
  *not* already work. `derivePrState`'s build-phase merged-PR branch
  (the code that decides between `merged-pending-pull` and this
  chunk's target `ready?`/`ready` derivation) used a plain `headSha`
  **equality** check on local vs `origin/build/{ref}`. That check
  cannot distinguish "local trails origin" (needs a plain pull) from
  "local carries its own commit(s) beyond origin" (build-implementer's
  ordinary workflow once this chunk lands — exactly the state
  `build::ready` needs to fire from) from "both sides moved
  independently since a shared fork point" (genuine trunk drift). Since
  any local commit makes the two heads differ, this permanently
  misclassified the second case as `merged-pending-pull` — making the
  build phase's `ready` state, and therefore this chunk's entire
  deliverable, structurally unreachable. Fixed in
  [PR #155](https://github.com/weaver-engineering/magpie-weaver/pull/155),
  landed as a quick-route `task/MAG-49` commit ahead of `spec/MAG-49`:
  replaced the equality check with a two-direction `git.isAncestor`
  comparison (verified against real git, not just mocks, before
  landing — see the PR description). Three already-merged test files'
  `isAncestor` mocks defaulted to an unconditional `true`, corrected
  with dated `**Correction:**` notes in each file's header
  (`status/merged-pending-pull.test.ts` §3.2, `status/fix.test.ts`
  §3.7, `promote/pulled-and-rebased.test.ts`'s shared default). No
  existing test's semantic assertions changed — only fixture
  direction-sensitivity. See the spec doc's own §2.1 correction for
  what this means for `spec/MAG-49`'s own required behaviors.
- **Trunk drift on the build phase** (`origin/build/{ref}` advancing
  after local `build/{ref}` was forked — e.g. a second Build Gate PR
  merging cleanly while build-implementer is mid-session). In scope
  (correction — see below), resolved by reusing the *existing*
  rebase-forward mechanism wholesale: `lib/repo-state.ts`'s trunk-drift
  trigger, currently scoped to `phase === "spec" || phase === "quick"`
  against `origin/main`, widens to also cover `phase === "build"`
  against `origin/build/{ref}`. `promote`'s already-existing generic
  rebase-forward handling (refuse without `--confirm-rebase`, rebase,
  force-push, restore branch) then just starts firing for `build` too —
  no new code in the `build::ready` action itself, and no new
  `GitTool` primitives.

  **Correction (2026-08-07, architect pre-handoff review):** the
  proposed widening location was wrong — `deriveRepoState`'s bottom
  `else if (phase === "spec" || phase === "quick")` block is
  unreachable for `build`, because `derivePhase()` (the function that
  produces the `phase` value that block switches on) only recognizes
  `test`/`spec`/`task` branch prefixes and never returns `"build"` at
  all; the build phase's state is always decided earlier, inside
  `derivePrState`'s own build-merged-PR branch. The trunk-drift trigger
  is now populated *there* instead, as part of the same
  [PR #155](https://github.com/weaver-engineering/magpie-weaver/pull/155)
  fix above — the two-direction `isAncestor` check that resolves
  ahead/behind naturally also resolves "neither is an ancestor of the
  other" as the divergence case, surfacing `taskStatus.rebase` via the
  same shape spec/quick already produce. The net effect described in
  this bullet (drift resolved by the existing generic rebase-forward
  handling, no new code in `build::ready` itself, no new `GitTool`
  primitives) is unchanged — only the internal wiring location moved.
- **A pre-existing `ready/{ref}`** (e.g. left over from the old raw-`git`
  workflow, or a previously-interrupted `promote` attempt). In scope
  (correction — see below): check whether `origin/ready/{ref}`'s current
  HEAD is already reachable from `origin/main` (`isAncestor`). If it is
  — already merged, touching it would clobber merged history — refuse
  cleanly, no git action. If it isn't, the existing content is a safe-to-
  discard stale attempt: `deleteBranch(ready/{ref})` then recreate fresh
  from `build/{ref}`'s current HEAD and push plainly. Same practical
  outcome as force-pushing (old content gone, replaced by current
  `build/{ref}`), but composed from primitives that already exist —
  `push()` only pushes a same-named local branch to its same-named
  remote, it has no refspec form for pushing local `build/{ref}`
  directly onto a differently-named remote `ready/{ref}`, so a literal
  force-push isn't available without a new/modified primitive; delete-
  then-recreate achieves the identical end state without one. Deleting
  the stale branch also auto-closes any stale open PR against it on
  GitHub, so the subsequent `createPR` call never collides with a
  leftover PR.

## 4. Explicitly Out Of Scope

- Updating `build-implementer`'s standing instructions
  (`.opencode/agent/build-implementer.md`) to actually use this action
  instead of its current raw-`git` steps. Real, valuable follow-up, but
  a separate change once this action exists and is verified for real —
  matches how `task-phases` changes and `.opencode/` agent updates have
  been sequenced as separate PRs throughout MAG-40/MAG-46.
- Any change to `main-gate.ts`'s existing `build/{ref}`-equals-
  `ready/{ref}` self-verification behavior — already correct, not
  touched here.
- Modeling `ready/{ref}` as a distinct derivable phase — deliberately
  not needed; `build`'s existing state machinery already covers this
  once commits land locally on `build/{ref}`.

## 5. Acceptance Criteria

- New system test(s) covering: `build::ready` (local `build/{ref}` has
  commits beyond `origin/build/{ref}`, gate resolves ready) ->
  `ready/{ref}` created from `build/{ref}`'s HEAD, pushed, PR raised
  against `main`, starting branch restored (§2.1's branch-restoration
  invariant), `action: "pr-raised"` reported.
- Trunk drift on the build phase surfaces as `taskStatus.rebase`, and
  `promote --confirm-rebase` resolves it via the existing generic
  rebase-forward path (`action: "rebased"`) — a subsequent `promote`
  call then completes the `build::ready -> pr-raised` action normally,
  same two-call pattern `spec::ready`'s own stale-test case already has.
- A pre-existing, unmerged `ready/{ref}` is discarded and recreated from
  current `build/{ref}`, pushed, and a fresh PR raised — verified for
  real that this doesn't collide with a stale open PR on the old branch.
- A pre-existing `ready/{ref}` whose content is already merged into
  `main` is refused cleanly — `success: false`, `action: "none"`, no git
  mutation of any kind, clear explanatory message.
- A `blocked` gate result for the build phase is relayed correctly —
  this is already handled generically by `promote.ts`'s existing
  `state === "blocked"` branch; a regression test confirming it still
  covers `build` is enough, no new logic expected.
- Fail-then-pass: the new test(s) fail against the current
  `throw new Error("not implemented")` fallthrough in `promote.ts`, pass
  unmodified once implemented.
- No existing test modified *by this chunk's own test/build phases*; no
  new `GitTool` primitives added. (Three existing test files' fixtures
  were corrected by the [PR #155](https://github.com/weaver-engineering/magpie-weaver/pull/155)
  prerequisite quick-route commit, raised (pending review/merge) ahead
  of `spec/MAG-49` — see §3's correction. That's the established
  pattern for existing-test fallout a chunk's own required behavior
  surfaces; it isn't test-writer's or build-implementer's own work to
  do.)
- Real e2e verification against a disposable git fixture (bare origin +
  clone) before merge — same discipline as every prior `promote` action.

## 6. Notes For The Agent

- The `build` phase's `ready?`/`ready` derivation and its trunk-drift
  detection are already fixed, in
  [PR #155](https://github.com/weaver-engineering/magpie-weaver/pull/155)
  (see §3's corrections) — merged into `main` before `spec/MAG-49` was
  forked, so it's already part of your branch's history.
  `lib/repo-state.ts`'s `derivePrState` already produces the correct
  `TaskStatus` (including `rebase` when drifted) for every scenario
  this chunk's acceptance criteria describe. You do not need to touch
  `repo-state.ts` at all; your work is entirely in `promote.ts`'s new
  `build::ready -> pr-raised` action, consuming that already-correct
  derivation exactly as `spec::ready -> forked` and
  `quick::ready -> pr-raised` already consume theirs.

## 7. Outcome (2026-08-07)

Task complete. Three PRs, in order:

- [PR #155](https://github.com/weaver-engineering/magpie-weaver/pull/155) —
  quick-route prerequisite, `task/MAG-49`. The `derivePrState` fix from
  §3's correction, landed ahead of `spec/MAG-49` per this project's
  discipline for existing-test fallout a chunk's own required behavior
  surfaces. 148/148 `task-phases` tests passing.
- [PR #156](https://github.com/weaver-engineering/magpie-weaver/pull/156) —
  test phase, `test/MAG-49` -> `build/MAG-49`. All 6 spec behaviors
  covered; architect review found and fixed an empty commit-message body
  on the spec commit mid-session (an architect defect, not the agent's).
- [PR #157](https://github.com/weaver-engineering/magpie-weaver/pull/157) —
  build phase, `ready/MAG-49` -> `main` (Main Gate). Real e2e-verified
  against a disposable ref in the sandbox repo: the happy path (creates
  `ready/{ref}` from `build/{ref}`'s real accumulated commit, pushes,
  raises a real PR, restores the starting branch) and the safety-critical
  already-merged refusal (a `ready/{ref}` that's a genuine ancestor of
  `main` is left completely untouched) both confirmed against real git
  state, not just the mocked test suite.

All phase branches (`spec/`, `test/`, `build/`, `ready/MAG-49`) cleared
down locally and on origin after the Main Gate merge.

**Open follow-up, not part of this chunk:** the user questioned during
PR #156's review whether `promote`'s generic blocked-relay branch should
really exit 0 — see `feedback`/`project` memory
(`project_promote_blocked_exit_code_followup`, architect's own session
memory) for the full reasoning. Cross-cutting across all four
`*::ready` actions, deferred, no Linear ticket filed yet.
