# Design Workflow Findings

Discrete findings from driving MAG-46's spec → test → build cycle
agentically, each one a pattern in how to design and sequence work for
this kind of delivery — not specific to Magpie Weaver's own domain.
Collected here as they're found, one `##` section per finding.

**Scope note:** this document — and `gate-checks`/`task-phases`
themselves — belongs to weaver-engineering's **loom** (working name):
tooling for an architect to do agentic software development effectively,
not to Magpie Weaver. The need surfaced by attempting to build Magpie
Weaver agentically; that's the only reason it lives in this repo. Expect
a future move to a dedicated repo (`the-loom`, TBC). Read every finding
below as a general principle about agentic development practice, stated
in `task-phases`' own terms only because that's where it was found.

## Finding 1: thin shims over external dependencies — three tiers, chosen at sequencing time

**Correction (2026-08-04): the original version of this finding's
conclusion — build the whole shim upfront — was wrong and has been
superseded by "What to change going forward" below.** Building the whole
shim upfront trades a real problem (the incident described here) for a
worse one (speculative code for methods that may never be needed),
directly against this project's own incremental-delivery philosophy.
Kept in place, annotated, per this repo's correction convention — not
deleted — because the incident and diagnosis are still accurate; only
the fix changed.

**Context:** `@magpieweaver/task-phases`'s `GitTool` (`deps/git.ts`) is a
thin wrapper over the `git` CLI. It was built incrementally, chunk by
chunk, each one implementing only the methods its own spec's tests
needed: spec 01 implemented `fetch`/`currentBranch`/`createBranch`/etc.,
spec 05.01 added `isDirty`/`hasCommitsBeyond`/`headCommitTitle`/etc., and
`mergeBase`/`isAncestor`/`rebase` were deliberately left throwing
`"not implemented"`, deferred to a later chunk (MAG-46-13) explicitly
scoped to build them for real. This was reasonable chunk-by-chunk
discipline on its own terms — each deferral was a considered decision,
not an oversight.

MAG-46-10 (`promote`'s `spec::ready -> forked` action) was then written,
tested, and merged with a fully passing mocked system-test suite. The
tests mock `GitTool` entirely, so they neither know nor care that
`isAncestor` is still a stub. It only crashed the moment it was run for
real, against real git state: `promote`'s own logic — correct, per its
spec — calls the shared derivation pipeline a second time after forking,
to report the post-fork status, and that second call reaches
`isAncestor` the instant `test/{ref}` exists. Caught only by deliberate
end-to-end testing against real git state after the PR had already
merged — not by CI, not by review, not by the mocked test suite.

### Why it was missed

Mocked tests validate that the *caller* uses an interface correctly.
They say nothing about whether the *interface* is actually implemented.
A caller written correctly against the full `GitTool` shape can crash
unpredictably the first time it happens to reach a method some other,
unrelated future chunk was going to fill in — and the gap is invisible
until something outside the deferring chunk's own control needs that
method earlier than planned. MAG-46-10 had no way to know, from its own
spec or tests, that `isAncestor` wasn't real yet; nothing in the process
connects "this chunk's logic calls method X" to "is X actually
implemented, or still a stub owned by a later chunk."

### What to change going forward

The original per-chunk-builds-what-it-needs approach was the right call
— it matches this project's incremental delivery of system-level
behavior, and building unneeded methods speculatively is real waste, not
free insurance. What was actually missing wasn't upfront breadth; it was
two things: a way to *notice*, at spec time, when a chunk depends on a
shim method that isn't real yet, and — the harder part — a way to make
sure implementing it produces real *test coverage*, not just
correctness.

That second part is why simply telling a chunk "implement what you need"
isn't enough on its own. `deps/*.ts` is excluded from coverage
measurement precisely because real proof for this file class is expected
to come from `--dev-testing` subprocess tests (see specs 01/02/03/05.01/
07, each of which pairs its real `GitTool`/`GitHubTool`/`FileSystemTool`
additions with exactly such a test) — and `build-implementer` cannot
write those tests, being hard-permission-blocked from `test/**`. A real
shim method added inline inside an unrelated functional chunk's own
build commit — which is what actually happened with `isAncestor`, as a
deliberate, explicitly-authorized one-off — structurally cannot get real
coverage that way. It was accepted as known debt for one small, low-risk
primitive, not a shortcut to generalize from.

**The corrected process: when a spec chunk's own logic newly depends on
a shim method that isn't real yet, that's a signal to insert a small,
dedicated dev-testing chunk (spec → test → build) ahead of it in the
backlog** — not to build the whole shim speculatively, and not to bolt
the real implementation into the dependent chunk's own build commit.
This mirrors MAG-46-05.01 exactly: spec 05 discovered it needed more real
`GitTool` methods than existed, and rather than either extreme, the
project carved out 05.01 as its own small, focused cycle. That's the
mechanism that actually produces coverage — `test-writer` writes the
dev-testing test, `build-implementer` makes it pass — for roughly the
same cost as adding the method inline, just routed through the phase
that's actually allowed to write the test.

**Addendum (2026-08-04, later the same day): a third tier, for when
formal dev-testing coverage genuinely isn't practical.** Some shim
methods are thin enough — a single exit-code check, a trivial
pass-through — that a dedicated spec → test → build cycle is
disproportionate, but they still deserve better than an ad-hoc bolt-on
into an unrelated chunk's build commit. For these, use the **quick route**
(`task/{ref}` → `main`, `quick-scaffolder`) to implement the method on its
own, and substitute a full manual end-to-end test (a real disposable
branch, the real built CLI, real assertions on the outcome — the same
shape as the architect's own e2e verification throughout MAG-46) for the
missing automated test. Record what the manual verification covered in
the task doc, so there's still a durable trail even without an automated
test — "manually tested" with no record of what was checked is not
falsifiable six months later.

This isn't a cost-cutting shortcut on the same footing as the ad-hoc
bolt-on it replaces — it's structurally cleaner. `deps/*.ts` is excluded
from coverage measurement entirely (see above), so a quick-route commit
that touches only a shim method sails through `main-gate`'s coverage
check with zero new lines even reaching the denominator: no architect
coverage-override needed at all, unlike the one-off used for
`isAncestor`. It also gets its own task doc and its own reviewable PR,
rather than riding along inside a chunk it has nothing to do with.

So, three tiers, not two:
1. **Dedicated dev-testing chunk** (spec → test → build, MAG-46-05.01's
   precedent) — when the primitive is complex or risky enough to warrant
   durable automated coverage.
2. **Quick route + documented manual verification** (this addendum) —
   when formal automated testing isn't practical, but the method still
   deserves its own scoped, reviewable, documented change.
3. **Ad-hoc override** (what actually happened with `isAncestor`) — a
   genuine one-off under time pressure, not a pattern to reach for by
   default. In hindsight, `isAncestor` fit tier 2 better than tier 3.

### Where the tier gets chosen: at sequencing time, not discovery time

**The three tiers only work if the choice is made when the backlog is
chunked and sequenced — not discovered reactively mid-build.** That is
the actual difference between how MAG-46-05.01 happened and how
`isAncestor` happened. Both were the same situation (a chunk needs a
shim method that isn't real yet); 05.01 was noticed while scoping and
got its own deliberate cycle, `isAncestor` was noticed by a crash in
production code that had already merged, and got an emergency fix.

So the check belongs in the design → chunk → sequence workflow, as a
step with a name:

- **When chunking:** for each spec chunk, enumerate the shim methods its
  logic will actually reach at runtime — not just the ones its own tests
  will mock. The mocked-test blind spot described above is precisely why
  "what does this chunk call?" cannot be answered from the chunk's own
  test plan.
- **When sequencing:** for each such method that isn't real yet, pick
  its tier and place it in the order *before* the chunk that needs it.
  A tier-1 dev-testing chunk becomes a numbered entry in the backlog; a
  tier-2 quick-route task becomes a queued `task/{ref}`; tier 3 is not
  planned for, by definition.
- **At pre-handoff spec review:** re-run the same check as a backstop,
  since a chunk's spec often gains new implementation detail (Deliverable
  Notes) after the original sequencing pass. This is the last point at
  which the answer is still cheap.

Sequencing MAG-46 got this wrong in a specific, avoidable way:
`mergeBase`/`isAncestor`/`rebase` were all deferred to MAG-46-13, but
several chunks *before* 13 in the running order reach them through
`deriveRepoState()` — a shared code path none of those chunks' specs
mention. The dependency was real and knowable at sequencing time; nothing
in the process asked the question.

> Original recommendation, superseded above — kept for the decision
> history, not currently in effect:
>
> - When scoping spec chunks for a new external-dependency wrapper (a
>   CLI tool, an SDK, a REST client, a filesystem abstraction), prefer
>   one early chunk that implements the entire interface for real, with
>   real dev-testing coverage for every method — even the ones no other
>   chunk needs yet — over spreading it thin across many chunks keyed to
>   individual callers' immediate needs.
> - If a shim is deferred anyway, treat every other chunk's use of that
>   shim as a standing risk until the deferred chunk lands, not just the
>   deferred chunk's own listed dependents.

Same family of gap as `notes/task-phasing-lib-extraction-gap.md` — a
correctness property visible in the LLD's overall design but invisible
to any single chunk's own spec, tests, or review.

## Finding 2: an agent's interface extensions must be additive-only, never edits — and the follow-up toil that implies is unavoidable, not a process failure

**Context:** MAG-46-11's `promote` action needed a git primitive nothing
in `GitTool` (`deps/git.ts`) provided — publish `origin/main` to a new
remote branch name with no local checkout. `test-writer` needed this to
compile its tests against, so it pinned a new, standalone interface,
`GitToolBranchCreation`, in a new file (`git.interface.ts`), rather than
adding the method to `GitTool` itself.

The first question this raised: why not just add the method to `GitTool`
directly, in the same or a differently-organized file? The answer turned
out to matter more generally than this one case.

### Why the addition can never touch the existing interface

**`RealGitTool` already declares `implements GitTool`.** If `test-writer`
added a new required method directly to `GitTool`'s own declaration,
`RealGitTool`'s existing implementation would immediately stop
satisfying that interface — a compile break, in a file (`deps/git.ts`)
`test-writer` is not permitted to touch. There is no way for `test-writer`
to fix what it just broke. This isn't a file-organization problem — it
holds regardless of whether `GitTool`'s interface and `RealGitTool`'s
implementation live in the same file or are already split into separate
`.interface.ts`/`.ts` files. Splitting them doesn't change which methods
an *existing* implementation already claims to have; it only changes
where the (still separate, still additive) extension lives.

So the rule is about structure, not naming: **any interface addition an
agent role makes must be a standalone extension — a new interface, or an
`extends` of the existing one — never an edit to a member the existing
implementation already satisfies.** `test-writer` did the only thing
available to it correctly.

### The follow-up merge is not avoidable, and that's fine

Reconciling the split — folding `GitToolBranchCreation` into `GitTool`
proper, giving `RealGitTool` the real method or at minimum a
`"not implemented"` stub, updating any test that mocked the split
interfaces to mock the merged one — is always a required follow-up once
this happens. No file-layout convention removes that step; it's the
direct consequence of the phase boundary itself (only `build-implementer`
can touch `RealGitTool`, and only in its own build commit).

That follow-up toil is the accepted, correct cost of a **design-time
miss** — the LLD/spec design didn't anticipate the interface need before
handoff — not a defect in how the agent handled discovering it
mid-session. Treat it as a small, expected quick-scaffold task, same
shape as Finding 1's tier 2, not as evidence the process broke.

### The actual prevention: catch it at design time, not naming convention

The one thing worth doing proactively is the same discipline Finding 1
already establishes for shim methods, applied to interfaces specifically:
**if a design or redesign pass identifies that an existing interface
will need a new method, that becomes its own scheduled quick-scaffold
task** — extending the interface and adding either the real
implementation or a `"not implemented"` stub — done *before* any
spec/test cycle that will need it, not discovered reactively by
`test-writer` mid-session.

**What naming precision *does* still buy, separately:** whatever an
agent's standalone extension is called should say precisely what it
contains. `git.interface.ts` was a bad name here — it reads as "the
interface to git," when it's actually one small addition sitting
alongside the real `GitTool`. `git-branch-creation.interface.ts` would
have cost nothing and avoided that confusion. Worth doing on its own
merits; it does not reduce the follow-up-merge cost described above,
which is unavoidable regardless of naming.

## Finding 3: prior-behavior retirements are formulaic, not a spec defect — and don't need stating in the spec that triggers them

**Context:** three separate times across MAG-46 (specs 11, 11.01, 12;
a fourth, spec 15, is already known to be coming), a chunk's required
behavior has directly contradicted a specific assertion in an existing,
already-merged test file — `defers-when-gate-pr-exists.test.ts`, written
once, early (spec 06.01), asserting a blanket "any gate PR on any of the
three base/head pairs defers" placeholder. Each later chunk that gives
one specific pair real behavior instead of deferral makes that one
specific case in the old test provably wrong. Every time, the fix has
been identical in shape: an architect quick-route commit, landed *before*
`test-writer`'s session starts, that retires the one contradicted case
with a `**Correction:**` annotation, leaving every other case in the
file untouched.

### Why this isn't a spec defect, and the language calling it one was wrong

The instinct is to describe this as "the spec contradicts an existing
test" and treat it the same as a genuine spec bug (spec 09's own
self-contradiction; spec 10's wrong post-fork state assertion) — fix by
correcting the spec. That's the wrong model. In every instance so far,
the *new* spec was correct — its whole point is to make one specific
placeholder real. What's "wrong" is that an *older* test's blanket
assertion has reached the end of its validity for one of the cases it
covers, exactly as its own comments already said it would (spec 06.01's
`assertNoGatePR` comment named MAG-46-11/12/15 by number, years — well,
chunks — in advance). The fix is never "change the spec"; it's always
"retire the one now-superseded case in the old test," a different
action entirely, aimed at a different file.

### Why it's formulaic — derivable from the diff, not from spec-author foresight

**The set of prior-behavior retirements a chunk needs is mechanically
computable: it's every existing, already-merged test assertion that the
chunk's own required behavior directly contradicts.** This doesn't
depend on the spec author having predicted it — 06.01's own
unusually-good foresight (naming the future chunks explicitly) didn't
make the retirement optional or automatic; a quick-route commit was
still needed every single time, because the phase-boundary rule that
makes this necessary (agents cannot edit existing test files, so they
cannot retire one themselves even when their own required behavior
obviously supersedes it) is unrelated to how well the eventual need was
telegraphed. Good foresight tells you *which* future chunk will need the
retirement; it doesn't remove the need to actually do it, at that
chunk's own pre-handoff review, as a mechanical step.

**This means a chunk's spec doc doesn't need to mention its own
prior-behavior retirements at all** — unlike a shim dependency (Finding
1) or an interface gap (Finding 2), which the spec's Deliverable Notes
should name because they change what the chunk needs to *build*, a
prior-behavior retirement is entirely about an *unrelated* file the
chunk's own required behavior happens to supersede. Stating it in the
spec would be redundant with information the check below already
produces mechanically, and risks going stale if sequencing shifts.

### Where the check belongs — the same two-tier shape as Finding 1

- **At design/sequencing time, across a run of chunks, not one at a
  time:** for each chunk being sequenced, diff its required behaviors
  against every currently-merged test's specific assertions. Any direct
  contradiction is a prior-behavior retirement that chunk will need.
  Doing this across several chunks at once (as opposed to one chunk's
  own turn) is what let MAG-46-12's retirement get found and fixed
  *before* its own cycle even started, rather than being discovered
  reactively by `test-writer` the way 11 and 11.01's were.
- **At each chunk's own pre-handoff review, as a backstop** — same
  reason Finding 1's shim check has one: sequencing-time analysis can
  miss something, or a spec can gain Deliverable Notes after the
  original pass.
- **Never left to the chunk's own test-writer session to discover.**
  When it has been (11, 11.01), the outcome was still correct — clean
  `needs-architect-intervention` reports, no uncommitted work — but it
  costs a full round-trip the check above avoids for free.

### The formulaic solution, once a retirement is identified

1. Locate the exact contradicted `it()` block(s) in the existing test
   file.
2. Add a dated `**Correction:**` note to the file's own header comment,
   naming the chunk that supersedes it and where the real behavior is
   retested for real (per the test-file-layout doc's own row for that
   chunk).
3. Delete the contradicted block(s) only. Update the file's
   `System behaviors:` comment line to drop the retired IDs. Check for
   now-orphaned test-only helper functions the deleted block was the
   sole caller of, and delete those too.
4. Land as its own quick-route commit (`task/{ref}`), landed and merged
   into `main` *before* the chunk's `spec/{ref}` is created — a
   contradicted test still present when `test/{ref}` forks reproduces
   the exact problem the retirement fixes.
