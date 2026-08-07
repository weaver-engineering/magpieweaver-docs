# Task MAG-49 — `promote`'s `build::ready -> pr-raised` action

**State:** Not started
**Phase:** spec
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
- No existing test modified; no new `GitTool` primitives added.
- Real e2e verification against a disposable git fixture (bare origin +
  clone) before merge — same discipline as every prior `promote` action.

## 6. Notes For The Agent

- None yet.
