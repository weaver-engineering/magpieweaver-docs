# ADR-018 — Prose as Write-Once Flat Files Outside GitDataStore (Approved)

**Decision:** Store generated scene prose as flat text files with a YAML
header (Scene ID, commit reference, at minimum), living in the Git
repository but outside `GitDataStore`'s JSON metadata layer entirely. The
tool never edits an already-generated prose file — every take is new prose,
stored grouped by Scene ID and managed under per-user storage limits with
auto-archiving/pruning and labelling. A Scene links to its latest prose by
reference; if the linked Scene is still at the referenced commit, the prose
is shown as consistent with current project state ("green tick").

**Key rationale:**
- Because prose is write-once and never edited in place, it is structurally
  never a merge-conflict target — there is nothing for two branches to
  reconcile, since nothing ever mutates an existing prose file.
- This avoids running prose through the semantic JSON merge/conflict-
  resolution machinery (ADR-009), which is designed for structured entity
  attributes, not long-form generated text — and avoids stressing the
  lightweight in-memory cache/index (ADR-010, ADR-016), which multiple
  versioned prose files per scene could otherwise do if modeled as
  first-class, heavily-indexed entities.
- Commit-reference linking gives a cheap, verifiable consistency check
  (matches current Scene commit, or doesn't) without needing any of the
  conflict-resolution or indexing infrastructure built for entity data.

**Consequence to note:** the full YAML header shape (beyond Scene ID +
commit reference — presumably also a take/label identifier and generation
timestamp) and the storage/archiving/pruning policy specifics are not yet
defined (see HLD §12.7).