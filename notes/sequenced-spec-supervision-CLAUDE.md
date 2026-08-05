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
3. **Clear down between cycles.** After a Main Gate merge, delete
   `spec/`, `test/`, `build/`, `ready/{ref}` on origin and in every
   worktree, before starting the next chunk. A stale branch reads as
   "already there and fine" to naive existence checks and produces
   spurious conflicts.
4. **Only the standard Begin/Resume prompts**, verbatim.
5. **Fresh session per phase**, at cycle boundaries.

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
5. Report and hand off. Do not merge.

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

## Monitoring live sessions

`curl -s http://<host>:4096/session/status` — `{}` means idle. Inspect
`/session/{id}/message` (no `/api/` prefix) for real content. For stall
diagnosis and permission recovery, see
`agent-instruction-tuning-CLAUDE.md`.

## Keeping the task doc current

Each chunk, update the task doc's **Current Scope** section: what this
chunk covers, what the pre-handoff review found and corrected, and any
incident from the previous chunk worth recording. Move the previous
chunk's section to "Previous scope" rather than deleting it.
