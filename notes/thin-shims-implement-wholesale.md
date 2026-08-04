## Thin shims over external dependencies should be implemented in one go

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

- **When scoping spec chunks for a new external-dependency wrapper**
  (a CLI tool, an SDK, a REST client, a filesystem abstraction), prefer
  one early chunk that implements the entire interface for real, with
  real dev-testing coverage for every method — even the ones no other
  chunk needs yet — over spreading it thin across many chunks keyed to
  individual callers' immediate needs. The extra up-front cost is small
  (these are thin shims, not real subsystems) and it removes a whole
  class of "passes every test, crashes for real" surprise.
- If a shim is deferred anyway, treat every other chunk's use of that
  shim as a standing risk until the deferred chunk lands, not just the
  deferred chunk's own listed dependents — `promote` wasn't the chunk
  MAG-46-13 was scoped around, but it needed `isAncestor` regardless,
  through a shared code path nobody had traced end to end.

Same family of gap as `notes/task-phasing-lib-extraction-gap.md` — a
correctness property visible in the LLD's overall design but invisible
to any single chunk's own spec, tests, or review. Second data point on
where this project's spec → test → build cycle needs a design-conformance
check that isn't just "does this chunk's own behavior match its own
spec."
