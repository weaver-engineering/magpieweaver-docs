# ADR-016 — Scale-to-Zero Cache Model with Branch-Scoped, Transactional Index Consistency (Approved)

**Decision:** Only the in-memory cache (§8/ADR-010) needs to stay warm for an
"always on" UX — Git operations themselves run as short-lived, on-demand
operations against FS-backed persistent storage and do not require an
always-on process. Cache warmth is scoped per branch, kept warm only while
recently active (configurable idle timeout, tunable to control cost through
development and rollout), and cold-rebuilt on demand otherwise. Auto-warmup
on user access is limited to singleton entities (materialized index/project
metadata), not full entity sets. All metadata edits — including those made
by background jobs — go through `GitDataStore`, keyed to the branch being
edited; background processes maintain their own local cache as needed (never
the active user's cache) and read/cache only what they need. Once demand
exceeds single-host capacity, the cache tier can be off-boarded to a shared
layer, which is possible because the backend is otherwise sessionless.

**Key rationale:**
- Scoping "always on" to the cache rather than the whole per-user workspace
  means cost scales with active users, not registered users — a materially
  different (and much smaller) bill than one permanently-running container
  per registered user.
- The materialized index singleton is what keeps cold start cheap: warmup
  only needs to load a small, pre-maintained pointer structure, not scan or
  rebuild from the full entity set, keeping resume latency low even at the
  edge of "bounded but non-trivial" project size.
- Cache invalidation is scoped precisely to the operations that actually
  change FS state outside the app's own write path: `commit` (via
  `GitDataStore.write()`) keeps the cache current in-process as part of the
  write, so it needs no separate invalidation; `merge`/`rebase` mutate state
  outside that path, so they must explicitly evict the affected branch's
  cache. Eviction is scoped strictly to the branch being merged/rebased and
  does not cascade to other branches, since a branch's cache validity depends
  only on its own state, not on whether it's behind another branch.
- Branch-scoped background-job caching (rather than shared/global caching)
  keeps async jobs (ADR-014) fully isolated from the active user's cache and
  from each other, consistent with the branch-isolation invariant already
  established for job writes.
- A sessionless backend (aside from the cache tier itself) means horizontal
  scaling of the cache doesn't reintroduce sticky-session requirements
  elsewhere in the system — this retires the sticky-session requirement
  originally stated for multi-device concurrency (ADR-008) once the cache is
  off-boarded to a shared tier.
- Conflict-resolution-driven reindexing must complete, and be committed,
  before the destination branch is rebased onto — treating entity conflict
  resolution, index rematerialization, and rebase as a single transactional
  unit protects the destination branch's data consistency specifically in
  the case where consistency is actually at risk. (Reindexing outside of
  conflict resolution — e.g. routine reindex of an already-consistent branch
  — is a separate, non-transactional operation and does not require this
  ordering guarantee.)

**Consequence to note:** requires careful separation between "operations
that require branch cache eviction" (merge, rebase, and any other Git
operation that mutates metadata state outside the app's write path) and
"operations that don't" (`branch --list`, `commit` via the app's own write
path, etc.) — getting this classification wrong in either direction either
serves stale data or triggers unnecessary cold rebuilds. Also requires a
deliberately simplified, strictly enforced Git workflow UX for non-engineer
authors (the full flexibility of the Git CLI is not appropriate to expose
directly) — the specifics of that simplified workflow are an explicitly
deferred, separate design discussion (see companion task).