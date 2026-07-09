# ADR-007 — Editing Mode Separation & Commit Granularity (Approved)

**Decision:** Separate authoring into two distinct modes with different
persistence/commit behavior: **Data Entry Mode** (plain field edits,
persisted continuously, no per-edit Git commit) and **Scene Director Mode**
(interactive direction, single commit on `[Wrap]`).

**Key rationale:**
- Prevents Git from being used as a live transactional store — commit
  granularity stays meaningful (one commit per author-approved unit of work)
  rather than one commit per keystroke or field change.
- Scene Director Mode's ephemeral custom entity state attributes only need to
  exist for the duration of a scene, so committing them mid-scene would add
  noise without benefit.
- Matches the natural authorial unit of work (a field edit vs. a completed
  scene) to the natural commit unit.

**Consequence to note:** Data Entry Mode requires its own durability
mechanism independent of Git (write-ahead deltas, see ADR-009), since changes
are persistent before they're committed.
