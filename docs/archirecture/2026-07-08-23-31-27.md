---
created: 2026-07-08T23:31:27+01:00
modified: 2026-07-08T23:31:32+01:00
---

# High-Level Design: Cached Entity Storage with Write-Ahead Durability

## 1. Overview

Entity data is stored as JSON files in a per-user Git repository, organized by
type (directories) with per-type index files (singletons, max 10KB) listing
all entries of that type. Git acts as the durable, versioned source of truth.
A Memcached layer sits in front of the repo to serve fast reads, backed by a
per-entity write-ahead log (WAL) to guarantee durability of in-progress edits
before they are committed to Git.

**Goals:**
- Sub-millisecond reads for index and entity data in the common case.
- No data loss on process crash between an edit and its Git commit.
- Simple, bounded failure handling with a single recovery mechanism.

**Key simplifying constraints:**
- Single session per user, enforced server-side.
- A user works on exactly one entity at a time; editing requires an explicit
  [Save] to commit.
- At most ~20 entity types.

These constraints eliminate cross-entity/cross-session concurrency, which is
what keeps the design tight.

---

## 2. Data Model

| Data | Size | Storage |
|---|---|---|
| Type index (list of entity IDs for a type) | 2–5KB | Git singleton file + cache |
| Entity record | 5–10KB | Git file (per entity, per type dir) + cache |

**Cache keys:**
- `type:index` → marshalled index JSON
- `type:entity_id` → marshalled entity JSON
- `type:entity_id:checksum` → current checksum/version marker for the entity

All values are well within Memcached's practical limits (default 1MB/item;
typical sensible range is a few KB, which matches this data exactly).

**Checksum format:** `<checksum of data in last Git commit>-<WAL index for entity>`

- The commit-hash portion anchors the checksum to a known durable state.
- The WAL-index suffix increments per field update and enforces strict
  ordering — an out-of-sequence field update (e.g. a client applying edit
  N+2 before N+1 has been accepted) is detectable because the WAL index it
  expects to extend won't match.
- On **[Save]**, the entity is committed to Git and the checksum resets to
  the new commit hash with WAL index `0`, signaling "cache exactly matches
  the latest commit, no pending WAL edits."

---

## 3. Write Path (Field Edit)

1. User edits a field on the single entity currently open.
2. Field diff is appended to a **per-entity WAL** (small, on disk, durable).
3. Cache entry for that entity is updated via read-modify-write (merge
   changed fields into existing cached JSON — never a blind overwrite).
4. A new (optimistic) checksum is computed and returned to the caller
   immediately. This checksum reflects "edit accepted into WAL," not
   "committed to Git" — the WAL itself is the durable record if the process
   crashes before disk sync.
5. A semaphore is tripped to trigger async processing of the WAL into the
   on-disk repo structure. This is a performance optimization only, not a
   correctness dependency (see §5).

**Fail-fast rule:** if a stuck/failed WAL entry already exists for the
entity being edited, further field-update writes for **that entity** are
rejected immediately rather than being appended to a growing, unresolvable
WAL. Other entities are unaffected (see §6) — but since only one entity is
in flight at a time per user, this is moot in practice.

---

## 4. Read Path

- **Cache hit:** return cached value directly.
- **Cache miss:** before returning, apply any pending WAL entries for that
  entity to the on-disk/repo state, then populate cache and return. This
  guarantees a read never sees stale data relative to accepted-but-not-yet-
  flushed edits, without depending on the async flush having completed.

---

## 5. Durability & Recovery

- **WAL is the source of truth for "did this edit happen."** Cache and its
  optimistic checksum are a fast-path view only.
- **Cache-ahead state is best-effort and disposable.** If cache holds edits
  not yet flushed to Git and something goes wrong, that state can be
  discarded — the recoverable floor is always the last Git commit for that
  entity.
- **[Save]** commits the current entity to Git, producing a new commit and a
  confirmed (non-optimistic) checksum. This is the point at which the user
  should be able to trust their data is durable.
- **Recovery mechanism (single path for all failure modes):**
  1. A stuck WAL entry, or a failed [Save], is detected.
  2. On the user's **next read or write**, the async job state is pushed to
     the user's session (e.g. via a session flag / push notification) so the
     failure surfaces at the earliest natural opportunity — no background
     polling needed, since single-session + single-entity-in-flight means
     any interaction will hit the stuck state.
  3. User is prompted to confirm.
  4. On confirmation, the **entity is restored to its last committed Git
     state** (`git checkout <last commit> -- path/to/entity`), scoped to
     that single entity/file. Cache and WAL for that entity are reset to
     match.

Because a user only ever has one entity in flight, and commits are
inherently single-entity, this recovery is naturally entity-scoped — no
risk of reverting unrelated in-progress work on other entities, since none
exists concurrently.

---

## 6. Concurrency & Scope Notes

- **Single session per user (server-enforced)** removes any possibility of
  two writers racing on the same WAL/repo state.
- **Single entity in flight per user** removes any need for cross-entity
  ordering, locking, or partial-recovery logic. WAL blocking, fail-fast, and
  recovery are all naturally scoped to one entity at a time.
- **Field-level (not whole-entity) WAL updates** exist purely to reduce
  network traffic when editing large entities — not for partial-commit
  semantics. Commits at [Save] time are always for the single entity being
  edited.

---

## 7. Why This Works

Each constraint removes a class of edge case rather than introducing new
ones to handle:

| Constraint | Eliminates |
|---|---|
| Single session per user | Multi-writer races on WAL/cache |
| Single entity in flight | Cross-entity ordering/locking, partial recovery ambiguity |
| WAL as durability source | Dependency on semaphore/async job for correctness |
| Cache-ahead = best-effort | Ambiguity about what's safe to lose on failure |
| Uniform fail-fast + confirm + restore-to-commit | One recovery path instead of two, for both WAL-stuck and Save-failure cases |

Net result: a small, well-bounded state machine per entity — edit → WAL →
cache → [Save]/commit → confirmed checksum — with one clearly defined
failure/recovery path, backed by Git as the durable floor and Memcached as a
disposable, fast-path accelerant.
