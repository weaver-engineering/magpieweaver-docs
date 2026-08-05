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
  agents' start protocols are still raw git.

## What we decided *not* to fix, and why

- **The seven-step git start protocol.** It has a real skip-ahead flaw.
  We're leaving it, because the whole thing collapses to one
  `task status --ref <ref>` call once the tool's derivation is
  trustworthy. Fixing it now is work thrown away.
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
