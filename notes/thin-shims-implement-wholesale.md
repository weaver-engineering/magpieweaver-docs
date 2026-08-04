## Thin shims over external dependencies should be implemented in one go

**Correction (2026-08-04): the title's conclusion is wrong and has been
superseded — see "What to change going forward" below.** Building the
whole shim upfront trades a real problem (this incident) for a worse one
(speculative code for methods that may never be needed), directly against
this project's own incremental-delivery philosophy. Kept in place,
annotated, per this repo's convention — not deleted — because the
incident and diagnosis below are still accurate; only the fix changed.

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

### Scope note: this belongs to "the loom", not to Magpie Weaver

`gate-checks` and `task-phases` — and this note, and the process it
describes — are not really part of Magpie Weaver. They are tooling for
**weaver-engineering's "loom"** (working name): the support an architect
needs to do agentic software development effectively — "weaving". The
need for both packages was exposed by attempting to build Magpie Weaver
agentically; they live in the `magpie-weaver` repo today only because
that is where the need surfaced.

Both are expected to move to their own repo and project (`the-loom`,
name to be confirmed). Worth keeping in mind when reading anything in
this note or its siblings: the *lessons* are about agentic development
practice generally, not about Magpie Weaver's own domain, and should
survive the move intact. Where a lesson is stated in terms of
`task-phases`' specifics (`deps/*.ts`, `build-implementer`, the
spec → test → build gate model), the underlying principle is the general
one — a thin shim over an external dependency, an agent role that cannot
write its own tests, a phase gate that measures coverage.

> Original recommendation, superseded by the above — kept for the
> decision history, not currently in effect:
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
to any single chunk's own spec, tests, or review. Second data point on
where this project's spec → test → build cycle needs a design-conformance
check that isn't just "does this chunk's own behavior match its own
spec."
