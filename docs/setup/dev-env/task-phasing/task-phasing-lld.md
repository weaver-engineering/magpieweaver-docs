# Low Level Design - Task Phasing System

## Context

- [Glossary](../../../glossary.md) - Glossary of terms.
- [About Magpie Weaver](../../../magpie-weaver.md) - Background reading about Magpie Weaver.
- [High Level Design](../../../architecture/high-level-design.md) - Magpie Weaver high level design.
- [Architecture Definition](../../../architecture/architecture-definition-document.md) - Magpie Weaver Architecture.
- [Gate Checks Design](../gate-checks/gate-checks-lld.md) - Low level design for the phase gate checks.

## 1. System Details

### 1.1 Overview

`task-phases` is a `pnpm` CLI (`pnpm task <cmd> ...`) that assists — but
does not replace — the agent/architect working the Spec → Test → Build
phase model defined in the Architecture Definition Document (Guard Rails
§1, Branching Strategies). It is deliberately **not** a general git/PR
automation tool. Creating ordinary work commits is out of scope entirely —
that's bread-and-butter development activity.

What it owns is the repetitive, error-prone bookkeeping around phase
transitions: working out where a task currently sits, whether it's
genuinely ready to move on, and — if so — performing the mechanical
branch/PR actions to move it there. It holds **no stored phase state of
its own**: a task's phase is always derived — from GitHub's own merge
status for completed gate transitions, and from commit ancestry only for
detecting an amended-and-not-yet-rebased earlier phase — never a field
written to a doc or a database (§3).

For a given task it:

1. Determines the task's reference (`{ref}`) — explicit `--ref`, or
   inferred from the current branch.
2. Fetches from origin, then derives the task's current phase from which
   of `spec/{ref}` / `test/{ref}` / `build/{ref}` / `task/{ref}` exist,
   which destination-gate PRs `gh` confirms as merged, and — separately —
   whether an earlier phase has been amended since a later one forked
   from it (§3.2–§3.4).
3. Detects whether the relevant branch is paused (`WIP`) or mid-edit.
4. Derives a `PhaseState`, invoking the corresponding check from
   `@magpieweaver/gate-check` (an in-repo library dependency, not a
   subprocess) where a state needs confirming.
5. On `ready`, performs the mechanical action for that phase transition
   (`promote`); on `blocked`, relays the gate check's own failure reasons
   directly rather than inventing its own diagnostic text.

`task-phases` never merges a PR. Every gate requiring human review (Build
Gate, Main Gate) stops, by design, at "PR opened." Its tracked scope ends
at merge into `main` — the subsequent push to `uat` and PR to production
are pure CI/CD and outside this tool entirely.

### 1.2 Component Layout

```
packages/task-phases/
  cli.ts                  # argv parsing + dispatch only
  types.ts                # shared types (TaskRef, Phase, TaskState, ...)
  registry.ts              # subcommand name -> handler; cli.ts dispatches
                           # through this so new commands don't touch cli.ts
  commands/
    init.ts                # pnpm task init <ref> [--quick] ...
    status.ts               # pnpm task status [--ref <ref>]
    list.ts                  # pnpm task list
    promote.ts                # pnpm task promote [--ref <ref>] [--confirm-rebase]
    wip.ts                     # pnpm task wip --ref <ref>
  lib/
    repo-state.ts             # fetch + gh merge-status + ancestry staleness
                              # -> {ref, phase}; WIP detection
    gate-check.ts               # typed wrapper around @magpieweaver/gate-check,
                                # mapping Phase -> the correct check function
    git.ts                       # branch create/checkout/push/rebase primitives,
                                 # used only by init and promote's ready path
    gh.ts                         # PR creation + merged-PR lookup — the sole
                                  # merge-detection mechanism, used at both
                                  # test->build and the final Main Gate
    task-doc.ts                   # task-{ref}.md / task-{ref}-NN-spec.md
                                  # template scaffolding and spec-chunk import
                                  # (parked for detailed design — see §3)
```

`@magpieweaver/gate-check` is a workspace dependency (`workspace:*`),
imported directly. `task-phases` has no gate-validation logic of its own —
every pass/fail judgment comes from that package.

## 2. Interfaces

```typescript
// types.ts

type TaskRef = string; // matches /^[A-Z]+-[0-9]+$/

type Phase = "spec" | "test" | "build" | "quick";

// Phase-local state
type PhaseState =
  | "not-started"   // this phase's branch exists, but carries no commits
                     // beyond what it inherited from its parent
  | "work-in-progress"
  | "ready?"         // pending gate-check resolution
  | "ready"
  | "blocked"
  | "awaiting-pr"    // gh confirms an open (unmerged) destination-gate PR;
                     // attached to the SOURCE phase of that PR, not a new
                     // Phase (§3.4) — promote is a safe, idempotent no-op
                     // in this state, on the canonical branch
  | "merged-pending-cleanup"; // gh confirms the Main Gate PR merged; only
                     // `promote` acts on this (branch deletion, §3.6) —
                     // `status`/`list` report it read-only

// Task-level state — "not-initialised" only applies before any branch
// exists at all; every other value is a PhaseState for the derived phase
type TaskState = "not-initialised" | PhaseState;

interface TaskStatus {
  ref: TaskRef;
  phase: Phase | null;        // null iff state === "not-initialised"
  canonicalBranch: string | null;  // the branch this phase/state authority
                                   // is derived against (§3.4)
  currentBranch: string | null;    // what's actually checked out locally
  branchMismatch: boolean;         // currentBranch !== canonicalBranch —
                                   // promote refuses to act while true (§3.4)
  state: TaskState;
  gate?: {
    name: string;              // "test-gate" | "build-gate" | "main-gate"
    enforced: boolean;         // false only for spec/{ref} -> test/{ref}
    result?: GateCheckResult;
  };
}

// Placeholder narrowing of @magpieweaver/gate-check's real return type —
// to be confirmed against that package before implementation.
interface GateCheckResult {
  ok: boolean;
  checks: Array<{ id: string; passed: boolean; detail?: string }>;
}
```

```
# CLI surface

pnpm task init <ref> [--quick] [--title <title>] [--doc <path>] [--spec <path>...] [--json]
pnpm task status [--ref <ref>] [--json]
pnpm task list [--json]
pnpm task promote [--ref <ref>] [--confirm-rebase] [--json]
pnpm task wip --ref <ref> [--json]
```

`--ref` is optional on `status`/`promote`/`wip` when run from within a task
branch — inferred from the current branch name. `--json` is supported on
every command, mirroring `gate-check`'s existing convention.

## 3. Design Notes

### 3.1 Branch topology — fork model, not rename

`spec/{ref}`, `test/{ref}`, and `build/{ref}` are created as **forks**
(each branching from its parent's HEAD at the point of promotion), not as
successive renames of a single branch. All three (or, on the quick route,
just `task/{ref}`) stay alive simultaneously for the life of the task.

This is a deliberate reversal of an earlier draft of this design, which
modelled spec→test as a rename. A rename destroys the earlier branch
object, which is incompatible with amending an earlier phase and rolling
the change forward (§3.4) — there would be nothing left to amend. "Only
one branch per task" is therefore **not** a literal git constraint; it's a
statement about what's authoritative for phase derivation (§3.2) — the
furthest-forward branch reachable from the task's history, not a claim
that earlier branches don't exist.

Branches are deleted **only once**, together, when the task's Main Gate PR
merges (§3.5) — never incrementally as each intermediate PR merges.

### 3.2 Phase derivation — merge-status first, ancestry only for staleness

There is no stored "current phase" anywhere — not in `task-{ref}.md`, not
in any tool-owned file. Phase is derived fresh, every time, from two
distinct kinds of check, deliberately kept separate:

- **"Did the destination-gate PR merge?"** — answered via `gh pr list
  --state merged`, never by comparing commit SHAs or ancestry. This is
  the only reliable mechanism regardless of which merge method was used
  on GitHub (merge commit, squash, or rebase) — see §3.3 for why ancestry/
  SHA-equality approaches were rejected here.
- **"Has an earlier phase been amended since a later phase forked from
  it?"** — a genuinely different question, entirely about the tool's own
  branches relative to each other, never about a GitHub-mediated merge.
  This one *is* answered with ancestry (`git merge-base --is-ancestor`),
  per §3.4, because it's checking the tool's own fork relationships, not
  a PR's merge state.

- **"Is a destination-gate PR currently open, awaiting human review?"** —
  also answered via `gh` (`gh pr list --state open`), checked immediately
  alongside the merged check. This produces the `awaiting-pr` `PhaseState`
  (§2), attached to the **source** phase of that PR, not a new `Phase` of
  its own — see §3.4.

```
git fetch origin   // always, before deriving anything

if gh reports a MERGED PR: (build/{ref} or task/{ref}) -> main
     -> merged-pending-cleanup (see 3.3, 3.6)
else if gh reports an OPEN PR: (build/{ref} or task/{ref}) -> main
     -> phase = build (or quick); state = awaiting-pr
else if gh reports a MERGED PR: test/{ref} -> build/{ref}
     -> phase = build
        (sync local build/{ref} to origin/build/{ref} if behind — 3.3)
else if gh reports an OPEN PR: test/{ref} -> build/{ref}
     -> phase = test; state = awaiting-pr
else if test/{ref} exists
     -> phase = test
        (ancestry check against spec/{ref} — staleness only, 3.5)
else if spec/{ref} exists
     -> phase = spec
else if task/{ref} exists
     -> phase = quick
else
     -> not-initialised
```

Each ancestry check is `git merge-base --is-ancestor <parent-HEAD>
<child-HEAD>`. This is what makes amending an earlier phase safe and
self-describing: if `spec/{ref}` is amended and `test/{ref}` is never
rebased onto the new commit, the "spec is ancestor of test" check fails,
derivation falls straight through to `phase = spec`, and `test/{ref}`
simply isn't consulted — it's not flagged as broken or blocked, it's just
not currently on the authoritative path. No separate `stale` state is
needed; ancestry already encodes it.

### 3.3 Merge detection: always via `gh`, never via SHA/ancestry

**Every "did the destination-gate PR merge?" check uses `gh pr list --head
<branch> --base <branch> --state merged --json number,mergedAt`, for both
merge points (`test/{ref}` → `build/{ref}`, and `build/{ref}`/`task/{ref}`
→ `main`).** This was not the original design — an earlier draft assumed
`test/{ref}` → `build/{ref}` merges could be detected via `merge-base
--is-ancestor` (or literal SHA equality), reasoning that this merge stays
outside the squash step and so should preserve ancestry.

That assumption was dropped after checking GitHub's actual merge options:
GitHub's PR merge UI/API offers three methods — merge commit, squash, and
rebase — and **none of them is a true fast-forward that preserves the
source branch's original commit objects.** "Rebase and merge" looks
closest, but it replays commits onto the target as *new* commit objects
(new SHAs, same tree content), so even it breaks an ancestry check against
the original `test/{ref}` commits. Forcing a genuine FF-only merge is
possible but only via third-party GitHub Actions or manual CLI
intervention outside the merge button — not a native repo setting — which
would make the gate's own reliability depend on whoever clicks the merge
button also correctly using an unusual, unenforced workflow. That's a
worse failure mode than the problem it would solve: a single ordinary
merge-commit click would silently leave the phase-detection logic unable
to see the merge at all, with no natural error surfaced — exactly the
"needs retrospective branch/commit cleaning" scenario this design is meant
to avoid causing.

`gh`-based detection sidesteps this entirely: it never compares commit
SHAs, so it's correct regardless of which merge method was actually used.
This is now the **only** merge-detection mechanism in the tool. Ancestry
(`merge-base --is-ancestor`) is reserved exclusively for the staleness
check in §3.4 — a question about the tool's own fork relationships, never
about a GitHub-mediated merge, so it isn't affected by any of the above.

**Automatic vs. gated actions on detection:**

- **`test/{ref}` → `build/{ref}` merged:** non-destructive — either
  creating local `build/{ref}` for the first time (tracking
  `origin/build/{ref}`) or fast-forwarding it. This runs automatically as
  part of the fetch-then-derive step **every** command performs (`status`,
  `list`, `promote`, `wip`'s ref check) — no confirmation needed, since
  nothing can be lost and accurately answering "what state is this task
  in" requires it regardless of which command was invoked.
- **`build/{ref}`/`task/{ref}` → `main` merged:** `status`/`list` report
  this read-only, as `merged-pending-cleanup` (§2). The actual cleanup
  (branch deletion, §3.5) is destructive enough that it stays `promote`-
  only — but unlike rebase-forward (§3.4), it runs **without** requiring
  `--confirm-rebase` or a prompt: once the change is confirmed merged into
  `main`, nothing is lost by deleting the now-fully-absorbed branches, so
  there's no equivalent risk to gate against.

### 3.4 Canonical branch and the branch/phase mismatch guard

**`task-phases` never treats "which branch is currently checked out" as
evidence of phase.** Phase and state are derived purely from `gh` (§3.2/
§3.3) and, for staleness, ancestry (§3.5) — never from local checkout.
Each derived `(phase, state)` has a **canonical branch**
(`spec/{ref}` / `test/{ref}` / `build/{ref}` / `task/{ref}`, per phase).
`repo-state.ts` also records the branch actually checked out locally, and
flags `branchMismatch: true` whenever it differs from the canonical
branch.

This is what actually prevents the scenario of an agent checking out
`build/{ref}` and implementing directly against it while the real Build
Gate PR (from `test/{ref}`) is still open, unreviewed — a real concern
independent of, and in addition to, GitHub branch protection already
blocking a direct push to `origin/build/{ref}` without a reviewed PR from
`test/{ref}` specifically (per the branching doc; that protection is a
hard prerequisite this whole design depends on, not something
`task-phases` itself enforces).

Concretely: if `gh` shows the Build Gate PR still open, derivation reports
`phase = test, state = awaiting-pr` — regardless of the agent sitting on
`build/{ref}` with new local commits. `promote`, seeing `currentBranch !=
canonicalBranch`, **refuses to act at all** (no fork, no PR, no cleanup)
and reports the mismatch directly — e.g. *"you're on `build/{ref}`, but
this task is `test`/`awaiting-pr`, pending review of PR #N"* — rather than
silently no-op'ing in a way that could read as "nothing to do here."

**What `awaiting-pr` does and doesn't require of the agent while a PR is
open, on the correct (canonical) branch:**
- Amending the existing test-scoped commit (still test-only, still one
  commit) keeps the PR open and current automatically — GitHub tracks
  pushes to the PR's head branch live. `task-phases` takes **no special
  action** here; this is ordinary git push, already out of scope per §1.1.
  `promote`, called again in this state, simply re-reports `awaiting-pr`
  (with the PR's current number/URL) — it's a safe, idempotent no-op, not
  a "did nothing" ambiguity, precisely because it's explicit about why.
- Starting to *implement* on `test/{ref}` instead of writing tests
  violates that branch's own scope rule (test-only files) — this fails
  the Build Gate's structural check the moment a PR/promote re-evaluates
  it, independent of the mismatch guard above.
- Switching to the correct branch (`build/{ref}`) *after* the PR
  genuinely merges is the only path `promote` will actually act on for the
  next step — matching the ordinary, intended flow.

### 3.5 Amending an earlier phase and rolling forward

If `spec/{ref}` is amended after `test/{ref}` already forked from it,
derivation (§3.2) correctly reports `phase = spec` again — but
`test/{ref}` already exists, just now orphaned relative to the new `spec`
HEAD. `promote`, on finding itself in this exact situation (derived phase
is `spec`, but `test/{ref}` already exists), must rebase `test/{ref}` onto
the new `spec/{ref}` HEAD in place, then force-push it — rather than
either deleting-and-recreating it (which would discard any real
test-phase-specific commits already on it) or refusing outright.

This is judged safe **specifically because** branch-lifecycle discipline
is strict elsewhere in this design: `test/{ref}` can only ever have been
created by `init`/`promote` itself, forked from `spec/{ref}` at some prior
HEAD — so its existence in this state is proof it's a legitimate,
rebase-able descendant, not an unrelated branch someone created by hand.
`promote` still verifies this rather than assuming it blindly: before
rebasing, it confirms `git merge-base <old-spec-HEAD> test/{ref}` actually
resolves to a commit on `spec/{ref}`'s prior history, turning "this must be
true given our discipline" into "this is confirmed true" before rewriting
anything.

Because this is the sharpest action `promote` performs (a force-push,
rewriting a branch's history), it requires explicit confirmation, via two
different mechanisms depending on how the tool is being run:

- **Interactive (no `--json`):** prompt `y/N` before rebasing and
  force-pushing.
- **Agent / `--json` mode:** no prompt is possible, so the caller must
  supply `--confirm-rebase` up front. If `promote` determines a rebase is
  required and this flag is **not** present, it refuses and reports that a
  rebase is required — it neither performs the rebase silently nor blocks
  with an unexplained failure.

The same rebase-forward logic applies one level up if `test/{ref}` is
amended after `build/{ref}` has already forked from it.

### 3.6 Final cleanup — only at Main Gate merge

Branches are retained through every intermediate transition specifically
to keep the amend-and-roll-forward flow in §3.5 possible. Cleanup is a
single event, triggered only once `promote` (via the `gh`-based check in
§3.3) detects the task's Main Gate PR has merged:

1. `git fetch origin`.
2. Delete `spec/{ref}`, `test/{ref}`, `build/{ref}` (or, on the quick
   route, `task/{ref}`) — whichever exist — both locally and on `origin`.
3. Report the task as done. No further branch exists for this ref;
   subsequent `status`/`list` calls against it report `not-initialised`
   should the ref ever be reused, though re-use isn't itself designed for
   here.

Everything past this point — the push to `uat`, and the `uat` → `main`
(production) PR — is CI/CD automation outside `task-phases`'s tracked
scope, per §1.1.

### 3.7 Gate naming, enforcement, and required merge methods

Gates are named `<destination>-gate`:

| From | To | Gate | Externally enforced (branch protection)? |
|---|---|---|---|
| `spec/{ref}` | `test/{ref}` | `test-gate` | No |
| `test/{ref}` | `build/{ref}` | `build-gate` | Yes |
| `build/{ref}` | `main` | `main-gate` | Yes |
| `task/{ref}` | `main` | `main-gate` | Yes (same gate, different inbound-commit-count validation) |

`main-gate` rejects any PR whose source isn't `build/{ref}` or
`task/{ref}`.

**`test-gate`'s lack of external enforcement is exactly why `promote` must
enforce it itself.** Nothing at the git/GitHub level stops the spec→test
transition from happening regardless of test-phase readiness — no branch
protection rule covers it. If `promote` treated a `blocked` `test-gate`
result as advisory-only and proceeded anyway, `task-phases` itself would
be the gap in the guard rail. So: `promote` **blocks** on a failing
`test-gate` result exactly as it does for `build-gate`/`main-gate` — the
only sense in which `test-gate` is "not enforced" is that GitHub itself
isn't the one enforcing it; this tool is.

**Required GitHub configuration: the Build Gate PR (`test/{ref}` →
`build/{ref}`) must be merged via "Squash and merge" only** — "Create a
merge commit" and "Rebase and merge" disabled for this transition (a
repo/branch-level setting). This is required, not merely preferred:
`test/{ref}` has exactly one commit unique relative to `build/{ref}`'s
fork point (both fork from the same `spec/{ref}` HEAD), so squash merge
produces exactly one resulting commit on `build/{ref}` — giving `spec,
test-equivalent` (2 commits) before build work starts, and `spec, test,
build` (3 commits) once it does, matching the Test Gate's expected
3-commit structure with no change to `gate-check` itself. A merge-commit
merge would instead leave 4 commits (spec, test, merge, build) and break
that check. The one manual discipline this asks of whoever merges the PR:
set the squash commit's message to start with `{ref}` — if they don't,
the next gate check fails cleanly on the commit-message-format rule, fixed
simply by editing the commit message and re-running the check (a clean,
recoverable failure, not a blockage requiring history surgery).

**Also required: standard branch protection on every gate-destination
branch** (no direct pushes; PR required from the specific source branch
named in the table above; required status checks; required review) — per
the branching doc's own branch definitions. This is the actual backstop
against an agent bypassing genuine human review of test-phase content by
committing directly to a later-phase branch (§3.4); `task-phases` depends
on this being configured correctly, and cannot itself enforce it.

### 3.8 `task wip`

```
pnpm task wip --ref <ref> [--json]
```

Packs away in-progress work on the ref's current phase branch so it reads
unambiguously as paused rather than abandoned mid-edit:

1. Resolve `{ref}` → current phase branch (via §3.2 derivation).
2. If the worktree is clean (nothing staged, nothing modified) **the
   command fails** — there is nothing to pack away, and it does not
   manufacture an empty commit to force a WIP marker into existence.
3. Otherwise, stage everything and commit with title `{ref} WIP` (the
   literal substring `WIP` in the title is the recognised marker — see the
   WIP convention below), then push.

**WIP marker convention:** a branch is considered `work-in-progress`
(paused, not simply mid-edit and forgotten) when the literal substring
`WIP` appears anywhere in HEAD's commit title — e.g. `AAA-000 WIP` is a
valid marker. This is an exact string match, checked by `repo-state.ts` as
part of phase-state derivation, not a prefix/suffix convention.

### 3.9 Parked items (unchanged from prior revision)

- **Chunked specs** (`task-{ref}-00-spec.md`, `-01-spec.md`, ...) and how
  they interact with concurrent-branch state — acknowledged as relatively
  likely in practice, but not designed. `TaskRef`/`TaskStatus` carry no
  chunk field yet.
- **Concurrency** — an `init` target whose branch has genuinely unmerged
  commits blocks outright, with no override flag, until this is designed.
- **`lib/task-doc.ts`** — scaffolding/import behaviour confirmed valuable,
  template format and prompt flow not yet specified.
- **CLI surface stability** — expected to change as real pinch points
  surface in use; nothing above is being treated as locked.

## 4. Component Details

### 4.1 `cli.ts`
Parses argv into a subcommand name + flags only; performs no branch/gate/
git logic itself. Dispatches via `registry.ts`.

### 4.2 `types.ts`
Defines `TaskRef`, `Phase`, `PhaseState`, `TaskState`, `TaskStatus`, and the
placeholder `GateCheckResult` (to be reconciled against
`@magpieweaver/gate-check`'s real exported types before implementation).

### 4.3 `registry.ts`
Exports `commandRegistry: Record<string, CommandHandler>` mapping `init`,
`status`, `list`, `promote`, `wip` to their handlers. Adding a command
means adding one file under `commands/` plus one entry here.

### 4.4 `commands/*.ts`
- `status.ts` / `list.ts` — run the fetch → merge-status/open-PR/ancestry-
  derive → gate-check pipeline (§3.2–§3.3) and report `TaskStatus`
  (including `branchMismatch`, §3.4) without acting on it. `list.ts` does
  this across every ref with an active branch; `status.ts` for one ref
  (explicit or inferred).
- `promote.ts` — runs the same pipeline and acts on the result:
  - `branchMismatch` → refuses to act on anything else below; reports the
    mismatch (§3.4).
  - `awaiting-pr` → no action; re-reports the open PR (§3.4) — safe,
    idempotent.
  - `ready` → performs the phase's mechanical action (branch fork, or PR
    open via `lib/git.ts`/`lib/gh.ts`), per §3.7's table.
  - phase is `spec` but `test/{ref}` already exists (§3.5) → rebase +
    force-push, gated on `--confirm-rebase` or an interactive prompt.
  - `blocked` → no git/gh action; relays `gate-check`'s own `checks[]`.
  - `merged-pending-cleanup` (§3.3, §3.6) → performs final cleanup.
- `init.ts` — implements the existing-ref decision tree (doc exists? /
  branch exists? / branch merged?) from the prior revision, using
  `lib/task-doc.ts` and `lib/git.ts`. The "branch exists with unmerged
  commits" cell remains a hard, unconditional block (§3.9).
- `wip.ts` — implements §3.8.

### 4.5 `lib/repo-state.ts`
Fetches `origin`; derives phase via `lib/gh.ts`'s merge-status and open-PR
checks first (§3.2/§3.3), falling back to branch existence, then runs the
ancestry staleness check (§3.5) against whichever phase is derived; also
computes the canonical-vs-current branch mismatch (§3.4). Detects the WIP
marker (§3.8) and dirty-worktree state to distinguish `not-started` /
`work-in-progress` from a state requiring gate-check resolution. Also
performs the automatic, non-destructive local-branch sync (§3.3) as part
of this same step.

### 4.6 `lib/gate-check.ts`
Thin typed wrapper importing `@magpieweaver/gate-check` directly as a
library dependency. Maps `Phase` to the correct exported check function for
that phase's destination gate, per §3.7. Return-type mapping to be
confirmed against the real package before implementation.

### 4.7 `lib/git.ts`
Branch create/checkout/push/rebase primitives. Used by `init` (branch
creation), `promote`'s `ready` path (fork creation ahead of a PR), and
`promote`'s rebase-forward path (§3.5). Never used to create ordinary work
commits.

### 4.8 `lib/gh.ts`
Wraps `gh pr create` (opening destination-gate PRs) and `gh pr list
--state merged`/`--state open` — the **sole** merge/PR-status detection
mechanism in the tool, used for both `test/{ref}` → `build/{ref}` and the
final Main Gate transition (§3.3), deliberately never via SHA/ancestry
comparison, since no GitHub merge method reliably preserves either. Never
performs a merge itself.

### 4.9 `lib/task-doc.ts`
Owns `task-{ref}.md` / `task-{ref}-NN-spec.md` scaffolding and the
new-chunk `--spec` import path used by `init`. Detailed design parked
(§3.9).
