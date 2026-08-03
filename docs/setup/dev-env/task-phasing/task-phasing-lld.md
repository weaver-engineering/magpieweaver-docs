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
   from it (§3.2–§3.5).
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
  registry.ts             # subcommand name -> handler; cli.ts dispatches
                          # through this so new commands don't touch cli.ts
  commands/
    init.ts               # pnpm task init <ref> [--quick] ...
    status.ts             # pnpm task status [--ref <ref>] [--fix [branch]] ...
    list.ts               # pnpm task list
    promote.ts            # pnpm task promote [--confirm-rebase]
    wip.ts                # pnpm task wip [title] [message]
    task.ts               # pnpm task <ref> [--json]  
  lib/                    # reused logic across the commands
    repo-state.ts         # fetch + gh merge-status + ancestry staleness
                          # -> {ref, phase}; WIP detection
    task-doc.ts           # task-{ref}.md / task-{ref}-NN-spec.md
                          # template scaffolding and spec-chunk import
                          # (parked for detailed design — see §3)
  deps/                   # thin shims over external dependencies mocked by system level
                          # behaviour testing against external dependencies.
    gate-check.ts         # typed wrapper around @magpieweaver/gate-check,
                          # mapping Phase -> the correct check function
    git.ts                # branch create/checkout/push/rebase primitives,
                          # used only by init and promote's ready path
    gh.ts                 # PR creation + merged-PR lookup — the sole
                          # merge-detection mechanism, used at both
                          # test->build and the final Main Gate
    fs.ts                 # file system operations to read dirs, templates, task docs and specs
                          # and write dirs, task docs and specs.
```

`@magpieweaver/gate-check` is a workspace dependency (`workspace:*`),
imported directly. `task-phases` has no gate-validation logic of its own —
every pass/fail judgment comes from that package.

## 2. Interfaces

```typescript
// types.ts
interface TaskPhasesConfig { // `.task-phases.json somewhere in the cwd path (repo root).  
  templates: {
    task: string; // path from .task-phases.json to the task template
  }
  tasks: {
      docs?: string // path from .task-phases.json to the task docs directory
                    // default to "docs/tasks/"
      dirName?: string // pattern for the task dir defaults to "task-${ref}"
      taskDocName?: string // pattern for the task doc name, default to "task-${ref}"
      specDocNames?: string // pattern for the spec docs defaults to task-${ref}-${nn}-spec.md
  }
}

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
  | "merged-pending-pull"     // gh confirms the test/{ref}->build/{ref}
                     // PR merged, but local build/{ref} doesn't yet
                     // reflect it. Only `promote` resolves this (pull,
                     // and — only if pre-existing WIP needs reordering —
                     // rebase + force-push, §3.3/§3.5). `status`/`list`
                     // report it read-only, same treatment as the state
                     // below.
  | "merged-pending-cleanup"; // gh confirms the Main Gate PR merged and
                     // the change is not yet reflected in local `main`
                     // (§3.2) — including the interrupted-cleanup case,
                     // where a phase branch survives but is already an
                     // ancestor of local `main`. Only `promote` acts on
                     // this (branch deletion, §3.6) — `status`/`list`
                     // report it read-only.

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

// the command invoked
type Command = "init" | "status" | "list" | "promote" | "wip" | "ref";

interface TaskPhasingCommandResult {
    messages: string[];         // messages surfaced to the caller by the command
                                // execution
    success: boolean;           // true if the command completed successfully
                                // false if the command failed
    violation?: string;          // any detected task phasing voliation.
    suggestedActions?: string[]; // suggested actions to resolve the violation.
} // throws invalid-arguements

/**
 * `init`-specific result data (§3.8). Extends the base result with what a
 * caller needs to know about what was actually created, beyond generic
 * messages — e.g. an agent chaining `init` -> `wip` -> `promote` needs the
 * canonical branch name without re-deriving it via a separate `status` call.
 */
interface InitCommandResult extends TaskPhasingCommandResult {
  ref: TaskRef;
  canonicalBranch: string;        // spec/{ref} or task/{ref}, whichever was created
  taskDocPath: string | null;     // path to the created/copied task doc, if any
  specDocPaths: string[];         // paths of any spec docs copied in (§3.8's --specs)
  wipCarriedForward: boolean;     // true if pre-existing WIP was committed via
                                  // --wip before creating the new branch (§3.8)
}

/**
 * `status`-specific result data (§3.9). The base `TaskPhasingResult.taskStatus`
 * already carries the derived `TaskStatus` for whichever ref was inspected
 * (current or `--ref`-given) — this extension only adds what's specific to
 * *how* status was invoked, not duplicate that.
 */
interface StatusCommandResult extends TaskPhasingCommandResult {
  checked: boolean;        // true iff --check was given AND actually ran
                           // gate-check (false if ready? was left unresolved,
                           // or if --check was refused — see checkRefused)
  checkRefused: boolean;   // true iff --check was given but refused because
                           // --ref named a task other than the checked-out
                           // one (§3.9) — success is false whenever this is
                           // true, per the exit-code contract in §4.1
  fixed: boolean;          // true iff --fix actually performed a branch
                           // switch (false if already on the canonical
                           // branch, so there was nothing to fix)
}

/**
 * `list`-specific result data (§3.10). The one command whose whole point is
 * reporting on *every* active task, not a single ref — the base
 * `TaskPhasingResult.taskStatus` (singular) can't carry this; `list`'s
 * extension is where the actual payload lives.
 */
interface ListCommandResult extends TaskPhasingCommandResult {
  tasks: TaskStatus[];       // every active ref's derived TaskStatus (§3.10)
  currentRef: TaskRef | null; // which entry (if any) is the currently
                             // checked-out task, for the `<== Current Task`
                             // marker in human output (§3.10.1)
}

/**
 * `promote`-specific result data (§3.11). Surfaces what action, if any, was
 * actually taken — a caller (especially an agent scripting against --json)
 * needs to distinguish "genuinely promoted" from "reported ready but blocked
 * on branchMismatch/awaiting-pr" without re-parsing prose messages. The
 * *why* of "none" is already covered by the base `violation` field
 * (§3.11's `branchMismatch`/`awaiting-pr`/`blocked` cases) — not duplicated
 * here. `RebaseOutcome` below is `deps/git.ts`'s own type (§4.8) — imported
 * here, not redefined; `types.ts` depends on `deps/git.ts`, not the reverse.
 */
interface PromoteCommandResult extends TaskPhasingCommandResult {
  action:
    | "none"               // branchMismatch, awaiting-pr, or blocked — nothing
                           // performed (§3.11's first three bullets)
    | "forked"             // spec/{ref} -> test/{ref} (the "ready" action for
                           // spec phase)
    | "pr-raised"          // a destination-gate PR was opened (§3.7's table)
    | "rebased"            // rebase-forward performed, §3.5 (either case)
    | "pulled"             // merged-pending-pull resolved, no reorder needed
    | "pulled-and-rebased" // merged-pending-pull resolved WITH a reorder
                           // (§3.5 step 4)
    | "cleaned-up";        // merged-pending-cleanup resolved (§3.6), including
                           // the interrupted-cleanup retrigger case (§3.2)
  prNumber?: number;             // set when action is "pr-raised"
  prUrl?: string;                // set when action is "pr-raised"
  rebaseOutcome?: RebaseOutcome; // set when action is "rebased" or
                                 // "pulled-and-rebased" (§4.8) — surfaces
                                 // conflict/unexpected-commit-count directly
                                 // rather than only as prose
  branchesDeleted?: string[];    // set when action is "cleaned-up" (§3.6)
}

/**
 * `wip`-specific result data (§3.12).
 */
interface WipCommandResult extends TaskPhasingCommandResult {
  commitSha: string;
  filesAdded: string[];
  filesChanged: string[];
  filesDeleted: string[];
}

/**
 * `ref`-specific result data (§3.13) — the `pnpm task <ref>` switch command.
 */
interface RefCommandResult extends TaskPhasingCommandResult {
  switchedFrom: string | null; // branch checked out before the switch
  switchedTo: string;          // the canonical branch switched to
  wipCommitSha?: string;       // set if --wip committed work before switching
}

type CommandResultFor<C extends Command> =
  C extends "init" ? InitCommandResult :
  C extends "status" ? StatusCommandResult :
  C extends "list" ? ListCommandResult :
  C extends "promote" ? PromoteCommandResult :
  C extends "wip" ? WipCommandResult :
  C extends "ref" ? RefCommandResult :
  never;

interface TaskPhasingResult<C extends Command = Command> {
    command: C;               // the task phasing command that was invoked
    args: Record<string, boolean | number | string | string[]>;
                              // a string map of the argument values given
    taskStatus: TaskStatus;    // the derived status of the task at the end of
                               // command execution
    result: CommandResultFor<C>;  // narrowed to the command-specific
                                  // extension above, not the generic base
}

/**
 * The signature of all task-phasing functions, generic over which
 * command-specific result extension the function returns. Each function
 * receives the inspectors and parsed CLI arguments, and returns its
 * result synchronously or asynchronously.
 */
export type TaskPhasingFn<R extends TaskPhasingCommandResult = TaskPhasingCommandResult> = (
    tools: ExternalTools,
    args: Record<string, boolean | number | string | string[]>,
) => Promise<R> | R;

/**
 * The function catalog linking function definitions to command names — an
 * explicit per-key interface rather than a generic `Record<Command,
 * TaskPhasingFn>`, so each command's function signature carries its own
 * specific return type instead of the generic base.
 */
export interface FunctionCatalog {
  init: TaskPhasingFn<InitCommandResult>;
  status: TaskPhasingFn<StatusCommandResult>;
  list: TaskPhasingFn<ListCommandResult>;
  promote: TaskPhasingFn<PromoteCommandResult>;
  wip: TaskPhasingFn<WipCommandResult>;
  ref: TaskPhasingFn<RefCommandResult>;
}

/**
 * The external tools to be passed to each task-phasing function call.
 * Provides access to git, github, gate-checks and file-system operations
 */
export interface ExternalTools {
    /** The git tool instance for the function to use if it needs it */
    git: GitTool;

    /** The github tool for the function to use if it needs it */
    github: GitHubTool;
    
    /** The gate-checks tool for the function to use if it needs it */
    gateChecks: GateChecksTool;
    
    /** The file system tool for the function to use if it needs it */
    fileSystem: FileSystemTool;
}

// Actual interface of @magpieweaver/gate-check's return type
// For information only do not implement.
export interface GateCheckResult {
    /** The name of the check */
    check: string;

    /** The arguments passed to the check */
    args: Record<string, boolean | number | string | string[]>;

    /** Whether the check passed or not */
    passed: boolean;

    /** Information messages provided by the check */
    messages: string[];

    /** Violation messages provided by the check */
    violations: string[];

    /** A brief summary of the status of the check */
    summary: string;

    /** Values exported by the check to be passed to other checks */
    values: Record<string, boolean | number | string | string[]>;
}
```

```
# CLI surface

pnpm task init <ref> [--quick] [--title <title>] [--doc <path>] [--specs <path>...] [--wip [title] [message]] [--json]
pnpm task status [--ref <ref>] [--fix [branch]] [--wip [title] [message]] [--check] [--json]
pnpm task list [--json]
pnpm task promote [--confirm-rebase] [--json]
pnpm task wip [title] [message] [--json]
pnpm task <ref> [--wip [title] [message]] [--json]
```

* `init` initialise the task `<ref>`. It creates the required task documentation and copies in the 
    given specs. WIP can be commited in place or carried forward into the new task.
* `status` evaluates the status of the current task through inspection of the repos branches and commits
    it can automatically checkout the canonical branch and optionally commit WIP on its current branch
    or carry it forward onto the canonical branch.
* `list` queries the branches and commits, lists the active tasks with their derived phase and status.
* `promote` inspects the phase and status of the current branch, confirms the canonical branch is current,
    runs the `gate-check` for the phase and if `ready` promotes the task to the next phase.
* `wip` commits work in progress on the current branch with the `WIP` marker using the optional `title` and
    `message`.
* `<ref>` switches to the canonical branch of the given `<ref>` (matches `[A-Z]+-[0-9]+`) optionally
    committing work in progress in its current location of carrying it forward to the new task.


* `--json` is supported on every command, and causes only json output to be written
    to standard out for machine analysis. 
* `--quick` on `init` initialises a quick task (checks out `task/<ref?`)
* `--title <title>` on `init` sets the title of the task doc.
* `--doc <path>` on `init` copies the <path> to the task doc.
* `--specs <path>...` on `init` copies the paths to spec docs for the task.
* `--fix [branch]` on `status` sets the current branch to the canonical branch (`branch`)
    is an optional key work supporting other auto fixes in the future).
* `--wip [title] [message]` on `init`, `status` and `<ref>` commits changes to the current branch before
    switching branches. if `--wip` is not given then work in progress is left un-committed and the branch 
    switched underneath it, switching branches `status --fix` or `<ref>` without `--wip` fails on merge
    conflicts. Exactly two optional positional arguments, both quoted strings (e.g.
    `--wip "this is a title" "this is its description"`) — never flag-style. `title` takes
    priority: given a single argument, it's treated as `title` with no `message`, not the
    reverse. Both may be omitted (bare `--wip`, per §3.12's WIP convention still applies).
* `--check` on`status` opts into running `gate-check` to resolve `ready?` (§3.2) — plain
    `status` and `list` never do, since it's slow; `promote` always does if it needs to, since it can't 
    safely act without knowing. 
* `--ref <ref>` on `status` inspects a task other than the one on the currently checked-out branch,
    without switching branches. Combining `--ref` with `--check` is only valid when `<ref>` is the
    currently checked-out task — `gate-check` runs against the actual working tree, so resolving
    `ready?` for a different task's `<ref>` would need that task's files checked out, which `--ref`
    on its own does not do. `status --ref <other-ref> --check` fails with an explicit error (exit
    code 1) rather than silently running `gate-check` against the wrong task's files.
* `--confirm-rebase` on promote allows headless rebase spec -> test or test -> build

**Branch-restoration invariant: a command leaves the worktree on the same
branch it found it on.** The only exceptions are the commands whose
declared purpose is to switch — `<ref>` (§3.13) and `status --fix`
(§3.9) — which report where they moved to in `switchedFrom`/`switchedTo`.
Every other command restores the starting branch before returning, even
when it created or advanced another branch on the way. `wip` already
works this way (§3.12, "never switches branches"); `promote`'s
spec→test fork must too (§3.11).

This is not a stylistic preference. The dev machine runs one clone with
several linked worktrees (`architect`, `agent_1`) sharing a single ref
namespace, and **git allows a branch to be checked out in only one
worktree at a time**:

```
fatal: 'test/AAA-123' is already checked out at '.../architect'
```

A command that silently leaves the caller parked on a branch it created
hands that branch to the wrong worktree and locks every other worktree
out of it. Restoring the starting branch also keeps each worktree on the
branch its owner is responsible for — the architect on `spec/{ref}`, the
agent on its own phase branch — which is what makes concurrent work
across worktrees safe at all.


## 3. Design Notes

### 3.1 Branch topology — a new branch per phase, not a rename

Each phase transition creates its **own new branch**, branching off the
branch immediately before it in the sequence: `spec/{ref}` branches off
`main`, `test/{ref}` branches off `spec/{ref}`, and `build/{ref}` branches
off `test/{ref}` — a straight chain, not a single branch being renamed as
the task moves through phases. ("Fork" elsewhere in this document just
means "a distinct new branch object with its own identity," not a
GitHub-style repository fork — there's no forking across repositories
involved, only ordinary same-repo branch creation off the preceding
phase's branch.) All three (or, on the quick route, just `task/{ref}`)
stay alive simultaneously for the life of the task. (Appendix - §3.1)

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
  per §3.5, because it's checking the tool's own fork relationships, not
  a PR's merge state.
- **"Is a destination-gate PR currently open, awaiting human review?"** —
  also answered via `gh` (`gh pr list --state open`), checked immediately
  alongside the merged check. This produces the `awaiting-pr` `PhaseState`
  (§2), attached to the **source** phase of that PR, not a new `Phase` of
  its own — see §3.4.
- **"Is `ready?` actually `ready` or `blocked`?"** — deliberately **not**
  resolved on every command. Running `gate-check` is slow (full test
  suite, coverage, the unicorn linter) and unnecessary for a plain status
  read. `ready?` is only resolved into `ready`/`blocked` by `promote`
  (always) or `status --check` (opt-in) — see the bottom of the pseudocode
  below and §4.4.

```
git fetch origin   // always, before deriving anything

if gh reports a MERGED PR: (build/{ref} or task/{ref}) -> main 
     AND change not in main
     -> phase = build (or quick); state = merged-pending-cleanup (3.3, 3.6)
else if gh reports an OPEN PR: (build/{ref} or task/{ref}) -> main
     -> phase = build (or quick); state = awaiting-pr
else if gh reports a MERGED PR: test/{ref} -> build/{ref}
        AND change not in main
        AND test/{ref}'s current HEAD == that PR's recorded headRefOid
     -> phase = build
        if local build/{ref} doesn't exist, or its HEAD != origin/build/{ref}
             -> state = merged-pending-pull (only `promote` resolves — 3.3)
        else
             -> state = not-started | work-in-progress | ready?
else if gh reports an OPEN PR: test/{ref} -> build/{ref}
     -> phase = test; state = awaiting-pr
        (ancestry check against spec/{ref} — staleness only, 3.5)
else if test/{ref} exists
     if test/{ref} is an ancestor of local main
          -> phase = build (or quick); state = merged-pending-cleanup   // interrupted cleanup, retrigger
     else
          -> phase = test; state = not-started | work-in-progress | ready?
             (ancestry check against spec/{ref} — staleness only, 3.5)
else if spec/{ref} exists
     if spec/{ref} is an ancestor of local main
          -> phase = build (or quick); state = merged-pending-cleanup
     else
          -> phase = spec; state = not-started | work-in-progress | ready?
             (ancestry check against main — staleness only, 3.5)
else if task/{ref} exists
     if task/{ref} is an ancestor of local main
          -> phase = quick; state = merged-pending-cleanup
     else
          -> phase = quick; state = not-started | work-in-progress | ready?
             (ancestry check against main — staleness only, 3.5)
else
     -> not-initialised

if state == ready? and the invoking command is `promote` or `status --check`
     -> resolve ready? into ready or blocked by running gate-check for
        this phase's destination gate (3.7). Every other invocation
        (plain `status`, `list`) reports `ready?` as-is, unresolved.
```

**`not-started | work-in-progress | ready?` is derived against the
phase's own parent branch, not against `main` (MAG-46-10).** A phase is
`not-started` when it carries no commit *of its own*, so the comparison
is with the branch it forked from:

| Phase   | Parent branch to derive against |
|---------|---------------------------------|
| `spec`  | `origin/main`                   |
| `test`  | `spec/{ref}`                    |
| `build` | `origin/build/{ref}`            |
| `quick` | `origin/main`                   |

This is the same parent each destination gate already counts against
(§3.7) — `test-gate` wants `test/{ref}` exactly one commit beyond
`spec/{ref}` — so derivation and the gates agree on what a phase's work
is. Deriving every phase against `main` instead measures the *task's*
total progress and reports it as the *phase's* state: a freshly forked
`test/{ref}` would report `ready?` on the strength of the spec commit
alone, and `promote` would then run `build-gate` against a branch with
nothing to gate. Note this is a different question from the ancestry
checks above, which are staleness-only (§3.5) and unaffected.

Whichever branch triggers the interrupted-cleanup retrigger, the reported
phase is the same as the top-level `merged-pending-cleanup` case (`build`
for the regular route, `quick` for the quick route) — which specific
surviving branch matched doesn't change the resulting action, since
`promote` re-attempts cleanup across whatever remains regardless. This
matters for determinism: without this safety net, a cleanup interrupted
between "update local `main`" and "delete branches" (§3.6) would cause a
later `status`/`promote` call to wrongly regress to reporting an earlier,
stale phase for a task that's actually done — rather than a manual
re-run being required to notice, phase-state derivation stays accurate
and deterministic regardless of exactly where cleanup was interrupted.

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
outside the squash step and so should preserve ancestry. (Appendix - §3.3)

`gh`-based detection sidesteps this entirely: it never compares commit
SHAs, so it's correct regardless of which merge method was actually used.
This is now the **only** merge-detection mechanism in the tool. Ancestry
(`merge-base --is-ancestor`) is reserved exclusively for the staleness
check in §3.4 — a question about the tool's own fork relationships, never
about a GitHub-mediated merge, so it isn't affected by any of the above.

**Every gated transition needs two separate `promote` calls, not one —
this applies uniformly to both merge points, correcting an earlier draft
that treated the test→build pull as automatic and safe on any command.**
The first `promote` call, when `ready`, raises the destination-gate PR.
Merging happens externally, on GitHub's own timescale (human review).
Only a *second*, later `promote` call — invoked once `gh` confirms the
merge — processes the result: pulling `build/{ref}` locally (and, only if
pre-existing WIP needs reordering, rebasing it — §3.5's cascading case)
for the test→build leg, or deleting branches (§3.6) for the final leg.
`status`/`list` never perform either of these actions themselves; they
only report which `merged-pending-*` state applies, exactly as they do for
`ready?` (§3.2).

- **`test/{ref}` → `build/{ref}` merged, local not yet caught up:**
  reported as `merged-pending-pull` (§2). Resolving it is `promote`-only,
  and splits into two cases: if `build/{ref}` had no pre-existing
  build-phase commits, this is a plain, non-destructive pull (creating
  local `build/{ref}` tracking `origin/build/{ref}`, or fast-forwarding
  it) — safe, but still gated behind an explicit `promote` call rather
  than happening automatically on `status`/`list`, for consistency with
  the case below (and because a reader of a plain `status` shouldn't have
  their local branches silently mutated by what looks like a read-only
  command). If `build/{ref}` *did* have pre-existing build-phase commits
  (the cascading case, §3.5), this pull additionally requires rebasing
  those commits onto the fresh merge and force-pushing — gated by the same
  `--confirm-rebase`/prompt mechanism as every other rewrite in this
  design.
- **`build/{ref}`/`task/{ref}` → `main` merged:** reported as
  `merged-pending-cleanup` (§2). The actual cleanup (branch deletion,
  §3.6) is `promote`-only — but unlike rebase-forward and the WIP-reorder
  case above, it runs **without** requiring `--confirm-rebase` or a
  prompt: once the change is confirmed merged into `main`, nothing is lost
  by deleting the now-fully-absorbed branches, so there's no equivalent
  risk to gate against.

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

**This guard only protects an agent that actually uses `promote`.** An
agent can bypass `task-phases` entirely — `gh pr create --base main --head
build/{ref}` directly — and `task-phases` has no visibility into that at
all. So `branchMismatch` is a UX convenience that keeps an honest user of
the tool from confusing itself; it is **not** the actual security
boundary. That boundary has to be a mechanical, CI-side assertion inside
`main-gate` itself (owned by `gate-check`, not this tool), since that's
the one check that runs as a required status check regardless of how the
PR was opened — see the requirement recorded in §3.7.

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
(Appendix - §3.5.a)

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

**This silent, tool-only rebase does *not* extend one level up to
`test/{ref}` → `build/{ref}`, and an earlier revision of this document
was wrong to say it did.** That hop is a human-reviewed gate (Build Gate),
unlike spec→test — silently rebasing `build/{ref}` onto amended test
content without a fresh review would let changed test content reach
`build/{ref}` unreviewed, reopening exactly the bypass closed in §3.4/§3.7.
So when `test/{ref}` is amended after an earlier Build Gate PR already
merged, §3.2's derivation correctly falls back to reporting `phase = test`
again (the merged-PR evidence is superseded once `test/{ref}`'s HEAD no
longer matches what was actually merged) — and getting back to `build`
requires a **genuinely new** Build Gate PR, reviewed like the first one,
not a silent history rewrite. The full sequence:

1. **Detection** (§3.2): once `test/{ref}`'s current HEAD differs from the
   existing merged Build Gate PR's recorded `headRefOid`, that merge is
   treated as superseded, and phase falls back to `test`.
2. **A fresh Build Gate PR is raised** (`test/{ref}` → `build/{ref}`) —
   the ordinary test-phase `ready` action (first `promote` call), requiring
   genuine human re-review since content has changed since the original
   review. No preparation of `build/{ref}` is needed beforehand — the PR
   is raised against `build/{ref}` exactly as it currently stands, WIP and
   all; GitHub will simply append the fresh squash commit after whatever's
   already there.
3. **Once that PR merges**, `build/{ref}` (on origin) temporarily has the
   *wrong* commit order if it already carried build-phase work — `spec,
   test-old, build-WIP, test-new` rather than `spec, test-new, build-WIP`.
   This is left as-is on origin; it is not corrected at merge time.
4. **The second `promote` call**, invoked once `gh` confirms the merge
   (`merged-pending-pull`, §3.3), is where the reorder actually happens:
   it rebases the pre-existing build-phase commit(s) onto the fresh merge
   result and force-pushes, restoring the clean `spec, test, build` order
   — this is the one and only point in the whole sequence where that
   reordering occurs.

Both PR-raising (step 2) and the pull/reorder (step 4) go through
`promote`'s ordinary gates independently — step 2 needs no special
confirmation (opening a PR isn't destructive); step 4 is force-push-
adjacent and goes through the same `--confirm-rebase`/prompt mechanism as
every other rewrite in this design, at whatever later point in time
`promote` is actually invoked to process the now-merged PR (step 2's PR
may take an arbitrary amount of real time to actually get reviewed).
(Appendix - §3.5.b)

**The same treatment applies one level down, too: `main` moving ahead of
`spec/{ref}` or `task/{ref}`.** Unlike the within-task cases above, this
isn't about an earlier *phase* of this task being amended — it's ordinary
drift as `main` advances from other tasks merging while this one is still
in flight. It gets the identical rebase-forward treatment rather than
being left as an ignorable, eventual-integration concern: `promote`, on
finding `spec/{ref}` (or `task/{ref}`) behind `main`'s current HEAD,
rebases it onto `main` in place and force-pushes, gated by the same
`--confirm-rebase`/prompt mechanism as above — it does not silently
proceed, and does not treat this as merely informational. There is no
extra safety check equivalent to the `merge-base` verification above
here, since `main` is the trunk, not a tool-managed fork point — any
commit reachable from `spec/{ref}`/`task/{ref}` that isn't yet on `main`
is, by construction, this task's own unmerged work, so rebasing onto
`main`'s current tip can't discard anything that wasn't put there by this
same task.

### 3.6 Final cleanup — only at Main Gate merge

Branches are retained through every intermediate transition specifically
to keep the amend-and-roll-forward flow in §3.5 possible. Cleanup is a
single event, triggered only once `promote` (via the `gh`-based check in
§3.3) detects the task's Main Gate PR has merged:

1. `git fetch origin`.
2. Checkout and update local `main` to match `origin/main`.
3. Delete `spec/{ref}`, `test/{ref}`, `build/{ref}` (or, on the quick
   route, `task/{ref}`) — whichever exist — both locally and on `origin`.
4. Report the task as done. No further branch exists for this ref;
   subsequent `status`/`list` calls against it report `not-initialised`
   should the ref ever be reused, though re-use isn't itself designed for
   here.

Should this sequence be interrupted between steps 2 and 3, §3.2's
ancestry safety net keeps a later `status`/`promote` call deterministic —
it re-derives `merged-pending-cleanup` and re-attempts cleanup rather than
reporting a stale earlier phase, and `deleteBranch` already tolerates
"doesn't exist locally" as a no-op, so re-running step 3 against whatever
partially survived is safe.

Everything past this point — the push to `uat`, and the `uat` → `main`
(production) PR — is CI/CD automation outside `task-phases`'s tracked
scope, per §1.1.

### 3.7 Gate naming, enforcement, and required merge methods

Gates are named `<destination>-gate`:

| From          | To            | Gate         | Externally enforced (branch protection)?                   |
|---------------|---------------|--------------|------------------------------------------------------------|
| `spec/{ref}`  | `test/{ref}`  | `test-gate`  | No                                                         |
| `test/{ref}`  | `build/{ref}` | `build-gate` | Yes                                                        |
| `build/{ref}` | `main`        | `main-gate`  | Yes                                                        |
| `task/{ref}`  | `main`        | `main-gate`  | Yes (same gate, different inbound-commit-count validation) |

**Correction: the Main Gate PR is raised from `ready/{ref}`, not from
`build/{ref}`.** `build/{ref}` is branch-protected and only ever receives
the Build Gate PR merge, so the build phase's own commit cannot be pushed
back through it. The build commit goes on `ready/{ref}`, forked from
`build/{ref}`, and that is what the Main Gate PR is raised from — the
`From` column above should read `ready/{ref}` for the `main-gate` row,
and `main-gate`'s "rejects any PR whose source isn't `build/{ref}` or
`task/{ref}`" below should read `ready/{ref}` or `task/{ref}`.
`ready/{ref}` is a fourth phase-branch prefix and needs adding to
`PHASE_PREFIXES` in `lib/repo-state.ts` and `commands/status.ts`;
without it, `status` on a `ready/{ref}` branch derives no ref and reports
`not-initialised`.

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

**Correction (MAG-46-11): the paragraph below is wrong and must not be
applied.** It assumes `build/{ref}` forks from `spec/{ref}`. It doesn't —
`build/{ref}` is created from `origin/main` and starts empty, so that the
Build Gate PR's diff carries both the spec and the test commit and
satisfies `build-gate`'s "exactly 2 commits" rule (MAG-46-11 §2.1).
Squash-merging that PR collapses the two into one commit on
`build/{ref}`, leaving the build phase's branch 2 commits ahead of `main`
instead of 3, and `main-gate`'s "exactly 3 commits" rule then fails.
**The Build Gate PR must be rebase-merged**, and "Rebase and merge" must
stay *enabled* for this transition. The `{ref}`-prefixed-commit-message
discipline described below still applies. Retained unedited for the
decision history:

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

**Stitching this configuration into the actual repos (which already sit in
the weaver-engineering org with some branch protection in place) and
testing the result against real GitHub behaviour is a manual task, done
outside this document and outside `task-phases`'s own build.** Some rework
in `deps/git.ts`/`deps/gh.ts` once tested against the real, configured
repos is expected and accepted — the interfaces in §4.8/§4.9 are a
first-pass synthesis (as their own preambles already note), not a
contract guaranteed to survive contact with the real branch-protection
setup unchanged.

**Additional required assertion, owned by `gate-check`'s `main-gate`
implementation, not by `task-phases`:** `task-phases`'s own
`branchMismatch` guard (§3.4) only protects an agent that actually invokes
`promote` — nothing stops an agent from bypassing `task-phases` entirely
and opening a `build/{ref}`/`task/{ref}` → `main` PR directly via `gh` or
the GitHub UI. Since `main-gate` runs as a required status check
regardless of how the PR was opened, it is the only place this can
actually be closed, and it must independently assert, as part of its own
evaluation of every `main-gate` PR:

1. **No PR is currently open from `test/{ref}` → `build/{ref}`.** If one
   is open, `main-gate` fails outright — even if `build/{ref}`'s commit
   count happens to look structurally plausible — because an unresolved
   Build Gate PR means the content on `build/{ref}` can't yet be trusted
   as genuinely reviewed.
2. **`origin/build/{ref}` is confirmed as the only path this content could
   have legitimately reached** — cheap to assert precisely because direct
   pushes to `origin/build/{ref}` are already blocked by branch protection
   (a merged PR from `test/{ref}` is the only route in). This is
   defense-in-depth against the one acknowledged escape hatch elsewhere in
   the design — the architect's manual override (Guard Rails §3, per the
   Architecture Definition Document) — not something needed in the
   well-behaved case.

This is recorded here as a **cross-cutting requirement on
`gate-checks-lld.md`**, not something `task-phases` implements itself —
flagged explicitly so it isn't lost between the two documents' respective
scopes.

### 3.8 `task init`

```
pnpm task init <ref> [--quick] [--title <title>] [--doc <path>] [--specs <path>...] [--wip [title] [message]] [--json]
```

implements the existing-ref decision tree (doc exists? /
branch exists? / branch merged?) from the prior revision, using
`lib/task-doc.ts` and `lib/git.ts`. The "branch exists with unmerged
commits" call remains a hard, unconditional block (§3.14).

initialise the task `<ref>`. It creates the required task dir and documentation and copies 
in the given specs. WIP can be commited in place or carried forward into the new task.
one of `title` or `doc` is required.
creates task dir if it does not exist.
if `--doc <path>` given and task doc does not exist
  -> copy path to task dir as task doc
else if `--title <title>` is given and the task doc does not exist
  -> copy task template to task dir as task doc (replacing ${ref} and ${title})
if `--specs <path>...` is given
  -> for each `<path>`
    -> copy `<path>` to task dir as specification doc. 
if `--wip [title] [message]` is given
  -> commit WIP on current branch (new commit can always be squashed later to open the gate)
     `title` and `message` if given are included in the commit.

**`--doc`/`--specs` are helper conveniences, not core requirements.** Any
deviation from the supported happy path (a given path doesn't exist, a
doc already present when `--title` also given, a spec file collides with
an existing name, etc.) is handled gracefully: warn the user and continue
with `init` regardless, rather than aborting it. Since these flags exist
purely to save a manual copy step, failing the whole command over a
convenience-path problem would be a worse outcome than just warning and
letting the architect sort the file out by hand afterward.

**`.task-phases.json` bootstrapping is a manual, project-setup task, not
something `init` performs.** If no config file is found walking up from
cwd to the repo root, the same graceful-degradation rule above applies:
warn, and continue using every documented default from §2's
`TaskPhasesConfig` (docs at `docs/tasks/`, `task-${ref}` dir naming, and
so on) rather than failing. Every field in `TaskPhasesConfig` already has
a stated default for exactly this reason — a missing config file should
never be a hard blocker to running `init`.

#### 3.8.1 Human Readable Output

Create a new task AAA-001 from main with spec and no work in progress

```bash
/data/workspaces/magpie-weaver$ pnpm task init AAA-001 \
--title "Do a thing" \
--specs ../magpieweaver-docs/docs/setup/dev-env/task-phasing/spec-1-scaffolding.md
Current branch `main` - ref: -
------------------------------
Initial Task State
Task::Phase::State -::-::not-initialised
----------------------------------------

Initialising new task: 'AAA-001' Do a thing...
 - Check for WIP - OK.
 - Check `main` is up to date with `origin` - OK.
 - Check Branch `spec/AAA-001` is available - does not exist - OK.
 - Create branch `spec/AAA-001` - OK.
 - Initialising task documentation: `docs/tasks/AAA-001`...
   - Create task directory `docs/tasks/AAA-001` - OK.
   - Create `task-AAA-001.md` from template, title: "Do a thing" - OK.
   - Copying specs...
     - ../magpieweaver-docs/docs/setup/dev-env/task-phasing/spec-1-scaffolding.md -> `task-AAA-001-01-spec.md`
   - Copying specs - OK.
 - Initialising task documentation: `docs/tasks/AAA-001` - OK.
New task `AAA-001` Do a thing initialised - OK.

Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-001::spec::work-in-progress
--------------------------------------------------
data/workspaces/magpie-weaver$
```

Create a new task AAA-002 from main with no spec

```bash
data/workspaces/magpie-weaver$ pnpm task init AAA-002 \
--title "Do a thing without specs"
Current branch `main` - ref: -
------------------------------
Initial Task State
Task::Phase::State -::-::not-initialised
----------------------------------------

Initialising new task: 'AAA-002' Do a thing without specs...
 - Check for WIP - OK.
 - Check `main` is up to date with `origin` - OK.
 - Check Branch `spec/AAA-002` is available - does not exist - OK.
 - Create branch `spec/AAA-002` - OK.
 - Initialising task documentation: `docs/tasks/AAA-002`...
   - Create task directory `docs/tasks/AAA-002` - OK.
   - Create `task-AAA-002.md` from template, title: "Do a thing without specs" - OK.
   - No specs given - skipped.
 - Initialising task documentation: `docs/tasks/AAA-002` - OK.
New task `AAA-002` Do a thing without specs initialised - OK.

Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-002::spec::work-in-progress
--------------------------------------------------
data/workspaces/magpie-weaver$
```

Create a new task AAA-003 from main with existing work in progress and no `--wip` given (fails)

```bash
data/workspaces/magpie-weaver$ pnpm task init AAA-003 \
--title "Do a thing" \
--specs ../magpieweaver-docs/docs/setup/dev-env/task-phasing/spec-1-scaffolding.md
Current branch `build/ABC-123` - ref: `ABC-123`
----------------------------------------------
Initial Task State
Task::Phase::State ABC-123::build::work-in-progress
---------------------------------------------------

Initialising new task: 'AAA-003' Do a thing...
 - Check for WIP - changed found.
 - No WIP instruction - FAIL!
Initialising new task: 'AAA-003' Do a thing - FAIL!.

Exit Code: 1 - FAILURE
Current Task State
Task::Phase::State ABC-123::build::work-in-progress
---------------------------------------------------
data/workspaces/magpie-weaver$
```

Create a new task AAA-003 from main, handling existing work in progress via `--wip`

```bash
data/workspaces/magpie-weaver$ pnpm task init AAA-003 \
--wip "A PoC" "No longer required" \
--doc ../magpieweaver-docs/docs/setup/dev-env/task-phasing/AAA-003-tasknote.md \
--specs ../magpieweaver-docs/docs/setup/dev-env/task-phasing/spec-1-scaffolding.md 
Current branch `build/ABC-123` - ref: `ABC-123`
----------------------------------------------
Initial Task State
Task::Phase::State ABC-123::build::work-in-progress
---------------------------------------------------

Initialising new task: 'AAA-003' Do a thing...
 - Check for WIP - changed found.
 - Handling WIP...
   - Commit ABC-123: A PoC - WIP
   -
   - No longer required
   - ---
 - Handling WIP - OK.
 - Check `main` is up to date with `origin` - OK.
 - Check Branch `spec/AAA-003` is available - does not exist - OK.
 - Create branch `spec/AAA-003` - OK.
 - Initialising task documentation: `docs/tasks/AAA-003`...
   - Create task directory `docs/tasks/AAA-003` - OK.
   - Create `task-AAA-003.md` from `--doc` path - OK.
   - Copying specs...
     - ../magpieweaver-docs/docs/setup/dev-env/task-phasing/spec-1-scaffolding.md -> `task-AAA-003-01-spec.md`
   - Copying specs - OK.
 - Initialising task documentation: `docs/tasks/AAA-003` - OK.
New task `AAA-003` Do a thing initialised - OK.

Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-003::spec::work-in-progress
--------------------------------------------------
data/workspaces/magpie-weaver$
```

### 3.9 `task status`

```
pnpm task status [--ref <ref>] [--fix [branch]] [--wip [title] [message]] [--check] [--json]
```

derive the status of the current task (or, with `--ref <ref>`, a different
task, without switching branches) through inspection of the repo's
branches and commits. Without `--ref`, it can automatically checkout the
canonical branch and optionally commit WIP on its current branch or carry
it forward onto the canonical branch.

runs the fetch → merge-status/open-PR/ancestry-derive
pipeline (§3.2–§3.3) and reports `TaskStatus` (including
`branchMismatch`, §3.4) without acting on it. Resolves `ready?` into
`ready`/`blocked` only when invoked with `--check` (§3.2); otherwise
reports `ready?` unresolved, since `gate-check` is slow and a plain
status read shouldn't pay that cost.

if `--ref <ref>` given
  -> derive `TaskStatus` for `<ref>` instead of the task on the
     currently checked-out branch; `--fix`/`--wip` are not applicable
     in this mode (there is no "current branch" of `<ref>` to fix/carry
     WIP on unless `<ref>` is also the checked-out task)
  if `--check` also given and `<ref>` is not the currently checked-out
     task's ref
    -> fail (exit code 1): "`--check` requires `<ref>` to be the
       checked-out task; `gate-check` runs against the working tree" —
       this command did not deliver what was asked (an authoritative
       resolved `ready?`/`blocked` for `<ref>`), so it must not report
       success even though phase/state derivation for `<ref>` itself
       succeeded as far as it went

if `--fix [branch]` given
  if branch miss match
    if `--wip [title] [message]` and uncommited changes
      -> commit WIP
    -> switch to the canonical branch.

if `--check` and derived status is `ready?`
  -> run the `gate-check` for the phase.
  -> update phase status (ready | blocked)

#### 3.9.1 Human Readable Output

Get the status of the current task and resolving the `ready?` status

```bash
data/workspaces/magpie-weaver$ pnpm task status --check
Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - No merged PR test/AAA-123 -> build/AAA-123
   - No open PR test/AAA-123 -> build/AAA-123
   - Branch `test/AAA-123` exists
 - Phase of `AAA-123` is `test`
 - Evaluating status of task `AAA-123` in phase `test`...
   - Branch `spec/AAA-123` is ancestor of `test/AAA-123` => not-stale
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `AAA-123` in phase `test` is `ready?`
 - Resolving `ready?` status of task `AAA-123`...
   - Running gate-check `build-gate`...
     - validating spec commit
     - task director exists
     - task doc exists
     - ...
   - `build-gate` check passed
 - Status of task `AAA-123` in phase `test` is `ready`.

Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::test::ready
---------------------------------------
data/workspaces/magpie-weaver$
```

Get the status of the current task without resolving the `ready?`

```bash
data/workspaces/magpie-weaver$ pnpm task status
Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - No merged PR test/AAA-123 -> build/AAA-123
   - No open PR test/AAA-123 -> build/AAA-123
   - Branch `test/AAA-123` exists
 - Phase of `AAA-123` is `test`
 - Evaluating status of task `AAA-123` in phase `test`...
   - Branch `spec/AAA-123` is ancestor of `test/AAA-123` => not-stale
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `AAA-123` in phase `test` is `ready?`
 - Ready? status not resolved, `--check` flag not set. 

Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::test::ready?
----------------------------------------
data/workspaces/magpie-weaver$
```

Get the status of the current task when there is a branch mismatch

```bash
data/workspaces/magpie-weaver$ pnpm task status
Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating task phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - No merged PR test/AAA-123 -> build/AAA-123
   - No open PR test/AAA-123 -> build/AAA-123
   - Branch `test/AAA-123` exists
 - Phase of `AAA-123` is `test`
 - Evaluating status of task `AAA-123` in phase `test`...
   - Branch `spec/AAA-123` is ancestor of `test/AAA-123` => not-stale
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `AAA-123` in phase `test` is `ready?`
 - Ready? status not resolved, `--check` flag not set. 

Exit Code: 0 - SUCCESS
Current Task State
\\\\\\ CAUTION BRANCH MISMATCH current branch should be `test/AAA-123` //////
Task::Phase::State AAA-123::test::ready?
----------------------------------------
data/workspaces/magpie-weaver$
```

Get the status of another task

```bash
data/workspaces/magpie-weaver$ pnpm task status --ref ABC-789
Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Given ref: `ABC-789`
 - Evaluating phase of `ABC-789`...
   - No merged PR (build/ABC-789 or task/ABC-789) -> main
   - No open PR (build/ABC-789 or task/ABC-789) -> main
   - No merged PR test/ABC-789 -> build/ABC-789
   - Open PR test/ABC-789 -> build/ABC-789
 - Phase of `ABC-789` is `test`
 - Status of `ABC-789` in phase `test` is `awaiting-pr`

Exit Code: 0 - SUCCESS
Task ABC-789 State
Task::Phase::State ABC-789::test::awaiting-pr
---------------------------------------------
data/workspaces/magpie-weaver$
```

Get the status of another task and attempt to resolve the ready? status (fails — `--check` requires the given ref to be the checked-out task)

```bash
data/workspaces/magpie-weaver$ pnpm task status --ref ABC-789 --check
Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Given ref: `ABC-789`
 - Evaluating phase of `ABC-789`...
   - No merged PR (build/ABC-789 or task/ABC-789) -> main
   - No open PR (build/ABC-789 or task/ABC-789) -> main
   - No merged PR test/ABC-789 -> build/ABC-789
   - No open PR test/ABC-789 -> build/ABC-789
   - Branch `test/ABC-789` exists
 - Phase of `ABC-789` is `test`
 - Evaluating status of task `ABC-789` in phase `test`...
   - Branch `spec/ABC-789` is ancestor of `test/ABC-789` => not-stale
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `ABC-789` in phase `test` is `ready?`
 - `--check` requires `ABC-789` to be the checked-out task (currently `AAA-123`) - refusing.

Exit Code: 1 - FAILURE
Task ABC-789 State
Task::Phase::State ABC-789::test::ready?
-----------------------------------------
data/workspaces/magpie-weaver$
```

### 3.10 `task list`

```
pnpm task list [--json]
```

queries the branches and commits, lists the active tasks with their derived phase and status.

the same pipeline across every ref with an active branch;
never resolves `ready?` (no `--check` equivalent — see the open
question in §3.14 on whether bulk resolution across many refs is worth
adding later).

List all branches in the repo
filter on branches matching `/[A-Z]+-[0-9]+$` (`*/{ref}`)
group by `{ref}`
For each `{ref}` output
- `{ref}` phase: `{phase}` state: `{phase-state}` [`<--` if current task [`MISSMATCH` if branchMissMatch]]

#### 3.10.1 Human Readable Output
```bash
data/workspaces/magpie-weaver$ pnpm task status --ref ABC-789
Current branch `test/ABC-789` - ref: `ABC-789`
----------------------------------------------
Listing the status of all current tasks...
 - task: `AAA-001` phase: `build` status: `work-in-progress`
 - task: `ABC-123` phase: `spec`  status: `ready?`
 - task: `ABC-789` phase: `test`  status: `awaiting-pr` <== Current Task
 - task: `BBB-001` phase: `build` status: `ready?`

Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State ABC-789::test::awaiting-pr
----------------------------------------------
data/workspaces/magpie-weaver$
```

### 3.11 `task promote`

```
pnpm task promote [--confirm-rebase] [--json]
```

inspects the phase and status of the current branch, confirms the canonical branch is current,
runs the `gate-check` for the phase and if `ready` promotes the task to the next phase.

runs the same pipeline and acts on the result, **always**
resolving `ready?` via `gate-check` where reached (it can't safely act
without knowing):
- `branchMismatch` → refuses to act on anything else below; reports the
  mismatch (§3.4).
- `awaiting-pr` → no action; re-reports the open PR (§3.4) — safe,
  idempotent.
- `ready` → performs the phase's mechanical action (branch fork, or PR
  open via `lib/git.ts`/`lib/gh.ts`), per §3.7's table.
- phase is `spec` but `test/{ref}` already exists (§3.5) → rebase +
  force-push, gated on `--confirm-rebase` or an interactive prompt.
- `spec/{ref}`/`task/{ref}` behind `main` (§3.5) → same rebase-forward
  treatment, same confirmation gate.
- `blocked` → no git/gh action; relays `gate-check`'s own `checks[]`.
- `merged-pending-pull` (§3.3) → pulls `build/{ref}` locally; if
  pre-existing build-phase commits need reordering onto the fresh merge
  (§3.5's cascading case), rebases and force-pushes, gated on
  `--confirm-rebase` or an interactive prompt — otherwise a plain,
  unconfirmed pull.
- `merged-pending-cleanup` (§3.3, §3.6) → performs final cleanup,
  including the interrupted-cleanup retrigger case (§3.2).

#### 3.11.1 Human Readable Output

Promote a task from spec::ready

```bash
data/workspaces/magpie-weaver$ pnpm task promote
Current branch `spec/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - No merged PR test/AAA-123 -> build/AAA-123
   - No open PR test/AAA-123 -> build/AAA-123
   - No branch `test/AAA-123` exists
   - Branch `spec/AAA-123` exists
 - Phase of `AAA-123` is `spec`
 - Evaluating status of task `AAA-123` in phase `spec`...
   - Branch `main` is ancestor of `spec/AAA-123` => not-stale
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `AAA-123` in phase `spec` is `ready?`
 - Resolving `ready?` status of task `AAA-123`...
   - Running gate-check `test-gate`...
     - validating spec commit
     - task director exists
     - task doc exists
     - ...
   - `test-gate` check passed
 - Status of task `AAA-123` in phase `spec` is `ready`.  
 
Promoting AAA-123::spec::ready...
  - Create new branch `test/AAA-123` from `spec/AAA-123` - OK.
  - Restore starting branch `spec/AAA-123` - OK.
  
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - No merged PR test/AAA-123 -> build/AAA-123
   - No open PR test/AAA-123 -> build/AAA-123
   - Branch `test/AAA-123` exists
 - Phase of `AAA-123` is `test`
 - Evaluating status of task `AAA-123` in phase `test`...
   - Branch `spec/AAA-123` is ancestor of `test/AAA-123` => not-stale
   - No work in progress
   - No commit beyond `spec/AAA-123`
 - Status of task `AAA-123` in phase `test` is `not-started`
 - Branch mismatch: canonical `test/AAA-123`, checked out `spec/AAA-123`
   (expected - the branch-restoration invariant, 2.1; whichever worktree
   takes the test phase checks `test/AAA-123` out)

Current branch `spec/AAA-123` - ref: `AAA-123`
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::test::not-started
---------------------------------------------
data/workspaces/magpie-weaver$
```

Promote a task from test::ready

```bash
data/workspaces/magpie-weaver$ pnpm task promote
Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - No merged PR test/AAA-123 -> build/AAA-123
   - No open PR test/AAA-123 -> build/AAA-123
   - Branch `test/AAA-123` exists
 - Phase of `AAA-123` is `test`
 - Evaluating status of task `AAA-123` in phase `test`...
   - Branch `spec/AAA-123` is ancestor of `test/AAA-123` => not-stale
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `AAA-123` in phase `test` is `ready?`
 - Resolving `ready?` status of task `AAA-123`...
   - Running gate-check `build-gate`...
     - validating spec commit
     - task director exists
     - task doc exists
     - ...
   - `build-gate` check passed
 - Status of task `AAA-123` in phase `test` is `ready`.

Promoting AAA-123::test::ready...
  - Raising PR `test/AAA-123` -> `build/AAA-123` - "Tests for AAA-123"...
    - Raise PR - PR #45 raised - OK
  - Build Gate PR raised for task `AAA-123` - OK

Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - Open PR test/AAA-123 -> build/AAA-123
 - Phase of `AAA-123` is `test`
 - Status of task `AAA-123` in phase `test` is `awaiting-pr`

Current branch `test/AAA-123` - ref: `AAA-123`
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::test::awaiting-pr
----------------------------------------------
data/workspaces/magpie-weaver$
```

Promote a task from build::not-started (Build Gate PR has merged, freshly pulled)

```bash
data/workspaces/magpie-weaver$ pnpm task status
Current branch `build/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - Merged PR test/AAA-123 -> build/AAA-123 exists and test/AAA-123 not mutated from PR
 - Phase of `AAA-123` is `build`
 - Evaluating status of task `AAA-123` in phase `build`...
   - Branch `build/AAA-123` exists
   - No work in progress
   - No commit detected
 - Status of task `AAA-123` in phase `build` is `not-started`

Current branch `build/AAA-123` - ref: `AAA-123`
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::build::not-started
----------------------------------------------
data/workspaces/magpie-weaver$
```

Promote a task from build::ready

```bash
data/workspaces/magpie-weaver$ pnpm task promote
Current branch `build/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - Merged PR test/AAA-123 -> build/AAA-123 exists and test/AAA-123 not mutated from PR
 - Phase of `AAA-123` is `build`
 - Evaluating status of task `AAA-123` in phase `build`...
   - Branch `build/AAA-123` exists
   - Branch `origin/build/AAA-123` is ancestor of `build/AAA-123`
   - No work in progress
   - Commit detected
   - Commit is not WIP
 - Status of task `AAA-123` in phase `build` is `ready?`
 - Resolving `ready?` status of task `AAA-123` in phase `build`...
   - Running gate-check `main-gate`...
     - validating spec commit
     - task director exists
     - task doc exists
     - ...
   - `main-gate` check passed
 - Status of task `AAA-123` in phase `build` is `ready`.

Promoting AAA-123::build::ready... 
  - Push `build/AAA-123` -> `origin/ready/AAA-123`
  - Raising PR `origin/ready/AAA-123` -> `origin/main` - "Implementation of AAA-123"...
    - Raise PR - PR #46 raised - OK
  - Main Gate PR raised for task `AAA/123` - OK
  
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - No merged PR (build/AAA-123 or task/AAA-123) -> main
   - Open PR build/AAA-123 -> main
 - Phase of `AAA-123` is `build`
 - Status of task `AAA-123` in phase `build` is `awaiting-pr`

Current branch `build/AAA-123` - ref: `AAA-123`
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::build::awaiting-pr
----------------------------------------------
data/workspaces/magpie-weaver$
```

Promote a task from build::merged-pending-cleanup

```bash
data/workspaces/magpie-weaver$ pnpm task promote
Current branch `build/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Evaluating phase of `AAA-123`...
   - Merged PR (build/AAA-123 or task/AAA-123) -> main exists
   - `main` is behind `origin/main`
 - Phase of `AAA-123` is `build`
 - Status of task `AAA-123` in phase `build` is `merged-pending-cleanup`
 
Promoting AAA-123::build::merged-pending-cleanup... 
   - No work in progress
   - Checkout and update branch `main`.
   - Branch `spec/AAA-123` exists and is not advanced from `main` - OK to delete
   - Branch `test/AAA-123` exists and is not advanced from `main` - OK to delete
   - Branch `build/AAA-123` exists and is not advanced from `main` - OK to delete
   - Task AAA-123 Done - deleting branches...
     - Delete branch `spec/AAA-123` - OK.
     - Delete branch `origin/spec/AAA-123` - OK.
     - Delete branch `test/AAA-123` - OK.
     - Delete branch `origin/test/AAA-123` - OK.
     - Delete branch `build/AAA-123` - OK.
     - Delete branch `origin/build/AAA-123` - OK.
   - Deleted branches for task AAA-123 - OK.
  
Evaluating task status...
 - Given ref: `AAA-123`
 - Evaluating phase of `AAA-123`...
   - Merged PR (build/AAA-123 or task/AAA-123) -> main and change in `main`
   - No open PR (build/AAA-123 or task/AAA-123) -> main
   - Merged PR test/AAA-123 -> build/AAA-123 and change in `main`
   - No open PR test/AAA-123 -> build/AAA-123
   - No branch `test/AAA-123` exists
   - No branch `spec/AAA-123` exists
   - No branch `task/AAA-123` exists
 - Phase of `AAA-123` is -
 - Status of task `AAA-123` in phase - is `not-initialised`

Current branch `main` - ref: -
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State -::-::not-initialised
----------------------------------------
data/workspaces/magpie-weaver$
```

### 3.12 `task wip`

```
pnpm task wip [title] [message] [--json]
```

commits work in progress on the current branch with the `WIP` marker using the optional `title` and
`message`.

Packs away in-progress work on the ref's current phase branch so it reads
unambiguously as paused rather than abandoned mid-edit:

1. Resolve `{ref}` → current phase branch (via §3.2 derivation).
2. If the worktree is clean (nothing staged, nothing modified) **the
   command fails** — there is nothing to pack away, and it does not
   manufacture an empty commit to force a WIP marker into existence.
3. Otherwise, stage everything and commit with title `{ref} WIP` (the
   literal substring `WIP` in the title is the recognised marker — see the
   WIP convention below), then push. `wip` never switches branches — it
   commits on whatever is currently checked out and leaves it checked out
   afterward; nothing about "packing work away" implies moving elsewhere.

*commit message*
```
${ref}: ${title} - WIP

${message} | "work in progress"
```

**WIP marker convention:** a branch is considered `work-in-progress`
(paused, not simply mid-edit and forgotten) when the literal substring
`WIP` appears anywhere in HEAD's commit title — e.g. `AAA-000 WIP` is a
valid marker. This is an exact string match, checked by `repo-state.ts` as
part of phase-state derivation, not a prefix/suffix convention.

#### 3.12.1 Human Readable Output

Pack away work in progress

```bash
data/workspaces/magpie-weaver$ pnpm task wip "A proof of concept" "parked - depending on AAA-234"
Current branch `task/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating work in progress...
 - 2 files added
   - packages/task-phases/src/registry.ts
   - packages/task-phases/src/index.ts
 - 1 file changed
   - packages/task-phases/src/cli.ts
 - 1 file deleted
   - packages/task-phases/src/delete-me.ts
   
Commiting work in progress on `task/AAA-123`
--------------------------------------------
AAA-123: A proof of concept - WIP

parked - depending on AAA-234
------
Committed work in progress - OK.

Current branch `task/AAA-123` - ref: `AAA-123`
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-123::quick::work-in-progress
-----------------------------------------------------
data/workspaces/magpie-weaver$
```

### 3.13 `task <ref>`

```
pnpm task <ref> [--wip [title] [message]] [--json]
```

switches to the canonical branch of the given `<ref>` (matches `[A-Z]+-[0-9]+`) optionally
committing work in progress in its current location of carrying it forward to the new task.
if `--wip [title] [message]` given
  -> commit changes to a new commit using `title` and `message`
checkout the canonical branch for the given task.

#### 3.13.1 Human Readable Output

Switch to another task

```bash
data/workspaces/magpie-weaver$ pnpm task AAA-234
Current branch `task/AAA-123` - ref: `AAA-123`
----------------------------------------------
Evaluating task status...
 - Given reference `AAA-234`
 - Evaluating phase of `AAA-234`...
   - No merged PR (build/AAA-234 or task/AAA-234) -> main
   - No open PR (build/AAA-234 or task/AAA-234) -> main
   - No merged PR test/AAA-234 -> build/AAA-234
   - No open PR test/AAA-234 -> build/AAA-234
   - Branch `test/AAA-234` exists
 - Phase of `AAA-234` is `test`
 - Evaluating status of task `AAA-234` in phase `test`...
   - Branch `spec/AAA-234` is ancestor of `test/AAA-234` => not-stale
   - No work in progress
   - No commit
 - Status of task `AAA-234` in phase `test` is `not-started`

Task `AAA-234` canonical branch is `test/AAA-234`
Checkout `test/AAA-234` - OK.

Current branch `test/AAA-234` - ref: `AAA-234`
----------------------------------------------
Exit Code: 0 - SUCCESS
Current Task State
Task::Phase::State AAA-234::test::not-started
---------------------------------------------
data/workspaces/magpie-weaver$
```

### 3.14 Parked items

- **Chunked specs** (`task-{ref}-00-spec.md`, `-01-spec.md`, ...) and how
  they interact with concurrent-branch state — acknowledged as relatively
  likely in practice, but not designed. `TaskRef`/`TaskStatus` carry no
  chunk field yet. (Note: `test/{ref}` moving past an already-merged Build
  Gate PR due to an upstream spec amendment is a *different* case, now
  fully designed in §3.2/§3.5 — not to be confused with this one, which is
  specifically about deliberate, planned additional scope under the same
  ref.)
- **Concurrency** — an `init` target whose branch has genuinely unmerged
  commits blocks outright, with no override flag, until this is designed.
- **`lib/task-doc.ts` template format** — scaffolding/import *behaviour*
  is now fully specified (§3.8: helper-only, graceful degradation on any
  deviation from the happy path, same treatment for a missing
  `.task-phases.json`) — what's still open is purely the template file's
  own format/placeholder syntax.
- **CLI surface stability** — expected to change as real pinch points
  surface in use; nothing above is being treated as locked.
- **`list --check`** — whether bulk `ready?` resolution across every
  in-flight ref is worth adding (cost scales with number of active tasks,
  unlike `status --check`'s single-ref cost) — not decided either way.

**Not parked — deliberately sequenced after this document, not a gap in
it:**
- **Test plan** — intentionally comes *after* this design is finalised,
  as `task-*-spec.md` documents following `SPEC-TEMPLATE.md` (per-behaviour
  `Given`/`When`/`Then` conditions, including required assertions on every
  interaction with `ExternalTools`) — the same spec/test/build discipline
  this tool exists to support, applied to building it. Not written here.
- **GitHub Actions / branch-protection stitching and live testing** — done
  manually, directly against the weaver-engineering org's repos (§3.7);
  outside both this document and `task-phases`'s own build.

## 4. Component Details

### 4.1 `cli.ts`
Parses argv into a subcommand name + flags only; performs no branch/gate/
git logic itself. Dispatches via `registry.ts`.
captures results, catches errors.
if `--json` flag given
  -> creates `TaskPhasingResult` instance from `TaskPhasingCommandResult`
else 
  -> writes human output from `TaskPhasingCommandResult`

**Exit code is a strict, mechanical function of
`TaskPhasingCommandResult.success` — never a place for a command to
diverge from what it already returned.** `cli.ts` exits `0` iff
`result.success === true`; otherwise nonzero — `2` specifically for
invalid-argument/usage errors (thrown before a command's own logic runs),
`1` for every other unsuccessful result (a command that ran to completion
but didn't deliver what was asked — blocked, refused, or unable to answer
authoritatively, per §3.9.1's `--check`-on-a-different-ref case). This
exists because a caller checking only the exit code — the common case for
shell scripts and CI, which may not parse `--json` output at all — must
never get a signal that disagrees with the structured result.

### 4.2 `types.ts`
Defines `TaskRef`, `Phase`, `PhaseState`, `TaskState`, `TaskStatus`, the
per-command result extensions (`InitCommandResult`, `StatusCommandResult`,
`ListCommandResult`, `PromoteCommandResult`, `WipCommandResult`,
`RefCommandResult` — each command returns its own extension of
`TaskPhasingCommandResult` rather than every command sharing one generic
shape, since what's actually pertinent to report differs per command —
`list` needs the full task array, `promote` needs which action was taken,
etc.), and the placeholder `GateCheckResult`. `@magpieweaver/gate-check`
exists and is functioning in-repo already — this is a normal
implementation-time integration step against a real, available package,
not an open unknown blocking the design.

### 4.3 `registry.ts`
Exports `commandRegistry: Record<string, CommandHandler>` mapping `init`,
`status`, `list`, `promote`, `wip`, `ref` to their handlers. Adding a command
means adding one file under `commands/` plus one entry here.

### 4.4 `commands/*.ts`
- `status.ts` — logic for the `status` command.
- `list.ts` — logic for the `list` command.
- `promote.ts` — logic for the `promote` command.
- `init.ts` — logic for the `init` command.
- `wip.ts` — logic for the `wip` command.
- `task.ts` - logic for the `ref` command (i.e. `pnpm task <ref>`).

### 4.5 `lib/repo-state.ts`
Fetches `origin`; derives phase via `lib/gh.ts`'s merge-status and open-PR
checks first (§3.2/§3.3), falling back to branch existence (including the
interrupted-cleanup ancestry safety net, §3.2), then runs the ancestry
staleness check (§3.5) against whichever phase is derived; also computes
the canonical-vs-current branch mismatch (§3.4) and, where relevant,
whether local `build/{ref}` matches `origin/build/{ref}`
(`merged-pending-pull`, §3.3). Detects the WIP marker (§3.8) and dirty-
worktree state to distinguish `not-started` / `work-in-progress` from a
state requiring gate-check resolution. Reports these states only — it
never mutates local branches itself; that's `promote`'s job exclusively
(§3.3, §4.4).

### 4.6 `lib/task-doc.ts`
Owns `task-{ref}.md` / `task-{ref}-NN-spec.md` scaffolding and the
new-chunk `--specs` import path used by `init`. Detailed design parked
(§3.14).

### 4.7 `deps/gate-check.ts`
Thin typed wrapper importing `@magpieweaver/gate-check` directly as a
library dependency. Maps `Phase` to the correct exported check function for
that phase's destination gate, per §3.7. `@magpieweaver/gate-check` is
already in-repo and functioning, so reconciling the return-type mapping
against it is ordinary implementation work, not a design dependency.

> **Draft, pending confirmation.** The four interfaces in §4.7.1–§4.10
> below are a first-pass synthesis of every git/GitHub/filesystem/gate-check
> operation named or implied elsewhere in this document (§3.2–§3.14), not a
> previously-agreed contract. Flagging explicitly so it isn't read as
> settled.

#### 4.7.1 Interface
```typescript
// Concrete shape of `GateChecksTool` (§2's `ExternalTools.gateChecks`),
// implemented by this file as a thin wrapper over `@magpieweaver/gate-check`.
// Owns the Phase -> destination-gate mapping (§3.7) so no caller needs to
// know it independently.

type GateName = "test-gate" | "build-gate" | "main-gate";

interface GateChecksTool {
  /**
   * Runs the destination gate check for `phase`'s next gate — spec ->
   * test-gate, test -> build-gate, build/quick -> main-gate (§3.7) —
   * against the current working tree, and returns the raw
   * `GateCheckResult` unmodified. Callers relay `messages`/`violations`
   * directly rather than reinterpreting them (§3.11: "blocked -> no
   * git/gh action; relays gate-check's own checks[]").
   *
   * `args` MUST include `ref` (mirroring gate-check's own CLI convention,
   * e.g. `pnpm gate-check build-gate --ref AAA-000 --json`) — deliberately
   * not left for gate-check to infer from the current branch name, so
   * gate-check stays decoupled from task-phases's specific naming scheme.
   */
  run(
    phase: Phase,
    args: Record<string, boolean | number | string | string[]>,
  ): Promise<GateCheckResult>;

  /** The destination gate `phase` resolves to, without running it —
   * used for reporting (e.g. `status`'s `gate.name`, §2's `TaskStatus`).
   * Pure lookup, no external dependency — the one method on this
   * interface that isn't actually shimming anything, kept here only
   * because it's colocated with the mapping `run()` already needs. */
  gateFor(phase: Phase): GateName;
}
```

### 4.8 `deps/git.ts`
Branch create/checkout/push/rebase primitives. Used by `init` (branch
creation), `promote`'s `ready` path (fork creation ahead of a PR), and
`promote`'s rebase-forward path (§3.5). Never used to create ordinary work
commits.

**Commit-count precondition on every rebase-forward path.** Both `test/{ref}`
(relative to `spec/{ref}`) and `build/{ref}` (relative to the prior merged
test-squash) are expected to carry **exactly one** commit of their own —
`build-gate`/`main-gate` enforce this retroactively, at PR-evaluation time,
but nothing enforces it *at the moment `promote` attempts a rebase-forward*.
An agent could in principle have stacked several `wip` commits without ever
squashing. `rebase()` does not attempt to cleverly handle an arbitrary tree
of commits — that's bad practice on the agent's part, and it's judged
acceptable to fail cleanly rather than build machinery to cope with it. The
precondition is checked against `upstream` (see below) before any rewrite
is attempted, and reported as its own distinct outcome (`unexpected-commit-
count`), not conflated with a genuine content conflict.

```typescript
// Concrete shape of `GitTool` (§2's `ExternalTools.git`), implemented by
// this file. Every method operates on the local checkout unless noted.
// Only `init`'s branch-creation path, `promote`'s `ready` action (fork
// creation ahead of a PR), and `promote`'s rebase-forward path (§3.5) call
// the mutating methods below — ordinary work commits are explicitly out
// of scope for this tool (§1.1).

type RebaseOutcome =
  | { status: "ok" }
  | { status: "conflict"; details: string }
  | {
      status: "unexpected-commit-count";
      expected: 1;
      actual: number;
      details: string;
    };

interface GitTool {
  /** `git fetch origin --prune` — always run first, before any phase/
   * state derivation (§1.1). `--prune` matters once final cleanup (§3.6)
   * starts deleting branches: without it, stale local remote-tracking
   * refs (e.g. `origin/spec/{ref}` after that branch is gone) can linger
   * and confuse `branchExists`. */
  fetch(): Promise<void>;

  /** `git branch --show-current` — the branch actually checked out
   * locally right now (`currentBranch`, §2/§3.4). Returns `""` in
   * detached HEAD; callers treat that as trivially mismatching any
   * canonical branch rather than special-casing it. */
  currentBranch(): Promise<string>;

  /** Whether `branch` exists, locally and/or on `origin` (§3.2's
   * phase-existence checks; §3.8's `init` decision tree).
   * Local: `git show-ref --verify --quiet refs/heads/<branch>`.
   * Remote: `git show-ref --verify --quiet refs/remotes/origin/<branch>`
   * — checked against the local remote-tracking ref, relying on `fetch()`
   * always having run first, rather than a `git ls-remote` network
   * round-trip. */
  branchExists(branch: string, opts?: { remote?: boolean }): Promise<boolean>;

  /** `git rev-parse <ref>` — SHA of `ref`'s current HEAD. `ref` may be a
   * local branch name or a remote-tracking ref (`origin/<branch>`); both
   * forms are needed — `headRefOid` comparisons (§3.5) use the local
   * form, `merged-pending-pull`'s local-vs-origin check (§3.3) needs
   * both in the same call site. */
  headSha(branch: string): Promise<string>;

  /** `git merge-base <refA> <refB>` — the nearest common ancestor.
   * Used by callers to derive the `upstream` argument for `rebase()`
   * below: for the spec->test and main-drift cases, `upstream =
   * mergeBase(spec/{ref}, test/{ref})` (or `mergeBase(main, branch)`)
   * is exactly the right boundary, computed fresh each time rather than
   * relying on any remembered fork-point — deliberately not reflog-based,
   * since reflog isn't reliably present (e.g. a fresh clone in CI). */
  mergeBase(refA: string, refB: string): Promise<string>;

  /** `git rev-list --count <parentBranch>..<branch>` — commits unique to
   * `branch` relative to `parentBranch`. Nonzero distinguishes
   * `not-started` from `work-in-progress`/`ready?` (§2, §4.5); also the
   * primitive `rebase()` uses internally for its commit-count
   * precondition above. */
  hasCommitsBeyond(branch: string, parentBranch: string): Promise<boolean>;

  /** `git log -1 --format=%s <branch>` — HEAD's commit title, for the
   * literal `WIP` substring check (§3.8's WIP marker convention). */
  headCommitTitle(branch: string): Promise<string>;

  /** `git status --porcelain` — nonempty output means dirty. Covers both
   * staged and unstaged changes (§3.9's dirty-worktree detection; §3.12's
   * "nothing to pack away" guard). Local-checkout-only by nature — only
   * meaningful for whatever's currently checked out. */
  isDirty(): Promise<boolean>;

  /** `git merge-base --is-ancestor <ancestor> <descendant>` (§3.2's
   * staleness checks, including the interrupted-cleanup safety net;
   * used internally by `rebase()`'s precondition, not just by callers
   * directly). Exit code 1 is a legitimate `false`, not an error — the
   * wrapper only throws on other exit codes (e.g. unknown ref). */
  isAncestor(ancestor: string, descendant: string): Promise<boolean>;

  /** `git checkout -b <newBranch> <fromRef>` — creates `newBranch` off
   * `fromRef`'s current HEAD and checks it out. **Local only — does not
   * push.** Callers (`init`, `promote`'s `ready` action) must follow up
   * with an explicit `push()` to publish it; easy to miss since the
   * docstring alone doesn't make this obvious. */
  createBranch(newBranch: string, fromRef: string): Promise<void>;

  /** `git checkout <branch>` — switches to an already-existing branch
   * (§3.9's `--fix`; §3.13's `<ref>` switch; and restoring the starting
   * branch after `promote`'s fork, per §2.1's branch-restoration
   * invariant). */
  checkout(branch: string): Promise<void>;

  /** `git add -A && git commit -m "<title>" -m "<message>"`, then
   * `git rev-parse HEAD` for the returned SHA. Generic — has no
   * WIP-specific knowledge itself; `wip.ts` (§3.12) builds the full
   * `{ref}: {title} - WIP` formatted title/message *before* calling
   * this. The sole commit-creation primitive; never used for ordinary
   * work commits (§1.1). */
  commitAll(title: string, message?: string): Promise<string>;

  /** `git push origin <branch>`, or `git push origin <branch>
   * --force-with-lease` when `opts.force` is set — safe specifically
   * because `fetch()` always runs first (§1.1), keeping the local
   * remote-tracking ref fresh enough for the lease check to mean
   * something. Used after `commitAll` (§3.12) and after every rebase
   * below (§3.5). */
  push(branch: string, opts?: { force?: boolean }): Promise<void>;

  /** The non-destructive half of `merged-pending-pull` (§3.3).
   * If `branch` doesn't exist locally: `git branch <branch>
   * origin/<branch>` (create only, no checkout — kept symmetric with the
   * other single-purpose primitives here; callers use `checkout()`
   * separately if they want to switch to it).
   * If it does exist: first verify `git merge-base --is-ancestor
   * <branch> origin/<branch>` — a genuine fast-forward must actually be
   * possible — then `git branch -f <branch> origin/<branch>`. The
   * verification matters: blindly forcing the ref without checking
   * direction would silently discard a local-only commit if this were
   * ever called on a branch that had diverged. */
  pullFastForward(branch: string): Promise<void>;

  /**
   * Rebases `branch` onto `ontoRef` in place (no push) — the shared
   * primitive behind every rebase-forward case in §3.5: `spec/{ref}`
   * amended under an existing `test/{ref}`; `build/{ref}`'s pre-existing
   * commits reordered onto a fresh test->build merge (step 4); and
   * `spec/{ref}`/`task/{ref}` rebased onto a newer `main`.
   *
   * Internally: derives `upstream` per the caller's scenario —
   * `mergeBase(spec/{ref}, test/{ref})` or `mergeBase(main, branch)` for
   * the two linear cases; the **prior** (superseded) Build Gate PR's
   * `mergeCommitOid` (via `GitHubTool.findMergedPRs`, not `headRefOid` —
   * see §4.9) for the build-reorder case, since by that point `test/{ref}`
   * already contains the *new* content and a plain merge-base against it
   * wouldn't find the old boundary at all. Verifies `rev-list --count
   * upstream..branch == 1` — if not, returns `unexpected-commit-count`
   * without attempting any rewrite (see the note above this interface).
   * If exactly 1, runs `git rebase --onto <ontoRef> <upstream> <branch>`
   * and reports `conflict` or `ok`. Reports rather than resolves any
   * conflict — per §3.5's appendix, newly-merged, human-reviewed content
   * takes precedence and the agent must adjust their own WIP to match
   * it, never the reverse.
   */
  rebase(branch: string, ontoRef: string): Promise<RebaseOutcome>;

  /** `git branch -D <branch>` (tolerates "doesn't exist locally" as a
   * no-op, not an error) + `git push origin --delete <branch>` — used
   * only by final cleanup once the Main Gate PR merges (§3.6); never for
   * any earlier transition. */
  deleteBranch(branch: string): Promise<void>;
}
```

### 4.9 `deps/gh.ts`
Wraps `gh pr create` (opening destination-gate PRs) and `gh pr list
--state merged`/`--state open` — the **sole** merge/PR-status detection
mechanism in the tool, used for both `test/{ref}` → `build/{ref}` and the
final Main Gate transition (§3.3), deliberately never via SHA/ancestry
comparison, since no GitHub merge method reliably preserves either. Never
performs a merge itself.

**A base/head pair can have more than one merged PR over a ref's
lifetime.** This isn't an edge case to defend against — it's a designed
use case: a second Build Gate PR (`test/{ref}` → `build/{ref}`) is exactly
what's needed whenever tests need to change after the first one already
merged (§3.5). `findMergedPRs` (plural) returns the full history for a
base/head pair, sorted oldest-first, so callers can distinguish "the most
recent merge" (ordinary merge-status detection, §3.2/§3.3) from "the merge
immediately prior to the current one" (the old boundary `rebase()` needs
for the build-reorder case, §4.8). `findMergedPR` (singular) remains as a
convenience over it, returning only the most recent.

```typescript
// Concrete shape of `GitHubTool` (§2's `ExternalTools.github`), implemented
// by this file as a thin wrapper over the `gh` CLI. This is the *sole*
// merge/PR-status detection mechanism in the tool (§3.3) — deliberately
// never via SHA/ancestry comparison, since no GitHub merge method reliably
// preserves either.

interface PullRequestSummary {
  number: number;
  url: string;
}

interface MergedPullRequestSummary extends PullRequestSummary {
  mergedAt: string;    // ISO-8601
  headRefOid: string;  // the head branch's SHA at the moment it was merged —
                        // compared against the branch's *current* HEAD to
                        // detect a superseded merge (§3.5, step 1)
  mergeCommitOid: string; // the SHA of the commit actually created on the
                        // BASE branch by the merge (distinct from
                        // headRefOid — this is what build/{ref}'s history
                        // actually contains). Needed as the old-boundary
                        // reference for the build-reorder case (§4.8);
                        // not meaningful for a plain fast-forward/squash
                        // detection, only for locating where prior content
                        // landed.
}

interface GitHubTool {
  /** `gh pr create --base <base> --head <head> --title "<title>" --body
   * "<body>"` — opens a destination-gate PR (§3.7). Note: `gh pr create`
   * does not support `--json`; it prints the PR URL to stdout on success.
   * Implementation parses the PR number out of that URL, or issues a
   * follow-up `gh pr view <head> --json number,url` — either way, the
   * caller only sees the resulting `PullRequestSummary`. Never merges. */
  createPR(
    base: string,
    head: string,
    opts: { title: string; body?: string },
  ): Promise<PullRequestSummary>;

  /** `gh pr list --base <base> --head <head> --state merged --json
   * number,url,mergedAt,headRefOid,mergeCommit --limit 50`, sorted
   * oldest-first by `mergedAt` (`mergeCommit.oid` mapped to
   * `mergeCommitOid` above). Full merge history for this base/head pair
   * — see the note above this interface for why more than one entry is
   * an expected, designed-for case, not an edge case. */
  findMergedPRs(base: string, head: string): Promise<MergedPullRequestSummary[]>;

  /** Convenience over `findMergedPRs` — the most recent entry, or `null`
   * if none. Used wherever only "has this merged (yet)" matters (§3.2/
   * §3.3's ordinary merge-status derivation). */
  findMergedPR(base: string, head: string): Promise<MergedPullRequestSummary | null>;

  /** `gh pr list --base <base> --head <head> --state open --json
   * number,url` — the currently open PR for this base/head pair, if any
   * (§3.2, `awaiting-pr`); `null` if none. */
  findOpenPR(base: string, head: string): Promise<PullRequestSummary | null>;
}
```

### 4.10 `deps/fs.ts`
Wraps file system commands to support unit testing.

```typescript
// Concrete shape of `FileSystemTool` (§2's `ExternalTools.fileSystem`),
// implemented by this file. Used by `lib/task-doc.ts` (task-doc/spec
// scaffolding, §4.6) and `init` (§3.8) — never by any git-mutating path.

interface FileSystemTool {
  /** Locates and parses the nearest `.task-phases.json` walking up from
   * cwd to the repo root (§2's `TaskPhasesConfig`). */
  loadConfig(): Promise<TaskPhasesConfig>;

  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;

  /** Copies `src` to `dest`, creating parent directories as needed —
   * backs `init`'s `--doc`/`--specs` copy steps (§3.8). */
  copyFile(src: string, dest: string): Promise<void>;

  /** Creates `path` (and parents) if it doesn't already exist — backs
   * `init`'s "creates task dir if it does not exist" (§3.8). */
  mkdir(path: string): Promise<void>;

  /** Lists entries directly under `path` — used by `list.ts`/
   * `task-doc.ts` to enumerate existing task dirs. */
  readDir(path: string): Promise<string[]>;
}
```

---

# Appendix

### 3.1 Branch topology — a new branch per phase, not a rename

This is a deliberate reversal of an earlier draft of this design, which
modelled spec→test as a rename. A rename destroys the earlier branch
object, which is incompatible with amending an earlier phase and rolling
the change forward (§3.5) — there would be nothing left to amend. "Only
one branch per task" is therefore **not** a literal git constraint; it's a
statement about what's authoritative for phase derivation (§3.2) — the
furthest-forward branch reachable from the task's history, not a claim
that earlier branches don't exist.

### 3.3 Merge detection: always via `gh`, never via SHA/ancestry

The assumption was dropped after checking GitHub's actual merge options:
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

### 3.5.a Amending an earlier phase and rolling forward

This is judged safe **specifically because** branch-lifecycle discipline
is strict elsewhere in this design: `test/{ref}` can only ever have been
created by `init`/`promote` itself, forked from `spec/{ref}` at some prior
HEAD — so its existence in this state is proof it's a legitimate,
rebase-able descendant, not an unrelated branch someone created by hand.
`promote` still verifies this rather than assuming it blindly: before
rebasing, it confirms `git merge-base <old-spec-HEAD> test/{ref}` actually
resolves to a commit on `spec/{ref}`'s prior history, turning "this must be
true given our discipline" into "this is confirmed true" before rewriting
anything. (This verification is now folded into `rebase()`'s own
commit-count precondition, §4.8 — a count of exactly 1 relative to the
derived `upstream` is what makes "confirmed true" concrete.)

### 3.5.b Amending an earlier phase and rolling forward

This is judged **safe to attempt automatically** (once confirmed) at step
4 specifically because of the strict, mutually exclusive file scoping
between phases enforced by the gates themselves — the test phase touches
only `/test`, the build phase touches only `/src` — so a genuine conflict
during that rebase should essentially never occur if that discipline
holds. (Any refinement to that file-scoping discipline — e.g. interface
files needing special handling — is `gate-check`'s scope-rule concern, not
something this document tracks.) On the rare case of an actual conflict
during step 4's rebase, `promote` surfaces it directly rather than
attempting to resolve it — the newly-merged, human-reviewed test content
takes precedence, and the agent must adjust their build-phase WIP to
match it, never the reverse.
