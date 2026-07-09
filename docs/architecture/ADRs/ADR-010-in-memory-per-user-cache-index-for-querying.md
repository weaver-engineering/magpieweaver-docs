# ADR-010 — In-Memory Per-User Cache/Index for Querying (Approved)

**Decision:** Provide querying and indexing (JSONPath-style) via a lightweight
in-memory cache built by walking each user's private entity tree, rather than
querying Git directly or introducing an external database.

**Key rationale:**
- Project data volume (characters, scenes, etc. per project) is small and
  bounded, so a full database is unnecessary overhead.
- Keeps the FileStore/GitDataStore contract simple — Git remains a durable,
  versioned backing store, not a query engine.
- Supports the chronology and arc query patterns (HLD §8) directly from
  metadata already being maintained (scene metadata, arc membership) without
  additional infrastructure.

**Consequence to note:** cache must be rebuilt or incrementally maintained
correctly on every write path (Data Entry PATCHes, Scene Director commits,
merge results) — a missed cache-invalidation path would silently produce
stale query results.