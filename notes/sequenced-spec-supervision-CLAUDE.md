# Sequenced Spec Supervision — Operating Instructions

Load this when driving one or more live agents through a **sequenced
backlog of spec chunks**, each running the full spec → test → build
cycle. Your role is architect: you own the spec, the review, and the
verification. The agent owns the test and build phases.

## The cycle, per chunk

```
architect: clear down → init → copy spec doc → REVIEW → commit → push
  ↓
test-writer session (Begin) → PR → you review → USER merges
  ↓
build-implementer session (Begin) → PR → you review + REAL e2e → USER merges
  ↓
architect: clear down, next chunk
```

## Hard rules

1. **You never merge an agent's PR.** Review, report, hand to the user.
   No exceptions for green CI or a clean review.
2. **Build Gate PRs (`test/{ref}` → `build/{ref}`) are rebase-merged,
   never squashed.** Squashing collapses spec+test into one commit and
   breaks `main-gate`'s 3-commit rule downstream. Main Gate PRs
   (`ready/{ref}` → `main`) are squash-merged as normal.
3. **Clear down between cycles.** After a Main Gate merge, run `pnpm
   task promote` (dogfooded — the tool cleans up `spec/`/`test/`/
   `build/{ref}` itself once you're checked out on the canonical branch)
   then delete `ready/{ref}` separately — `promote`'s cleanup list didn't
   include it until this workflow's own use surfaced the gap (fixed in
   `promote.ts`, but confirm the fix has actually landed in the worktree
   you're running before assuming it's automatic). Do this in every
   worktree, before starting the next chunk. A stale branch reads as
   "already there and fine" to naive existence checks and produces
   spurious conflicts.
4. **Only the standard Begin/Resume prompts**, verbatim.
5. **Fresh session per phase**, at cycle boundaries. **Always pass
   `agent` explicitly** — both in the `POST /session` creation call and
   the first `POST /session/{id}/message` call. Omitting it silently
   falls back to OpenCode's own built-in default agent, not the intended
   sub-agent — confirmed the hard way: a session created without it ran
   an entire kickoff turn as the wrong agent before anyone noticed.
   Verify with `GET /session/{id}` — the `agent` field should already
   read the intended sub-agent's name *before* you send the real kickoff
   prompt, not after.
6. **The architect uses one dedicated worktree, never an agent's own.**
   Running architect-side `git` (branch switches, doc/config commits,
   dogfooded `promote`/`status`) in the same worktree a live agent
   session is using is a real, confirmed way to lose work: switching the
   branch mid-session while the agent runs `git add -A && git commit`
   lands its commit on whichever branch happened to be checked out at
   that instant, not the one it thinks it's on. Nothing was un-recoverable
   the time this happened, but only because the commit was still found
   and cherry-picked back — don't rely on that. Pick one worktree that no
   agent session ever runs in and do all architect git operations there,
   full stop.

## Pre-handoff spec review — do this every time

This has caught a real, load-bearing defect in **every** chunk it has
been applied to. Budget real time for it. Read the spec against the LLD
and the actual current code, and check:

- **Does the spec contradict the LLD or itself?** That's a genuine spec
  defect — fix by correcting the spec doc in place.
- **Does the spec's required behavior directly contradict a specific
  assertion in an already-merged test file?** This is a *different*
  question with a *different* fix — see "Prior behavior retirements"
  below. It is not a spec defect (the new spec is usually correct; an
  older placeholder test has reached the end of its validity for one
  case), so do not "fix" it by editing the spec.
- **Does this chunk's logic reach a shim method that isn't implemented
  yet?** Mocked tests will not tell you — they mock the whole boundary.
  Trace the real call path. If it reaches a stub, decide the tier now
  (dedicated dev-testing chunk / quick-route + manual verification) and
  sequence it *before* this chunk. See `notes/design-workflow-findings.md`
  (Finding 1).
- **Does this chunk need a new method on an already-implemented interface?**
  An agent's own addition must be a standalone extension, never an edit to
  a member the real implementation already satisfies — see
  `notes/design-workflow-findings.md` (Finding 2). If the need is visible
  now, at design time, schedule a quick-scaffold task to extend the
  interface with a stub *before* handoff, rather than leaving the agent to
  discover it mid-session.
- **Does the spec assume a chunk that hasn't landed yet?** Backlog order
  and the LLD's assumed order can differ.
- **Does any git operation move the worktree?** `createBranch` is
  `git checkout -b`; `rebase(branch, onto)` is
  `git rebase --onto <onto> <upstream> <branch>` and checks `<branch>`
  out. A branch can only be checked out in one worktree at a time, so an
  unrestored move locks another worktree out of it.

Correct the spec doc in place with an annotated `**Correction:**` block —
that repo's convention preserves decision history rather than rewriting
it. Land the correction in the docs repo, then copy the corrected doc
into the code repo's `spec/{ref}` commit.

## Prior behavior retirements

A chunk's required behavior can directly contradict a specific
assertion in an already-merged test file — not because either spec is
wrong, but because an earlier chunk's test made a *blanket* assertion
("any gate PR defers", say) that this chunk's job is to make real for
one specific case. This recurs formulaically; it is not a one-off. See
`notes/design-workflow-findings.md` (Finding 3) for the full reasoning.

**Detecting it — do this across every chunk you're about to sequence,
not one at a time:** diff each upcoming chunk's required behaviors
against every currently-merged test file's specific assertions. A direct
contradiction is a prior-behavior retirement that chunk will need. Do
this as a batch pass before starting a run of chunks (catches it before
any chunk's own cycle starts); re-run it at each chunk's own pre-handoff
review as a backstop (catches drift since the batch pass, or anything
the batch pass missed). Never rely on `test-writer` finding it — it will
report `needs-architect-intervention` cleanly if it does, but that costs
a full round-trip the check above avoids for free.

**Fixing it — always the same four steps, always before `spec/{ref}` is
created for the chunk that needs it:**

1. Locate the exact contradicted `it()` block(s) in the existing test
   file.
2. Add a dated `**Correction:**` note to the file's own header comment,
   naming the chunk that supersedes it and where the real behavior is
   retested for real (per that chunk's own row in
   `task-MAG-46-test-file-layout-design.md`).
3. Delete the contradicted block(s) only — nothing else in the file.
   Update the file's `System behaviors:` comment line to drop the
   retired IDs. Check for now-orphaned test-only helper functions the
   deleted block was the sole caller of, and delete those too.
4. Land as its own quick-route commit (`task/{ref}`), reviewed and
   merged into `main` before `spec/{ref}` is recreated for the chunk
   that needs it. A contradicted test still present when `test/{ref}`
   forks reproduces the exact problem this fixes.

**Never** "fix" this by editing the new chunk's spec — the new spec is
what's making the older placeholder correctly obsolete; changing it
would be solving a problem that doesn't exist at the cost of the one
that does.

## Reviewing an agent PR

1. `gh pr checks <n>` — CI status.
2. `gh pr view <n> --json files` — scope. Test phase touches `test/` +
   `docs/tasks/` only; build phase touches implementation only.
   `gh pr diff` shows the *whole* branch diff (all 3 commits on a Main
   Gate PR) — to see just the agent's own commit, fetch the last commit's
   file list via the API rather than reading the PR diff as if it were
   one commit.
3. Read the agent's own commit diff properly.
4. **Verify claims independently.** Especially coverage numbers and
   "gate passes" — reproduce locally rather than trusting the report or
   the CI summary line.
5. **On a test-phase PR specifically: check the fixture is actually
   answerable, not just that it currently fails.** Fail-then-pass proves
   a test fails against the pre-implementation stub — it cannot
   distinguish a genuinely broken implementation gap from a fixture
   that's internally unsatisfiable by *any* implementation. For every
   assertion that expects two different outcomes from two different
   inputs in the same test, trace whether the fixture's mocks actually
   produce two different signals for them. A test whose fixture makes
   both inputs indistinguishable will fail red pre-implementation
   exactly like a correct one would — that's not evidence it's
   answerable, it's the one thing fail-then-pass can't tell you. This
   was missed once (task-MAG-46-18) and caught downstream by
   `build-implementer` instead, costing a full round-trip that this
   check would have avoided for free.
6. Report and hand off. Do not merge.

## End-to-end verification after the build phase

**Mocked tests passing is not evidence the code works.** They mock the
external boundary entirely, so they cannot detect an unimplemented shim
method. Run the real thing:

1. Create a scratch worktree from the PR's actual branch.
2. Build the workspace dependencies, then the package.
3. Create a **real disposable ref** (`ZZZZ-nnn`) with whatever branch and
   commit state the behaviour needs.
4. Run the real built CLI against it.
5. Assert on the **actual repo state afterward**, not just the tool's own
   report — check the branches really moved.
6. Clean up scratch worktrees and branches.

This is how the `isAncestor` crash was found: full mocked suite green,
CI green, crashed immediately for real.

## Coverage: know what's excluded

`deps/*.ts` is excluded from coverage measurement by policy — real proof
for that file class comes from `--dev-testing` subprocess tests, which
in-process coverage cannot see. So a shim method landing with an
unchanged coverage percentage means **its lines were never counted**, not
that they're covered. Say so precisely when reporting.

## Mechanical gotchas worth knowing before they cost you time

- **Recycled branch names on small housekeeping PRs need
  `--force-with-lease`, and that's expected.** A branch like `task/{ref}`
  reused across many small fixes under one enduring ticket (permission
  globs, tool bug fixes, task-doc updates) will often have a prior,
  already-merged commit still sitting on it when you branch fresh off
  `main` for the next one. The push gets rejected as non-fast-forward —
  that's not a sign anything's wrong, just force-push the fresh branch.
- **A wedged-looking GitHub check can be a platform outage, not your
  config.** If a required check sits `queued` far past normal latency,
  or the run/cancel/rerun APIs give self-contradictory answers about the
  same run, check `https://www.githubstatus.com/api/v2/status.json`
  before spending time on a local fix — an active Actions incident there
  explains exactly that symptom and resolves itself once GitHub clears
  it.
- **A custom OpenCode tool that shells out needs `context.directory` as
  `cwd`, always.** `execFile("pnpm", [...])` with no `cwd` runs against
  the OpenCode *server* process's own working directory, not the calling
  session's — silently, for every session, for as long as the tool
  exists. This bit `gate-check`/`task` from their first deployment; the
  giveaway was agents repeatedly, independently rediscovering "wrong
  checkout" as an apparent environment quirk rather than it ever
  surfacing as a bug. If you see that pattern recur for a *different*
  custom tool, check this first.

## Monitoring live sessions

Two different needs, two different tools — don't poll manually for
either.

**Watching one session's own progress:** `curl -s
http://<host>:4096/session/status` — `{}` means idle. Inspect
`/session/{id}/message` (no `/api/` prefix) for real content. For stall
diagnosis and permission recovery, see
`agent-instruction-tuning-CLAUDE.md`.

**Watching for the *result* of a session's work (a branch tip changing, a
PR appearing)** — run a persistent background poll loop and keep working;
let it notify you rather than checking in yourself:

```bash
cd <architect worktree>
last_sha=$(git rev-parse origin/<branch> 2>/dev/null || echo none)
last_pr_count=$(gh pr list --repo <org>/<repo> --base <base> --json number --jq 'length' 2>/dev/null || echo 0)
while true; do
  sleep 30
  git fetch origin -q 2>/dev/null
  cur_sha=$(git rev-parse origin/<branch> 2>/dev/null || echo none)
  if [ "$cur_sha" != "$last_sha" ]; then
    echo "BRANCH TIP CHANGED: <branch> now at $cur_sha"
    git log --oneline -5 origin/<branch> 2>/dev/null
    last_sha=$cur_sha
  fi
  cur_pr_count=$(gh pr list --repo <org>/<repo> --base <base> --json number --jq 'length' 2>/dev/null || echo 0)
  if [ "$cur_pr_count" != "$last_pr_count" ]; then
    echo "NEW PR against <base> (count $last_pr_count -> $cur_pr_count):"
    gh pr list --repo <org>/<repo> --base <base> --json number,title,url --jq '.[0]' 2>/dev/null
    last_pr_count=$cur_pr_count
  fi
done
```

Worked well across the whole spec-16–18 run. Two things worth knowing
before relying on it:

- **`gh pr list --base <base>` isn't scoped to the agent's own PR** — if
  the architect *also* raises a PR against the same base in the same
  window (a permission-config fix, a task-doc close-out), the count
  ticks up for that too. Not a bug — just check `gh pr list` yourself
  when the notification fires rather than assuming it's the agent's PR.
- **Stop the monitor once its purpose is served** (`TaskStop`), rather
  than leaving several running — a stale one watching a branch that's
  already been merged and cleaned up just produces noise.

Match the watched branch/base to the phase: `test/{ref}` tip + PRs
against `build/{ref}` while waiting on the test phase; `ready/{ref}` tip
+ PRs against `main` while waiting on the build phase.

## Keeping the task doc current

Each chunk, update the task doc's **Current Scope** section: what this
chunk covers, what the pre-handoff review found and corrected, and any
incident from the previous chunk worth recording. Move the previous
chunk's section to "Previous scope" rather than deleting it.
