# Sequenced Spec Supervision — Notes & Rationale

Companion to `sequenced-spec-supervision-CLAUDE.md`. That file is the
operating instruction set; this is the reasoning, written for you.

## What this workflow is

Driving a backlog of pre-specced chunks through spec → test → build,
one at a time, with agents doing the test and build phases and the
architect owning specification, review, and verification. It is the
workflow MAG-46 has been running for its whole life, and most of what
follows is a distillation of what actually went wrong and what caught it.

## The single highest-value step

**Pre-handoff spec review.** It has found a genuine, load-bearing defect
in every chunk it's been applied to:

- **Spec 09** — the spec directed baking gate resolution into the shared
  derivation pipeline, contradicting the LLD's own rule that only
  `promote` and `status --check` resolve `ready?`, and contradicting the
  spec's own required behaviour two sections later.
- **Spec 10** — directed calling `gateChecks.run` directly, duplicating
  logic `resolveReady()` already owned; and asserted a post-fork state
  that was simply wrong.
- **Spec 10, second pass** — the fork left `test/{ref}` checked out in
  the architect's worktree, locking the agent out of the branch it was
  about to need.
- **Spec 10.01** — the same worktree bug again, in a different guise:
  `rebase()` checks out the branch it rebases, so rebasing `test/{ref}`
  from `spec/{ref}` parks you on `test/{ref}`.
- **Spec 11** — `promote` would raise a PR against `build/{ref}` without
  anything ever creating it.

None of these would have been caught by CI, by the agent, or by review of
the resulting code, because in each case the code correctly implemented
what the spec said. The defect was upstream.

## Why the shim-dependency check earns its place

Mocked system tests validate that the *caller* uses an interface
correctly. They say nothing about whether the interface is *implemented*.
`promote` shipped with a full green suite and crashed the instant it ran
for real, because its own logic reached `RealGitTool.isAncestor`, a stub
deferred to a later chunk through a shared code path (`deriveRepoState`)
that no chunk's spec mentions.

The lesson generalised into a three-tier decision (see
`notes/design-workflow-findings.md`, Finding 1), and — importantly — into
*when* the decision gets made: at chunk/sequence time, with pre-handoff
review as a backstop. The difference between MAG-46-05.01 (noticed while
scoping, got its own clean cycle) and `isAncestor` (noticed by a crash in
merged code, got an emergency fix) is entirely *when the question was
asked*, not how hard it was to answer.

## Why prior-behavior retirements recur, and why that's not a planning failure

Three times now (specs 11, 11.01, 12 — a fourth, spec 15, already known
to be coming), a chunk's required behavior has directly contradicted a
specific assertion in an already-merged test file
(`defers-when-gate-pr-exists.test.ts`, a single blanket placeholder
written once in spec 06.01: "any gate PR on any base/head pair defers").
The instinct is to read this as a sequencing miss — if we'd planned
better, wouldn't we have avoided needing the fix-up? Mostly no, and it's
worth being precise about why, because the honest answer isn't "we did
great" or "we should have planned harder" — it's that this specific cost
is structural, not a symptom.

06.01's own comment already named, correctly, which future chunk would
retire each case ("owned by later chunks MAG-46-11/12/15") — about as
good as design-time foresight gets. That foresight didn't make the
retirement automatic or unnecessary; a quick-route commit was still
needed every time, because what makes it necessary is a *rule*, not a
*gap in planning*: `test-writer` cannot edit an existing test file, even
one its own chunk's required behavior obviously supersedes. That rule
exists for a good reason (stop an agent silently patching around a test
it broke by accident) and we want to keep it, which means the retirement
tax is the accepted price of keeping it, not evidence the backlog was
sequenced badly. See `notes/design-workflow-findings.md` Finding 3 for
the full generalisation, including where the check now belongs (a batch
pass across a run of upcoming chunks, with each chunk's own pre-handoff
review as a backstop — the same two-tier shape as the shim-dependency
check above) and the exact formulaic retirement recipe.

The real counterfactual worth asking isn't "could we have avoided the
tax" — it's "was the alternative better." The alternative was bundling
11/11.01/12/15 into one chunk, so a single `test-writer` session rewrites
the whole gate-PR-pair surface at once with nothing ever landing in an
intermediate, partially-contradicted state. That does avoid the tax. It
also produces a much bigger, harder-to-review diff and works against
this project's own preference for small, independently-gated increments
— and the original blanket test wasn't free-floating overhead either: it
caught a real bug (spec 06.01's own `assertNoGatePR` dead-code/unwired
defect) that a "ship nothing until the real behavior exists" alternative
would have missed entirely. Small chunks plus a small, predictable,
well-understood retirement tax beats fewer, bigger chunks that dodge the
tax but lose the review granularity and the early-bug-catching value of
having a test at all.

**What genuinely was avoidable, and is a real planning miss, not a
structural cost:** the `main-gate` trunk-drift gap
(`build-implementer` had to improvise a rebase mid-session because
nobody had designed for `main` advancing between `build/{ref}`'s creation
and its own Main Gate PR, even though the *analogous* spec/quick
trunk-drift case was already solved), and the test-file-layout doc citing
the wrong rule for spec 11.01 §3.4 (an authoring slip, not a structural
cost). The batch pre-sequencing review that caught spec 14's harness gap
before it repeated a fourth time is exactly the practice worth keeping
for *this* category — it's the retirement tax's structural cousins that
batch review actually prevents, not the tax itself.

## Why I run e2e tests even when everything is green

Because everything being green is exactly the condition under which the
`isAncestor` bug shipped. The mocked suite, the coverage gate, and CI all
passed, twice — before the first merge and after. A real disposable ref
plus the real built CLI found it in one run.

The discipline that matters: assert on the **repo state afterward**, not
on the tool's own output. A tool reporting `action: "forked"` is a claim;
`git log` on the branch it says it created is evidence.

## Fail-then-pass proves a test fails pre-implementation. It doesn't
prove the fixture is answerable.

A new failure mode, distinct from both the shim-dependency check and
prior-behavior retirements above: `task-MAG-46-18`'s bad-`--specs` test
had a fixture where both the "good" and "missing" paths resolved
identically under the default `exists()` mock (only `templates/*`
existed) — yet the test asserted one gets copied and the other doesn't.
Nothing in that fixture could tell any implementation, correct or not,
which was which. It still failed red against the pre-implementation
stub, exactly the way a genuinely-answerable test would have — because
*every* test in an unimplemented file fails pre-implementation, whether
its fixture is coherent or not. Fail-then-pass answers "does this fail
now," not "can any correct implementation make this pass later," and
those are different questions that happen to look identical from the
outside until someone actually tries to implement it.

Missed at architect review (fail-then-pass confirmed, full suite green,
mocks correctly scoped — all real checks, none of them the right
question here) and caught downstream by `build-implementer`, who
correctly recognised it as outside its own authority (`test/**` is off
limits) and reported the exact mechanism rather than guessing at a
workaround. That round-trip is exactly what item 5 under "Reviewing an
agent PR" (`sequenced-spec-supervision-CLAUDE.md`) now exists to avoid:
for every assertion expecting two different outcomes from two different
inputs, check the fixture's mocks actually produce two different
results for them.

## Validate a design correction against the actual code before agreeing with it

When a proposed simplification sounds right, check whether the *system*
already agrees with it before accepting or building it — don't just
reason about it in the abstract. MAG-49's design (`build-implementer`
commits locally to `build/{ref}` and `promote` does one terminal rename-
and-raise, instead of creating `ready/{ref}` from session start and
hand-managing it throughout) turned out to already be exactly what
`packages/gate-checks/src/checks/main-gate.ts` was built for — its own
code comment says so directly: local `build/{ref}` and `ready/{ref}` are
explicitly treated as equivalent for self-verification, "possibly before
[the agent] has renamed/pushed `ready/{ref}` yet." The standing
instructions had simply never been built to use the design the gate
check already supported. Reading that file before agreeing turned "this
sounds plausible" into "this is confirmed, and here's the exact existing
mechanism to build on" — and, separately, turned up that the obvious
literal mechanism for one part of the fix ("force push `build/{ref}` to
`origin/ready/{ref}`") doesn't exist as a primitive (`push()` has no
refspec form for pushing a local branch onto a differently-named remote
ref) before that gap became a mid-implementation surprise instead of a
design-time one.

## Things that bit us, mechanically

- **Squash vs rebase on the Build Gate PR.** Squashing `test/{ref}` into
  `build/{ref}` collapses spec+test into one commit, so the build branch
  reaches `main` with 2 commits where `main-gate` wants 3. The LLD
  actively recommended squashing, with detailed but wrong reasoning
  (it assumed `build/{ref}` forks from `spec/{ref}`; it forks from
  `origin/main`). Corrected in place.
- **Branch-checkout exclusivity.** One branch, one worktree. Any tool
  operation that moves the worktree — `createBranch`, `rebase` — can hand
  a branch to the wrong worktree and lock the other one out. Now a
  general invariant (LLD §2.1): a command leaves the worktree on the
  branch it found it on, except the commands whose purpose is switching.
- **Stale phase branches.** Not clearing down after a merge left a
  `build/{ref}` whose content matched `main` but whose commit lineage
  didn't, producing a merge conflict that looked like a content conflict
  and wasn't.
- **Reused refs poison PR-based derivation.** Running every chunk under
  one ref means `assertNoGatePR` finds merged gate PRs from previous
  chunks and defers permanently. `status` cannot answer for `MAG-46` at
  all until the merged-PR states land (chunks 12/15). This is why the
  agents' start protocols were still raw git for as long as they were —
  resolved for `test-writer`/`quick-scaffolder` once `task-phases`
  completed (MAG-40's close-out); see "What we decided not to fix" above
  for why `build-implementer` only partially converts, and why that's a
  real boundary rather than an oversight.

  **A second, sharper-edged instance of the same root cause, found later
  (specs 17/18):** it's not just that `status` can't answer for a reused
  ref — `derivePrState`'s merged-PR-pair lookup will always find *some*
  historical merged PR for `(build/{ref}, test/{ref})` once a ref has
  been through more than one chunk, and unconditionally calls
  `headSha("origin/test/{ref}")` to compare against it. Right after a
  chunk's phase branches are cleared down and before the next chunk's
  `test/{ref}` is pushed, that ref briefly doesn't exist at all, and the
  call throws with no error handling — a genuine, previously-latent crash
  that has nothing to do with MAG-46-specific reuse and would hit *any*
  ref reused a second time after a full merge cycle (rare in normal
  product use, guaranteed for this project's own self-hosted backlog).
  Fixed by resolving the branch/parent arguments through the same
  `resolveBranchRef` pattern already used elsewhere for exactly this
  class of problem, plus a real, previously-undiscovered *silent*
  version one level deeper: the same unresolved-ref pattern in
  `hasCommitsBeyond`'s parent argument doesn't crash, it silently reports
  `not-started` where the correct answer is `ready?`, because
  `RealGitTool.hasCommitsBeyond` swallows a failed `rev-parse` into
  `false` rather than throwing. Caught only by real e2e verification
  against a genuine remote-only-ref fixture — see "Why I run e2e tests
  even when everything is green" above; this is the same discipline,
  just two levels deeper than the `isAncestor` case that originally
  established it.
- **The architect's own worktree discipline is a real, confirmed failure
  mode, not just an agent one.** Branch-checkout exclusivity (above)
  isn't only a risk when a *tool* moves the worktree — running the
  architect's own `git` commands (a permission-config fix, a doc commit)
  in the same worktree a live agent session is using can switch the
  branch out from under it mid-turn. It happened: the architect switched
  branches to prep an unrelated fix right as `test-writer` ran `git add
  -A && git commit`, landing the commit on the wrong branch (parented off
  `main` instead of `spec/{ref}`). Recovered by cherry-picking it back
  once diagnosed via `git reflog`, but the fix that actually matters is
  process, not recovery technique: the architect now uses one dedicated
  worktree that no agent session ever runs in, full stop — see the Hard
  Rules in `sequenced-spec-supervision-CLAUDE.md`.
- **A custom tool silently running against the wrong directory looks
  identical to a real environment quirk, for a very long time.** Both
  `gate-check` and `task`'s custom-tool implementations called
  `execFile("pnpm", [...])` with no `cwd`, so every call ran against the
  OpenCode *server* process's own working directory (the main
  detached-HEAD checkout), not the calling session's worktree — silently,
  since the moment these tools were first deployed. The signal that this
  was a real bug, not environmental fact, wasn't any one session hitting
  it — it was the same "gate-check runs in the detached main checkout,
  that's an environment quirk" message recurring across many independent
  sessions over time, each one working around it rather than questioning
  it. Fixed by reading the plugin SDK's own `context.directory` (which a
  *third* custom tool in the same directory, `session-info.ts`, already
  used correctly for `context.sessionID` — the working example was
  sitting right next to the broken ones the whole time). Worth the
  general lesson: a pattern several independent sessions each explain
  away the same way is worth one session actually asking why, rather than
  the explanation just propagating.

## What we decided *not* to fix, and why

- **The seven-step git start protocol.** It has a real skip-ahead flaw.
  We're leaving it, because the whole thing collapses to one
  `task status --ref <ref>` call once the tool's derivation is
  trustworthy. Fixing it now is work thrown away.

  **Resolved (MAG-40, once `task-phases` completed):** it did collapse,
  almost exactly as predicted. `test-writer` and `quick-scaffolder`'s
  start protocols are now built entirely on `task status`/`promote`/
  `<ref>`-switch calls, no raw `git` branch navigation left.
  `build-implementer` converts everything *except* the `ready/{ref}`-
  specific mechanics, for a reason worth understanding rather than
  reading as a leftover: the derivation pipeline models exactly four
  phases (`spec`/`test`/`build`/`quick`) and has no concept of
  `ready/{ref}` at all — that branch is a manual convention introduced
  *after* the phase model was fixed, to work around `build/{ref}` being
  branch-protected, and was never folded into it. So "the tool is
  trustworthy now" turned out to be true for three of four phases and
  quietly false for the fourth, in a way that only became visible once
  someone actually tried to finish the collapse — see MAG-49, which
  closes that specific remaining gap (`promote`'s missing
  `build::ready -> pr-raised` action, the literal "test->build /
  build->main ready hops belong to a later chunk" the code's own
  fallthrough comment named from the start).
- **`isAncestor`'s missing coverage.** Left as known debt for MAG-46-13
  to absorb, rather than backfilling immediately. Your call, and the
  right one for a first run through the process: "making mistakes in the
  early stages of dog-fooding is expected and exactly what drives
  improvement."

## Scope note

This workflow, `gate-checks`, and `task-phases` are not really Magpie
Weaver. They're **the loom** — weaver-engineering's tooling for doing
agentic software development. Magpie Weaver is where the need surfaced,
not what the tooling is for. Expect all of it to move to its own repo
(`the-loom`, name TBC). These notes should survive that move: read the
`task-phases` specifics as instances of general problems — a thin shim
over an external dependency, an agent role that can't write its own
tests, a phase gate that measures coverage, a backlog whose chunks share
a ref.
