---
created: 2026-07-04T18:40:57+01:00
modified: 2026-07-04T18:41:10+01:00
---

# Magpie Weaver — High-Level Design (HLD)

> **Status:** agreed research (statement of fact once merged via `RES-3`),
> refined through follow-up design discussion.
> **Captured:** 2026-06-30. **Revised:** 2026-07-04.
> **Source:** author-provided research (HLD + five ADRs, prepared using Gemini)
> plus subsequent design decisions made in review.
>
> ADRs are tracked separately and referenced, not repeated, here. Sections
> below marked **(refined)** reflect decisions made since the original
> source document; sections marked **TODO** are still open.

---

## 1. Overview

Magpie Weaver is architected as a single TypeScript pnpm monorepo powering two
deployment modes — **Local Desktop** and **Enterprise Cloud** — that share
core data models, validation schemas, and UI components through a decoupled
storage abstraction (`FileStore` / `GitDataStore`).

## 2. Codebase Layout

```
magpie-weaver/
├── apps/
│   ├── desktop/     # Tauri v2 native runtime (Rust bindings & configuration)
│   ├── web/         # Shared frontend UI (React 19 + TypeScript + Vite SPA)
│   └── server/      # Cloud API server (Fastify + TypeScript)
├── packages/
│   ├── filestore/   # Data layer contracts & Git orchestration engine
│   └── infra/       # Cloud infrastructure-as-code (AWS CDK v2)
└── docs/            # System specifications and ADRs
```

## 3. Component Architecture & Data Flow

The UI is strictly separated from the state mutation engine and physical
storage via a decoupled **FileStore interface**:

```
┌─────────────────────────────────────────┐
│           APPS / WEB                    │
│  React 19 UI (Scene Editor, Lore Bible, │
│  Timelines, State Diff)                 │
└────────────────────┬────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│         PACKAGES / FILESTORE            │
│         FileStore Interface             │
│  (read, write, list, commit, revert)    │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
[ Local Desktop ]  [ Enterprise Cloud ]
  Tauri v2 IPC      Fastify API (HTTPS)
  Rust bridge       │
  │                 ▼
  ▼            Per-user cloud workspace
  Host FS +    (native Git host + private
  Native Git    in-memory cache/index)
```

## 4. Core Engine Loop

Four sequential stages per scene:

1. **Context assembly** — fetch character state, lore documents, and scene
   notes via the abstract FileStore interface.
2. **Generation pipeline** — bundle assembled state and the author's scene
   direction, dispatch to the LLM orchestration layer.
3. **Continuity linting** — pass raw output through a runtime validation
   filter checking lore and state rule compliance.
4. **State mutation gate** — derive state updates (inventory, character
   knowledge maps, etc.), present as a proposed structural diff; on author
   approval, dispatch a `FileStore.commit()` transaction.

## 5. Deployment Modes

### 5.1 Local Desktop Mode (offline-first)

- Native desktop binary built with **Tauri v2**.
- Embeds the shared React frontend in the host OS native WebView (no Chromium
  overhead; binary under 20 MB).
- Connects directly to the local filesystem and invokes native Git CLI
  commands via a Rust-to-TypeScript IPC command bridge.

### 5.2 Enterprise Cloud Mode (multi-device, multi-user) **(refined)**

- Shared React UI deployed as a progressive web app served from a CDN.
- Connects to a persistent **Fastify/Node.js** API server, containerized via
  Docker on **AWS ECS Fargate** behind an **Application Load Balancer (ALB)**.
- Infrastructure provisioned in `/packages/infra` using **AWS CDK v2**.
- **Each user is hosted as their own cloud workspace**, running Git natively
  on that host. Multi-user collaboration on a shared project is achieved
  through ordinary Git push/pull and pull-request flow between user
  workspaces and a project's mainline repo — not through shared runtime state.
- Because every author edits their own private workspace/cache, there is no
  cross-user runtime contention. Conflicts only ever surface at PR/merge
  time (see §7).

## 6. Storage Tier Isolation — the FileStore / GitDataStore Contract

All persistence actions go through a strictly typed interface exported by
`/packages/filestore`:

```typescript
interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(directory: string): Promise<string[]>;
  commit(message: string): Promise<string>; // returns commit hash
  revert(commitHash: string): Promise<void>;
}
```

Runtime implementations:

| Implementation | Used for |
|----------------|----------|
| `NativeGitFileStore` | Local Desktop — Tauri filesystem/Rust bridge + native Git CLI |
| `GitDataStore` (cloud) | Enterprise Cloud — per-user workspace, native Git host, checksum-based write validation |
| `InMemoryMockFileStore` | CI/testing — zero-dependency in-memory simulation |

Git is the durable, versioned backing store for project data (JSON entities
validated against fixed JSON Schemas). It is **not** queried live — a
lightweight in-memory cache/index sits over it per user (see §8).

## 7. Editing Modes, Commit Granularity & Conflict Resolution **(refined)**

The app has two distinct editing modes, chosen specifically to keep commit
history meaningful and avoid Git being used as a live transactional store:

### 7.1 Data Entry Mode
- Plain editor: open an entity (e.g. a character), edit fields, save.
- Every edit updates the user's private in-memory workspace/cache
  immediately; **no Git commit per edit** — persistence to the user's remote
  host filesystem happens continuously in the background, decoupled from
  Git history.
- The `[Publish]` action commits the current workspace state and either
  pushes directly or raises a pull request to the project's origin/mainline,
  depending on whether the author owns the repo or is a contributor.

### 7.2 Scene Director Mode
- The author interacts with characters in the context of a scene; character/
  world/scene metadata is static during this mode.
- State changes are limited to author-defined, customizable **entity state
  attributes** (e.g. a `has_a_hand` boolean on a character), which exist only
  ephemerally for the duration of the scene.
- Only one update and one commit occurs, at the end of the scene, when the
  author accepts the scene: the state changes are persisted as scene
  metadata, alongside the generated prose and a link to the project-state
  commit that produced it. No filesystem edits occur mid-scene.

### 7.3 Multi-User Merge & Conflict Resolution
- The project (repo) has an owner who merges contributor PRs into mainline.
- Conflicts are reduced, but not eliminated, by parsing both branch versions
  into their JSON-Schema-validated entity instances and resolving via
  attribute priority rules.
- Same-attribute conflicts that priority rules can't resolve are surfaced to
  the repo owner, who rejects the PR back to the contributor; the app assists
  the contributor in resolving the conflict before resubmitting — a
  simplified, on-rails version of a standard PR workflow, scoped to JSON
  entity attributes rather than general code.
- For descriptive/prose-style fields specifically (character or lore
  descriptions, etc.), conflicts may be resolved with LLM assistance
  ("merge these two sentences maintaining semantics from both versions").
  This is scoped to descriptive fields only — fields tagged as canonical
  fact are resolved by explicit author choice between versions, not blended,
  to avoid silently merging two contradictory facts into a plausible-sounding
  but incorrect result.

### 7.4 Multi-Device Concurrency (single user) **(refined)**
- A single author working across multiple devices is the only scenario
  requiring in-session concurrency handling (cross-user conflicts are handled
  by the merge flow above, not live).
- The app restricts editing to one entity at a time per user. Writes go
  through the `GitDataStore` as PATCH-style deltas (entity-scoped, not whole
  workspace state), validated against a checksum of the state being edited,
  so a device must be editing the current known version of an entity to
  successfully write a change.
- **Durability:** incoming PATCHes are validated, written to a per-entity
  write-ahead delta, and acknowledged; a separate background process flushes
  write-ahead deltas to the filesystem and updates the cache/index. On
  restart, any unprocessed write-ahead deltas are flushed before the cache is
  reinitialized. Sessions are sticky to reach a session's entity cache.
- Because each user's workspace and cache are private to them, a crashed or
  disconnected session has nothing to "release" — no other user or device is
  blocked. The user simply reopens the app against their own cache and
  resumes.

## 8. Querying & Indexing **(refined)**

- Project data volume is small and bounded (limited by number of characters,
  scenes, etc. in a project), so a full external database is unnecessary.
- A lightweight in-memory cache sits over each user's private workspace,
  built by walking the entity tree, providing simple querying/indexing
  (JSONPath-style) without querying Git directly.
- Example — "all scenes where character X knows fact Y": fact-knowledge is
  modeled as a state attribute; the scene where that attribute changes is
  recorded in scene metadata; combined with the chronology's sequential
  ordering, the answer is that scene plus all prior scenes in the relevant
  arc/branch.
- Scenes are also grouped into **arcs** (all scenes involving a given
  character, object, etc.), providing an additional query axis.

## 9. Chronology Model **(refined)**

- Time flows only forward. The chronology records this as a list of
  **chronological events**, where an event is either a single scene, or a
  nested list of chronological events flagged sequential/concurrent —
  supporting branching and merging narrative structure independent of final
  story order (e.g. flashbacks, multi-POV scenes).
- **Invariant:** an entity can only be on one chronological branch within any
  given time slice; state changes made concurrently on different branches
  are not visible to other concurrent branches until the branches are
  explicitly merged (a narrative-model merge, distinct from a Git merge).
- Chronology edits (including adding an entity to a scene) are validated
  against this invariant at edit time, against the project state on that
  branch at that point — this catches violations before they're introduced
  on a single branch.
- Merging branches can change an entity's validity in the chronology without
  being caught by edit-time validation, so the chronology can transiently
  enter an inconsistent state after a merge (e.g. a scene's state-entry
  requirement, such as "Rand must have lost his hand," becomes violated by a
  change elsewhere). Certain user actions trigger an explicit chronology
  validation pass that surfaces inconsistencies and launches guided repair
  tooling — the same allow-then-reconcile pattern Git itself uses for code
  merges.

## 10. Related Decision Records

Architectural rationale and consequences for base technology choices are
tracked in the separate ADR set (ADR-001 through ADR-005): technology stack
selection, repository layout strategy, operational task-mode gating, storage
tier isolation, and cloud hosting topology.

---

## 11. Sections Requiring Further Detail

### 11.1 Tech Stack Rationale — Product Fit vs. Agent Fluency
**TODO (under discussion):** ADR-001 justifies stack choices partly by LLM
training-token density (fewer hallucinated APIs for an AI coding agent).
Needs an explicit statement of how much of the codebase is agent-authored
vs. human-authored, and a separate justification for product fit (React/Tauri
for desktop authoring tools, Fastify/Fargate for the API) independent of
agent-friendliness.

### 11.2 Three-Phase Task Execution Gate — Robustness
**TODO (under discussion):** ADR-003's Spec → Test → Act gate needs a
concrete answer for how "tests fail for the correct reason" is verified
beyond author judgment, and whether the three-gate overhead is scoped down
for small changes.

### 11.3 Monorepo Consequence Management
**TODO (under discussion):** ADR-002 accepts that spec and code changes
mingle in commit history. Needs a convention (commit tagging/labeling,
changelog generation) to keep this navigable as the repo grows.

### 11.4 Cloud Hosting Cost Model
**TODO (under discussion):** Per-user always-on cloud workspaces (§5.2)
multiply the "no scale-to-zero" cost concern already flagged in ADR-005 —
needs a concrete cost-per-user model and idle-workspace policy (e.g.
suspend/hibernate workspaces after inactivity).

### 11.5 Data Model & Schema Design
**TODO:** Concrete JSON Schema definitions for character/lore/scene entities
and custom entity state attributes, and how schema versioning propagates
across `NativeGitFileStore` and `GitDataStore`.

### 11.6 LLM Orchestration Layer
**TODO:** Which model(s)/providers the generation pipeline and merge-assist
LLM calls use, prompt construction, retry/fallback behavior, rate limiting,
and cost controls.

### 11.7 Continuity Linting Rules
**TODO:** The actual rule set behind the runtime validation filter (Core
Engine Loop step 3) — how rules are authored/updated and failure handling
when linting rejects generated output.

### 11.8 Observability & Monitoring
**TODO:** Logging/metrics/tracing for the Fastify API and per-user cloud
workspaces, error tracking, and alerting thresholds.

### 11.9 CI/CD Pipeline
**TODO:** Build/release pipelines for the monorepo, per-OS desktop binary
distribution, cloud/infra deployment, and how the Three-Phase Gate maps to
CI checks.

### 11.10 Compliance & Data Privacy
**TODO:** Data residency, retention, and privacy requirements for
user-authored content in per-user cloud workspaces; regulatory scope (e.g.
GDPR) if applicable.

---

## Our Stance (not part of the original research)

Design discussion so far has substantially resolved the storage/concurrency/
chronology model (§§7–9), which was the highest-risk area in the original
source document. Remaining open items (§11.1–11.4) concern process and cost
rather than correctness, and are lower urgency than the resolved items were.
