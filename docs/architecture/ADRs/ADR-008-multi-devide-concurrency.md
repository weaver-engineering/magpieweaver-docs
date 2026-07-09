# ADR-008 — Multi-Device Concurrency via Checksum-Validated PATCH + Write-Ahead Deltas (Approved)

**Decision:** For a single author working across multiple devices in Data
Entry Mode, restrict editing to one entity at a time; writes are entity-
scoped PATCH deltas validated against a checksum of the state being edited,
persisted via write-ahead delta before being flushed to the filesystem and
cache/index by a background process.

**Key rationale:**
- Checksum validation prevents a stale-state write from silently overwriting
  a newer one across devices, without requiring a heavyweight lock.
- Entity-scoped PATCH (rather than whole-workspace-state) keeps requests
  small and avoids unnecessary contention across unrelated entities.
- Write-ahead deltas make individual field edits durable immediately without
  requiring a Git commit per edit (see ADR-007), and allow clean recovery on
  restart (unprocessed deltas flush before the cache reinitializes).
- Because workspaces are private per user (ADR-006), this mechanism only
  needs to handle a single author's own multi-device concurrency — not
  cross-user contention, which is handled entirely by the PR/merge flow.

**Consequence to note:** a crashed or disconnected session requires no
cleanup or lock release — the user simply reopens the app against their own
cache. Sticky sessions are required to reach a given session's entity cache
while the cache is single-host; this requirement is retired once the cache
tier is off-boarded to a shared layer, since the backend is otherwise
sessionless (see ADR-016).