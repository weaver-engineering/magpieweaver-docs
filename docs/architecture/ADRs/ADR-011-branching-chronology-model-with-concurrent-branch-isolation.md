# ADR-011 — Branching Chronology Model with Concurrent-Branch Isolation (Approved)

**Decision:** Model the narrative chronology as a list of chronological
events (a single scene, or a nested sequential/concurrent list of events),
enforcing that an entity can only be on one chronological branch within any
time slice, and that concurrent-branch state changes are invisible to other
concurrent branches until explicitly merged.

**Key rationale:**
- Decouples narrative chronology (time flows forward) from final story order
  (flashbacks, multi-POV), which the target authoring use case requires.
- The single-branch-per-time-slice invariant is what makes concurrent
  narrative branches tractable — without it, entity state could be
  ambiguously defined depending on which concurrent branch is queried.
- Validating this invariant at edit time catches the common case cheaply;
  accepting that merges can transiently violate it (caught by a separate
  validation pass, HLD §9) mirrors how Git itself handles code merges —
  allow, then reconcile, rather than trying to prevent all invalid states
  up front.

**Consequence to note:** requires a dedicated chronology validation
background task (HLD §9, §10.2) and guided repair tooling; without it, the
system could silently accumulate inconsistent chronology state after merges.