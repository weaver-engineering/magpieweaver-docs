## `lib/` extraction missed across two full spec/test/build cycles

**Context:** `task-phasing-lld.md` §1.2 designates `lib/repo-state.ts` and
`lib/task-doc.ts` as shared logic reused across `task-phases`' commands
(§4.5/§4.6 spell out exactly what each owns). Two full chunks — MAG-46-05
(`init`) and MAG-46-06/06.01 (`status`) — went through the complete
spec → test → build cycle and both implemented their own private version
of logic the LLD already designated as shared, without `lib/` ever being
touched. Caught only once a third, unrelated change (`init` committing
its own scaffolded doc) made the duplication concrete enough to notice —
not by review, and not by any test, of either prior chunk.

### Why it was missed

1. **Spec docs don't carry structural detail down from the LLD.** Each
   chunk's spec states behavior at the CLI boundary ("Interface Under
   Test: `pnpm task status ...`"); test-writer's system tests exercise
   exactly that boundary, by design blind to internal module structure.
   Neither spec doc said "this belongs in `lib/repo-state.ts` per LLD
   §4.5" — that fact only existed one document up, in the LLD itself,
   which the chunk's own spec is supposed to be the authoritative
   contract for (see `task-MAG-46.md`: "the per-chunk spec doc is the
   authoritative implementation contract... it isn't re-derived here").

2. **Build-implementer's instructions leave "how much design
   documentation to read" to its own judgement**, not a mandatory step —
   "Read the task doc and spec doc(s) named in your prompt, plus
   whatever design documentation you judge necessary." A cost-conscious
   model doing focused, scoped work will naturally take the path of
   least resistance (implement inline in the file already being edited)
   rather than proactively re-reading a 2000-line LLD's architecture
   section for context nobody pointed it at directly.

3. **Review focused on behavioral correctness, not architectural
   conformance.** Every build PR review checked "does this satisfy the
   spec, do tests pass, is coverage adequate" — never "does this file
   layout match what the LLD says it should be." That's a gap in the
   *architect's* review checklist, not just the agent's output.

4. **No single PR looked wrong in isolation.** `status.ts` implementing
   its own derivation helpers reads as completely reasonable on its own.
   The problem only exists in aggregate — comparing actual layout against
   stated intent — which nothing was doing on any regular cadence.
   Classic architectural drift by accumulation, not one bad decision.

### What to change going forward

- **When a spec doc's behavior is already covered by an LLD-designated
  shared module, state that explicitly in the spec** — "implementation
  lives in `lib/x.ts` per LLD §4.y" — the same way the process already
  states hard constraints explicitly (e.g. "never edit an existing test
  file"). Don't rely on inference from a document the agent wasn't
  specifically pointed at.
- **Add an explicit architecture-conformance check to build-PR review**:
  before approving, check the touched files against the LLD's component
  layout, not only against the spec's behavioral requirements.
- **Treat "will an upcoming chunk need this same logic" as a standing
  question at spec-writing time**, not something left to surface
  reactively once a second consumer actually shows up. It worked this
  time — but only because a mostly-unrelated third change happened to
  make the gap concrete, not because the process was designed to catch
  it.

This is the first full run through the design → spec → implement cycle
for `task-phases` end to end (MAG-46), so treat this as the first real
data point on where that cycle needs tightening, not a one-off mistake
to patch and forget.
