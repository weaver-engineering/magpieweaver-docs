## 1. Context

- [Glossary](../glossary.md) - Glossary of terms.
- [About Magpie Weaver](../magpie-weaver.md) - Background reading about Magpie Weaver.
- [Architecture Definition](architecture-definition-document.md) - Magpie Weaver Architecture.

- Magpie Weaver is architected as a single TypeScript pnpm monorepo powering
  three client surfaces — **Enterprise Cloud** (primary, mobile-first),
  **Local Desktop** (convenience), and a **Mobile app** (thin client of the
  cloud workspace) — sharing core data models, validation schemas, and UI
  components through a decoupled storage abstraction (`GitDataStore`).
  The target audience is primarily mobile; desktop and local
  operation exist for convenience and are held to a lower reliability bar.

## 1a. MVP Scope Boundary

This HLD documents the **full intended system**, including work well beyond
a first release, deliberately — so that MVP-stage design and implementation
choices don't quietly foreclose or require expensive rework of the later
capabilities described here.

The actual **MVP** is narrower than everything above: it covers only
**MagpieEngine**, **Weaver**, and **Scene Director**, operating on a
**single scene**, with **no chronology** (no branching/merging narrative
time), and **no cross-user collaboration** (no PR/merge flow, no multi-user
branches — a single author, effectively single-branch operation).

Concretely excluded from MVP, but designed for in this document so they
remain reachable later without architectural rework:
- Multi-scene chronology, branching, and validation (§9)
- Multi-user collaboration, semantic merge, and conflict resolution (§7.3,
  ADR-009)
- The **scale-up** side of the cost-scaling model (§12.5, ADR-016) — off-
  boarding the cache tier to a shared layer once demand exceeds single-host
  capacity, tuning for concurrent-user growth. Not MVP scope; nothing to
  scale up to yet.
  **Scale-to-zero is the opposite case and is in scope for MVP**: dev, test,
  and early MVP usage all have long idle stretches with no active users, and
  that's exactly where scale-to-zero (idle-timeout eviction, on-demand Git
  operations rather than a permanently running process, §12.5) pays off
  soonest — it isn't a later-stage optimization, it's most valuable early.
- LLM request queuing/tiered prioritization (free vs. paid fairness with
  aging) — noted in §12.8 as a forward-looking idea, not MVP scope
- Mobile app and the walk-away/push-notification model (§5.3, ADR-013) —
  though the underlying Job Execution Substrate that Scene Director runs on
  (§10.1, §1b) is itself in scope for MVP and should be built with this
  later mobile use in mind

## 1b. Component Design Documents

This HLD is the system-level document. Each top-level component below is
(or will be) specified in its own dedicated design doc, so implementation
detail for a component doesn't have to live here and this document can stay
focused on how the components fit together. The **Depends on** column is
load-bearing for sequencing: a component's design doc should not be
finalized before the components it depends on, since its interface
contract is partly determined by what it's calling into.

**Note on "MVP?":** this tracks whether the component's *interface* needs to
exist at MVP, not whether every capability in its eventual design doc ships
at MVP. Job Execution Substrate is the clearest case — Scene Director calls
into it for every take (§10.1: "a take is really just a job that happens to
have a live chat session attached"), so the substrate is MVP even though the
Async Job Execution System built on top of it (queuing, headless regen,
prose correction) is not. Don't let a component's MVP/non-MVP tag stand in
for its dependents' tags — check the dependency chain.

| Component                          | MVP?                                                                             | Design doc                                                                                 | Depends on                                                                                                                                                                                                                                                                        |
|------------------------------------|----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **GitDataStore**                   | Yes, including **per-user isolation**, **scale-to-zero**, Excluding **Scale-up** | [doc](components/git-data-store/git-data-store-hld.md)                                     | — (foundational; no dependencies on other components in this table)                                                                                                                                                                                                               |
| **MagpieEngine**                   | Yes                                                                              | [doc](components/magpie-engine/magpie-engine-hld.md)                                       | BranchingDataStore/GitDataStore (§6) for entity/lore reads; Entity State Schema (ADR-017/018)                                                                                                                                                                                              |
| **Weaver**                         | Yes                                                                              | [doc](components/weaver/weaver-hld.md)                                                     | MagpieEngine (consumes assembled context, §4 stage 1); LLM provider abstraction (§12.8)                                                                                                                                                                                           |
| **Job Execution Substrate**        | **Yes**                                                                          | [doc](components/job-execution-substrate/job-execution-substrate-hld.md)                   | BranchingDataStore/GitDataStore (branch isolation invariant) — the shared low-level durability layer described in §10: event-level checkpoint/resume, branch-scoped write isolation, continuity-lint circuit breaker. Not client-connection-dependent. Both rows below sit on top of this. |
| **Scene Director**                 | Yes                                                                              | [doc](components/scene-director/scene-director-hld.md)                                     | Weaver (drives the generation pipeline per take); MagpieEngine (state read/write); **Job Execution Substrate** (a take is a job with a live chat session attached, §10.1 — this dependency is real at MVP, not deferred)                                                          |
| **Async Job Execution System**     | No                                                                               | [doc](components/async-job-execution-system/async-job-execution-hld.md)                    | **Job Execution Substrate** (adds queuing/dispatch on top — SQS or filesystem-persisted queue); Weaver (headless regen / prose correction both call the LLM pipeline)                                                                                                             |
| **Chronology & Multi-Scene Model** | No                                                                               | [doc](components/chronology-and-multi-scene-model/chronology-and-multi-scene-model-hld.md) | BranchingDataStore/GitDataStore (branch/merge primitives); MagpieEngine (entity-state validation against the chronology invariant, §9)                                                                                                                                                     |
| **Collaboration & Merge System**   | No                                                                               | [doc](components/colaboration-and-merge-system/colaboration-and-merge-system-hld.md)       | BranchingDataStore/GitDataStore (PR/branch mechanics, §7.3); MagpieEngine (schema-validated entity parsing for conflict resolution)                                                                                                                                                        |

Not included in this table: client surfaces (§5), the dev process gate/CI-CD
(§12.3/§12.10), observability (§12.9), and compliance/PII (§12.11). These
are cross-cutting or platform concerns rather than components other
components call into, so a dependency edge doesn't apply the same way —
they can stay as sections of this HLD rather than spinning out, unless that
changes later.

---

## 2. Codebase Layout

```
magpie-weaver/
├── apps/
│   ├── desktop/      # Thin launcher: spawns local backend, hands off to browser
│   ├── mobile/       # Native iOS/Android thin client (cloud workspace only)
│   ├── web/          # Shared frontend UI (React 19 + TypeScript + Vite SPA)
│   └── server/       # Cloud/local API server (Fastify + TypeScript)
├── packages/
│   ├── gitdatastore/ # Data layer contracts & Git orchestration engine
│   └── infra/        # Cloud infrastructure-as-code (AWS CDK v2)
└── docs/             # System specifications and ADRs
```

## 3. Core Engine Loop

Four sequential stages per scene event, performed by two named components —
**MagpieEngine** (context marshaling) and **Weaver** (LLM orchestration) —
see the Glossary (Appendix A) for full definitions:

1. **Context assembly** *(MagpieEngine)* — fetch character state, lore
   documents, and scene notes via the abstract BranchingDataStore interface, marshaled
   according to the current scene state (including conditional inclusion
   rules — see the companion MagpieEngine HLD, forthcoming).
2. **Generation pipeline** *(Weaver)* — bundle assembled state and the
   author's scene direction, walk through SceneEvents, dispatch to the LLM.
3. **Continuity linting** *(Weaver)* — pass raw output through a runtime
   validation filter checking lore and state rule compliance.
4. **State mutation gate** *(Weaver → MagpieEngine)* — derive state updates
   (inventory, character knowledge maps, etc. — see the Entity State Schema,
   ADR-017), present as a proposed structural diff; on author approval,
   dispatch a `BranchingDataStore.commit()` transaction.

## 4. Client Surfaces

### 4.1 Local Desktop Mode (convenience, offline-first)

- No native shell/IPC bridge. The desktop app is a thin launcher: double-click
  icon → "please wait while the system initialises" loading screen → local
  Fastify backend starts (if not already running) → hands off to the system
  browser once the backend is responsive.
- The backend binds to localhost only. Process lifecycle (what stops the
  backend when the user is done) is an open item — see §12.1.
- Connects directly to the local filesystem and invokes native Git CLI
  commands via the same `GitDataStore` implementation used by Enterprise
  Cloud/Mobile — there is no separate desktop-specific implementation of
  `BranchingDataStore`. (An earlier draft posited a distinct
  `NativeGitFileStore` implementation for this surface; that's been dropped —
  `GitDataStore` already runs native Git operations directly and covers local
  access without a separate implementation.)
- Lower reliability bar than mobile/cloud by design — this surface exists for
  convenience, not as the primary target.

### 4.2 Enterprise Cloud Mode (multi-device, multi-user, primary target)

- Shared React UI deployed as a progressive web app served from a CDN.
- Connects to a persistent **Fastify/Node.js** API server, containerized via
  Docker on **AWS ECS Fargate** behind an **Application Load Balancer (ALB)** —
  confirmed as a **pooled task fleet** (any task can serve any user's
  request), which requires the ElastiCache session/index cache (§12.5) to be
  genuinely externalized first; see `docs/specs/tech-stack.md` §4/§6/§7 for
  the full rationale and the cache-externalization prerequisite.
- Infrastructure provisioned in `/packages/infra` using **AWS CDK v2**.
- Each user is hosted as their own cloud workspace, running Git natively on
  that host. Multi-user collaboration is achieved through ordinary Git
  push/pull and pull-request flow between user workspaces and a project's
  mainline — not shared runtime state. No cross-user contention; conflicts
  surface only at PR/merge time (§8).

### 4.3 Mobile App (thin client, primary target)

- Native iOS/Android app, not a PWA — required because reliable background
  execution and push notifications (for long-running async jobs, §10) are
  not available to web/PWA clients on iOS in particular.
- Holds no local persistence model beyond a thin cache; talks to the same
  per-user cloud workspace/API as Enterprise Cloud Mode.
- Registers for push notifications (APNs/FCM) to be notified when background
  jobs complete or need author direction, so the author can close the app
  during long-running generation and be pulled back in only when needed.

## 5. Storage Tier Isolation — the BranchingDataStore Contract

All persistence actions go through a strictly typed interface exported by
`/packages/gitdatastore`. **Naming correction:** earlier drafts of this
document named the interface itself `FileStore` in prose and, inconsistently,
`GitDataStore` in the code block below — colliding with `GitDataStore`, which
is actually the *implementation* of this interface, not the interface itself.
The interface is `BranchingDataStore`; `GitDataStore` implements it.

The interface below is initial draft only and will be finalized through the
design of the GitDataStore.
```typescript
interface BranchingDataStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(directory: string): Promise<string[]>;
  commit(message: string): Promise<string>; // returns commit hash
  revert(commitHash: string): Promise<void>;
}
```

Runtime implementations:

| Implementation  | Used for                                                                                                 |
|-----------------|----------------------------------------------------------------------------------------------------------|
| `GitDataStore`  | All surfaces — Enterprise Cloud / Mobile backend and Local Desktop alike — per-user workspace, native Git host, checksum-based write validation. No separate desktop-specific implementation exists; `GitDataStore` runs native Git directly regardless of host. |
| `MockDataStore` | CI/testing — zero-dependency in-memory simulation                                                        |

Git is the durable, versioned backing store for project data (JSON entities
validated against fixed JSON Schemas). It is **not** queried live — a
lightweight in-memory cache/index sits over it per user (§9).

## 6. Editing Modes, Commit Granularity & Conflict Resolution

Two distinct editing modes keep commit history meaningful and avoid Git
being used as a live transactional store:

### 6.1 Data Entry Mode
- Plain editor: open an entity (e.g. a character), edit fields, save.
- Every edit updates the user's private in-memory workspace/cache
  immediately; no Git commit per edit. Writes go through `GitDataStore` as
  entity-scoped PATCH deltas, validated against a checksum of the state being
  edited (supports one author across multiple devices, one entity locked to
  one device at a time).
- **Durability:** PATCHes are validated, written to a per-entity write-ahead
  delta, and acknowledged; a background process flushes deltas to the
  filesystem and updates the cache/index. On restart, unprocessed deltas are
  flushed before the cache reinitializes. No session-affinity/stickiness
  mechanism is needed to reach a user's cache: at this scale there is exactly
  one instance and one in-memory cache, so every request naturally lands on
  it — there's no routing choice to pin in the first place. (Stickiness only
  becomes a question once multiple interchangeable instances/tasks exist —
  see §12.5, where cache externalization is chosen specifically so that
  question never has to be answered by introducing sticky routing at all.)
  Since each user's workspace is private, a crashed session blocks no one
  else — the user reopens and resumes against their own cache.
- `[Publish]` commits the current workspace state and pushes or raises a PR
  to origin/mainline.

### 6.2 Scene Director Mode
- See §10 (Scene Execution Model) — direction is interactive, but execution
  of a take runs autonomously and is durable independent of the client.

### 6.3 Multi-User Merge & Conflict Resolution
- The project (repo) has an owner who merges contributor PRs into mainline.
- Both branch versions are parsed into JSON-Schema-validated entity
  instances; conflicts are resolved via attribute priority rules where
  possible.
- Unresolved same-attribute conflicts are surfaced to the repo owner, who
  rejects the PR back to the contributor; the app assists the contributor in
  resolving it before resubmitting.
- Descriptive/prose fields (character or lore descriptions) may be resolved
  with LLM assistance ("merge these two sentences maintaining semantics from
  both"). Fields tagged as canonical fact are resolved by explicit author
  choice between versions, never blended, to avoid silently reconciling a
  real contradiction into a plausible-but-wrong result.

## 7. Querying & Indexing

- Project data volume is small and bounded, so a full external database is
  unnecessary. A lightweight in-memory cache sits over each user's private
  workspace, built by walking the entity tree, providing JSONPath-style
  querying/indexing without querying Git directly.
- Example — "all scenes where character X knows fact Y": fact-knowledge is a
  state attribute; the scene where it changes is recorded in scene metadata;
  combined with chronology ordering, the answer is that scene plus all prior
  scenes in the relevant arc/branch.
- Scenes are also grouped into **arcs** (all scenes involving a given
  character, object, etc.), providing an additional query axis.

## 8. Chronology Model

- Time flows only forward. The chronology is a list of **chronological
  events** — either a single scene, or a nested list of chronological events
  flagged sequential/concurrent — supporting branching/merging narrative
  structure independent of final story order (flashbacks, multi-POV scenes).
- **Invariant:** an entity can only be on one chronological branch within any
  time slice; concurrent-branch state changes aren't visible to other
  concurrent branches until branches are explicitly merged (a narrative-model
  merge, distinct from a Git merge).
- Chronology edits are validated against this invariant at edit time, against
  the project state on that branch at that point.
- Branch merges can invalidate an entity's chronology position without being
  caught at edit time (e.g. a scene's state-entry requirement becomes
  violated by an upstream change), so the chronology can transiently become
  inconsistent after a merge. Certain user actions trigger an explicit
  validation pass surfacing inconsistencies and launching guided repair
  tooling.
- **Proactive interception (refined):** the app also intercepts authored
  changes likely to produce downstream inconsistency and, by default, warns
  the author and offers to replay/correct affected scenes via background job
  (§10), rather than hard-preventing the change — hard-prevent is reserved
  for a narrow, well-understood class of violations, since exploratory
  contradictory drafting is a normal part of authoring.
- **Automatic validation background jobs (new):** chronology/entity
  consistency validation runs automatically as a background task and does
  not use the LLM. It does not fix issues — it reports them and guides the
  author through resolution.

## 9. Scene Execution Model

There are two distinct execution models, both LLM-driven except where noted,
and both durable independent of client connection state.

### 9.1 Interactive Scene Direction
- The author chats with AI-agent-driven character "actors" in the Scene
  Director view, using controls (`[Cut]`, `[Action]`, `[From <event>]`,
  `[From the top]`, `[Wrap]`) and direct prose editing.
- Once `[Action]` is given, the actors run the take autonomously — the
  author can walk away or the client can drop; the end result is the same
  either way. Changes are auto-written to the scene's branch as they occur,
  and a PR is raised at natural checkpoints.
- `[Wrap]` is the author confirming the state changes through the scene,
  which are then committed to mainline (per §7's Data Entry commit model).
- **Durability:** if the backend itself restarts mid-take, the take resumes
  from the last completed scene-event checkpoint (event-level granularity —
  a partially-generated event restarts from its own beginning, not
  mid-generation). This is the same durability model as background jobs
  (§10.2), not a separate one — a take is really just a job that happens to
  have a live chat session attached while the author is present.

### 9.2 Asynchronous Background Jobs
- Queued via SQS (Enterprise Cloud) or an equivalent filesystem-persisted
  queue (Local Desktop).
- Two subtypes, both requiring the LLM:
  - **Headless scene regeneration** — replays a scene's original directions
    (e.g. after an upstream foundational-scene edit). Output is expected to
    differ from the original take (that's the point of replay, since the
    upstream change should legitimately affect downstream nuance), not a
    deterministic reproduction.
  - **Direct prose correction** — edits existing scene prose in place to
    account for a minor upstream change, as an alternative to full replay.
- A third subtype, **project validation** (chronology/entity consistency,
  §9), does not use the LLM and does not auto-fix — it reports and guides.
- **Isolation invariant:** all background job writes are confined to the
  job's own branch until a PR is raised. This is what makes job-death
  handling simple — regardless of why a job dies, the author only needs to
  be notified of the end state (PR raised, or direction sought); no rollback
  logic is required.
- **Continuity-linting circuit breaker:** a job stuck failing continuity
  lint does not retry indefinitely. It is bounded by a configurable retry
  count (provisionally 3) and a configurable max time per scene event. On
  breaker trip, the job fails gracefully: in-progress state changes are
  persisted as properties of the in-flight scene replay on the branch they
  would have written to; no PR is raised; the author is notified and asked
  for direction (via chat/direct prose edit), and can restart the job
  afterward.
- **PR review for completed background jobs:** when a background job
  completes and raises a PR, the app notifies the author during the
  accept-PR workflow that the resulting prose may be substantially different
  from the original (while still bounded by the project's metadata/rules).
  Review rigor is left to the author's discretion.
- What determines interactive vs. async is currently author-initiated
  ("this edit affects a foundational scene, submit as background task") for
  explicit edits, and system-triggered for proactive interception (§9) — see
  §12 for remaining open questions on this classification.

## 10. Related Decision Records

Architectural rationale and consequences for base technology choices are
tracked in the separate ADR set (ADR-001 through ADR-005). Decisions made
during subsequent design review are tracked as ADR-006 through ADR-022 in a
companion document, covering: per-user Git workspaces (006), editing-mode
commit granularity (007), multi-device concurrency (008), semantic JSON
merge (009), in-memory cache/index (010), chronology branching (011),
desktop-as-launcher (012), native mobile app (013), dual execution model
(014), the development gate (015), the scale-to-zero cache/GitDataStore
model (016), the three-schema narrative state model (017), prose as
write-once flat files (018), the MVP scope boundary (019, **open, not yet
finalized**), local observability tooling (020), GitHub Actions as CI/CD
provider (021, **open, pending investigation**), and the structured-PII
hard-block linter (022). Note: ADR-001's stated rationale (LLM training-token density)
is now confirmed as the primary, deliberate driver of stack choice, since
100% of code is agent-authored (§12.2 notes the one open consequence of
this: the Rust IPC bridge risk, resolved by removing Tauri per §5.1).

---

## 11. Sections Requiring Further Detail

### 11.1 Desktop Backend Process Lifecycle — Resolved

**Resolved:** explicit quit only, via the tray icon — **no idle-timeout
self-exit for Local Desktop.** `MagpieWeaverApp` (the tray-icon launcher,
ADR-012) stops the local TS Service and the local OpenObserve process
(§11.9) together, only when the user chooses "Quit" from the tray icon. No
background watchdog silently terminates the process on its own.

This was a deliberate simplification, not an oversight: an idle-timeout
self-exit was considered (the same heartbeat-based approach used for the
Enterprise-scale EC2 host's scale-to-zero, `docs/specs/tech-stack.md` §4.1,
would translate directly) and rejected specifically for Local Desktop —
a tray icon that can quietly quit on its own is confusing UX (the user has
no clear mental model of why or when it stopped), and for a developer
running this locally during agent-authored development work, an
unpredictable self-exit mid-session is actively counterproductive rather
than neutral. Cost pressure — the reason idle self-exit is worth the
complexity at Enterprise/cloud scale — simply doesn't apply locally, so
there's nothing on the other side of the tradeoff to justify it here.

This resolves the "orphaned background process on Windows" concern the
original open item was raised to address: since there's now exactly one
way the process stops (explicit tray "Quit"), there's no ambiguity about
whether it's still running, and no silent-exit path to leave the user
uncertain either way.

### 11.2 Rust/Native Shell — Resolved, Noting for Traceability
Resolved: the Tauri/Rust IPC bridge has been removed from the design (§5.1);
desktop is now a launcher + browser handoff with a TypeScript-only backend,
eliminating the one component that broke the "high training-density" stack
rationale for a 100%-agent-authored codebase.

### 11.3 Three-Phase Task Execution Gate — Robustness (resolved)

Given 100% agent-authored code, the Spec → Test → Act gate is the primary
correctness mechanism (there is no separate human line-by-line code review
backstop), so rigor here is accepted as worth a velocity cost.

- **Tests are written at system level**, not component/function level, to
  keep them human-reviewable and to ensure each test is a direct reflection
  of a system requirement — so tests cannot be unilaterally redefined by the
  agent to suit an implementation.
- **Mechanical gate, not judgment-based:** for a given change, new tests must
  fail against the pre-implementation code and old tests must keep passing
  unchanged; after implementation, all tests (new and old) must pass without
  further test edits. Where a change legitimately alters an existing test's
  expected output, that test-file change goes through its own reviewed
  test-branch, gated by a linter asserting the test change concurs with the
  spec.
- **Coverage thresholds, diff-scoped:** ~80–85% overall codebase coverage,
  95%+ on new/changed lines specifically (line/diff coverage, not whole-file
  coverage — avoids penalizing an agent for pre-existing untested code in a
  touched file, and avoids an incentive to avoid touching legacy files).
- **Weak-but-passing tests:** an "unicorn linter" (detects code/tests built
  on literal-value checks disconnected from a component's natural behavior)
  runs in the pipeline against both service code and test diffs, to catch
  tests that pass mechanically but don't actually exercise the requirement
  they claim to cover.
- **Small changes:** changes that don't require altering existing tests but
  still pass coverage checks can go straight to implementation, skipping the
  full three-gate cycle.
- **Tooling:** Kiro is the intended IDE, chosen for native spec/test/implement
  gating support.
- **Kiro fallback note (new):** since the gate model depends on IDE-level
  enforcement, and many "agentic IDE" gating features are workflow
  conventions rather than hard sandboxed boundaries, the pipeline itself
  should independently reject a PR where Spec/Test/Act commits aren't
  cleanly separated — a CI-side backstop that doesn't depend on Kiro's
  specific enforcement behavior, and keeps the gate resilient to a future
  IDE change.
- Manual pipeline override remains available to the author throughout.

### 11.4 Monorepo Consequence Management (resolved)

- Spec, Test, and Act gates are kept as three separate commits on a task's
  feature branch, so the gate structure itself provides commit-level
  traceability during review.
- Each task carries two documentation files: `task-<ref>.md` (human-readable
  task description) and `task-<ref>-spec.md` (the concrete specification of
  demanded changes). `task-<ref>.md` states the task's current state, which
  the gates advance in order: **Specified** (post-Spec gate) → **Tested**
  (post-Test gate) → **Done** (post-Act gate).
- On merge to mainline, all of a task's commits are squashed into one. This
  is a **deliberate tradeoff**: it exchanges detailed commit-level forensics
  of the agent/reviewer gate workflow (available only on the original
  feature branch, which may not persist) for a clean, navigable mainline
  history. The per-task doc files are what carry the "what happened at each
  gate" record forward, independent of Git history.
- **Documentation split across two repos:** task-level docs (`task-<ref>.md`,
  `task-<ref>-spec.md`) stay in the code repo, **`magpieweaver`**, since
  they're tied directly to a task's commits/gates and need to travel with
  the branch they describe. Broader documentation — this HLD, ADRs, and
  other non-task-scoped material — lives in the separate **`magpieweaver-docs`**
  repo. (Assumption stated here for confirmation: task docs stay code-side;
  flag if the intent was for task docs to live in `magpieweaver-docs` instead.)

### 11.5 Cloud Hosting Cost Model (resolved)

Only the in-memory cache (§8) needs to stay "always on" for a responsive UX
— Git operations run as short-lived, on-demand operations against FS-backed
persistent storage and do not require a permanently running process. This
means cost scales with **active** users, not registered users. Beyond the
cost benefit, not running compute nobody is using is also simply the right
thing to do environmentally, independent of what it saves — worth stating
plainly alongside the cost rationale, not just as a cost optimization.

- Cache warmth is scoped per branch (not per user account) and kept alive
  only while recently active, on a **configurable idle timeout** — tunable
  down to control cost during development/rollout, and up for production UX.
- Auto-warmup on access is limited to singleton entities (the materialized
  index/project metadata, §9's rematerialized index), not full entity sets —
  this is what keeps cold start cheap given bounded project data volume.
- Background jobs (§10.2) never touch the active user's cache; each
  maintains its own local, branch-scoped cache as needed, always via
  `GitDataStore`, reading/caching only what that job requires.
- Cache invalidation is precise: `commit` via the app's own `GitDataStore`
  write path keeps the cache current in-process (no invalidation needed);
  `merge`/`rebase` mutate state outside that path and must explicitly evict
  the cache of the branch being merged/rebased into. Eviction is
  branch-scoped and does not cascade — a branch's cache validity depends
  only on its own state, not on whether other branches are ahead or behind.
- Once demand exceeds single-host capacity, the cache tier can be off-boarded
  to a shared layer (ElastiCache) — viable because the backend is otherwise
  sessionless. This is what makes a **pooled** fleet of interchangeable
  instances/tasks safe (§4.2, `docs/specs/tech-stack.md` §4/§7): externalizing
  the cache first means sticky-session routing (pinning a user's requests to
  one specific instance) never has to be introduced at all, at any stage —
  it's avoided by design, not retired from a prior implementation. (Note: the
  earlier `§7.1` cross-reference here was stale — no such section exists in
  this document; ADR-008, covering multi-device concurrency via
  checksum-validated PATCH and write-ahead deltas, is the correct reference.)
- **Conflict-resolution transactionality:** when entity conflicts are
  resolved during a merge, index rematerialization must complete (and be
  committed) *before* the destination branch is rebased onto — entity
  conflict resolution, index rematerialization, and rebase are treated as one
  transactional unit specifically to protect destination-branch consistency
  in the case where it's actually at risk. Routine reindexing outside of
  conflict resolution has no such ordering requirement.

### 11.6 Interactive-vs-Async Job Classification
**TODO:** Beyond explicit author-initiated background tasks and system-
triggered proactive interception, is there a general rule (e.g. blast-radius
threshold across downstream scenes/branches) for when the system itself
decides an edit must be async rather than interactive?

### 11.6a Simplified Git Workflow UX
**TODO:** Authors are not software engineers and should not be exposed to
the full flexibility of the Git CLI/API. A deliberately simplified, strictly
enforced Git workflow (what operations are exposed, what the UI calls them,
what's hidden entirely) is required, particularly given the branch-per-user/
branch-per-job model (§7, §10) and the cache-eviction rules tied to specific
Git operations (§12.5). This was explicitly identified as a separate design
discussion, not yet started.

### 11.7 Data Model & Schema Design — moved out of scope

The core state-tracking schema (`EntityStateAttribute`,
`EntityStateAttributeValue`, `EntityStateAttributeValueDelta`) and the
prose-storage model are defined in `entity-state-schema.md` (ADR-017,
ADR-018) and owned by **MagpieEngine**.

Further schema work — `Character`, `Scene`, `SceneEvent`, `WorldLoreItem`,
`PlotPoint`, and the conditional context-inclusion condition object — is
MagpieEngine's context-marshaling responsibility specifically, and belongs
in `magpie-engine-hld.md` (see the Component Design Documents table, §1b),
not this system-level document. This HLD's remaining scope is the
surrounding system: client surfaces, storage/collaboration model, execution
model, and process gates.

### 11.8 LLM Orchestration Layer (candidates outlined, not locked)

**Provider model:** the app supplies a default LLM (needed to demonstrate
the product at all — this is not something the app can meaningfully run
without), while authors may substitute their own API key/provider. A bespoke
fine-tuned model is a possible future path but not a near-term requirement.
Weaver's generation and continuity-linting calls, and MagpieEngine's
merge-assist calls, are expected to share the same provider abstraction
(OpenAI-compatible interface) regardless of tier, so swapping providers is a
configuration change, not an architectural one.

There are four distinct usage tiers, each with a different cost/quality
tradeoff. **None of the specific models below are locked in** — this is a
snapshot to size the decision, current as of mid-2026; expect this to be
revisited close to each tier's actual build-out, since pricing and model
quality in this space move quickly. **For the MVP/production tier
specifically, see `docs/specs/llm-evaluation-candidates.md`** — a five-model
shortlist (all confirmed available on Bedrock, matching the confirmed
provider from `docs/specs/tech-stack.md` §4) intended as the starting input
for a dedicated evaluation task, not a decision. That evaluation is
deliberately out of scope for project initialisation, since model choice
has no bearing on any other element of the stack.

| Tier                                            | Need                                                                                                                                                                    | Candidate approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Local dev/testing**                           | Runs on a developer machine (~20GB RAM total footprint alongside the rest of the stack); doesn't need good prose or great linting, just needs to exercise the workflow. | A small local model (e.g. **Phi-4-mini**, ~3.8B, ~4GB RAM at Q4 quantization, or **Qwen3 8B**, ~6–7GB RAM at Q4) via **Ollama** or **llama.cpp**, exposed through an OpenAI-compatible local endpoint. Leaves ample headroom for the OS, backend, and frontend on a 20GB machine. No GPU required.                                                                                                                                                                                                                                                                                                                                                  |
| **MVP / initial rollout, 1–5 concurrent users** | Needs to be genuinely valuable (good prose, real continuity linting), lowest cost, must prevent runaway/unpaid overuse.                                                 | A hosted API — self-hosting doesn't make sense at this volume (the self-host cost crossover point is roughly 2–5M tokens/day of steady usage; 1–5 users won't reach that). Candidates in the low-cost-but-capable range: **Gemini 3 Flash** (~$0.50/$3.00 per 1M input/output tokens), **DeepSeek V4 Flash** (~$0.14/$0.28), or **MiniMax M3** (~$0.60/$2.40, one of the cheapest models clearing 80% on SWE-bench-class benchmarks — a reasonable proxy for instruction-following/consistency quality). Requires app-side per-user rate limiting/quota enforcement regardless of provider choice, since none of these providers cap spend for you. |
| **Medium concurrency, ~100 concurrent users**   | Needs to scale predictably; self-hosting becomes a real option but isn't automatically the right one.                                                                   | Likely still API-first unless usage volume is independently verified to approach the self-host crossover threshold — worth instrumenting token volume from day one specifically to make this call with real data rather than guessing. If self-hosting: a single reserved **H100 or H200 SXM instance** (~$2.00–2.60/GPU-hour on specialized GPU clouds, cheaper reserved) running **vLLM** or **SGLang** with a mid-size open-weight MoE model (e.g. **Qwen3.6-35B-A3B**, ~35B total/3B active parameters, Apache 2.0) at FP8 quantization — a reasonable throughput/cost balance at this scale.                                                   |
| **High concurrency, ~1000 concurrent users**    | Volume very likely crosses the self-hosting economic threshold; needs real MLOps investment.                                                                            | Self-hosted, multi-GPU (multiple H100/H200 nodes, tensor-parallel serving via vLLM/SGLang), sized against actual concurrent-generation load (not total registered users — most won't be generating simultaneously) and KV-cache memory per concurrent session. Realistic order of magnitude: **low-to-mid five-figures USD/month** in GPU spend alone, plus dedicated engineering capacity (this is consistently cited as exceeding infrastructure cost itself at this scale) — monetization needs to be in place to fund this tier, consistent with the plan to reach it only once usage justifies it.                                             |

**Consequence to note:** rate limiting and cost control need to exist from
the MVP tier onward regardless of which specific provider is chosen — this
is an application-level concern (per-user quotas enforced by the backend),
not something to rely on a provider's own limits for. Token-volume
instrumentation should be built in from the start so the self-hosting
crossover decision at the 100-user and 1000-user tiers is made on real data.

**Forward-looking, not MVP scope:** at higher concurrency, an inference
server (vLLM/SGLang) batches requests it receives, but has no concept of
user tiers or fairness — a weighted queue in front of it (free vs. paid
requests, with an anti-starvation aging rule so a long-waiting free request
eventually outranks a fresh paid one) would need to live in the app's own
backend, not the LLM server or a third-party API. This only becomes relevant
once self-hosting (§12.8's ~100/~1000-user tiers) and monetization exist —
noted here now so the LLM-call path is designed to have a queue insertable
in front of it later, without needing rework.

### 11.9 Observability & Monitoring (local tooling resolved)

- **Enterprise Cloud:** AWS CloudWatch (or equivalent) covers backend/API
  health, per-user cloud workspace metrics, and the async job queue — no
  local-tooling gap here, since this is standard managed cloud
  infrastructure.
- **Local Desktop:** no CloudWatch equivalent exists locally, and the
  observability tool itself has to respect the same tight resource budget as
  everything else running alongside it (§12.8's ~20GB local dev footprint).
  **OpenObserve** is the chosen tool — a single self-hosted binary covering
  both general backend/API metrics and Weaver/MagpieEngine LLM-call traces
  (token usage, latency, continuity-lint pass/fail) in one lightweight
  process, rather than a multi-container stack.
- **Lifecycle:** OpenObserve's local process is managed by
  **`MagpieWeaverApp`** (the Electron launcher, ADR-012) the same way the
  local backend's lifecycle is — started alongside the backend, stopped when
  the app is quit via the tray icon. This keeps `MagpieWeaverApp` as the
  single place local process lifecycle is owned, rather than introducing a
  second, independently-managed local service.

**Consequence to note:** OpenObserve's data model needs to be verified as
sufficient for the specific metrics called out above (LLM token/cost/latency
per call, continuity-lint pass/fail rate, circuit-breaker trip rate) before
this is fully locked — the tool choice is made, but the exact dashboard/metric
definitions are not yet specified.

### 11.10 CI/CD Pipeline (provider confirmed; enforcement scripts still to build)

The CI/CD pipeline is where the development-gate guardrails (§12.3/ADR-015)
are actually enforced — no code/test changes on a spec commit, no spec/code
changes on a test commit, new tests must fail pre-implementation and pass
post-implementation, etc. Running these checks as a local script was
explicitly rejected: it would share a trust boundary with the agent doing
the work, undermining the purpose of an independent gate.

**GitHub Actions is confirmed as the CI provider (ADR-021, now Approved),**
integrated with branch protection so gate-passage is an actual merge
precondition. The investigation resolved that no CI platform ships this gate
model natively — it's inherently bespoke pipeline logic on any provider —
and confirmed GitHub Actions' primitives (arbitrary script execution, full
git/diff access, structured test-result ingestion, required status checks,
native squash-merge, admin override) are sufficient to build it. See ADR-021
for the full breakdown against each requirement.

**What ADR-021 does not resolve:** the actual gate-enforcement scripts
(commit-diff inspection, the fail-then-pass test-ordering assertion,
diff-scoped coverage checks, the unicorn linter) are still unbuilt —
confirmed feasible, not yet implemented. Tracked as its own follow-up task.

**Still TODO beyond the CI provider question:**
- Mobile app store distribution/review process (§5.3).
- Cloud/infra deployment pipeline specifics for the MVP EC2 auto-shutdown +
  Lambda-triggered-restart model (discussed, not yet formalized as an ADR).

### 11.11 Compliance & Data Privacy (structured-PII lint resolved; account-PII store noted; broader items flagged)

**Structured-field PII lint (resolved):** email addresses, phone numbers,
dates of birth, and URLs are **hard-blocked** by default from prose and
metadata — narrative craft essentially never requires the literal string on
the page (information transfer between characters can be depicted without
exposing the concrete value), so unlike chronology's warn-don't-block
philosophy, this is a genuine rejection, not a warning. An explicit,
**audited override** is available: the author must actively confirm
override with the stated acknowledgment *"By overriding, you are confirming
that the flagged content is narrative detail and does not reflect a real
person."* This preserves legitimate cases (epistolary fiction, a plot-device
phishing email/burner number, an on-page birthdate reveal) without silent
bypass. Runs as a lint pass alongside continuity linting (§4/Weaver's
generation pipeline) and at Data Entry save/publish time. Explicitly a first
line of defense, not a complete solution — it cannot detect descriptive
identification of a real person that doesn't use these four patterns.

**Account PII (distinct from the structured-field lint above — added per
tech-stack.md §4.1/§6):** the structured-field lint and ADR-022 govern
**narrative-content** PII — a character's email address appearing in prose.
Separately, Magpie Weaver stores a small amount of **real, authenticated
account-holder PII**, in a different location and for a different reason:

- On first login without an existing workspace, the user is walked through
  a self-service onboarding flow — Terms & Conditions acceptance, workspace
  creation, and a `user.json` file written into that workspace containing
  `firstName`, `lastName`, and `emailAddress`, each **encrypted at rest**.
  The encryption key is a static value sourced from AWS SSM Parameter Store
  (`SecureString`) at instance boot, never held in plaintext outside the
  running process's memory.
- **Bounding unrestricted self-service creation:** since onboarding has no
  identity allowlist, any authenticated Google account holder who reaches
  the running instance directly can create a workspace. Two separate
  controls bound the two different risks this creates: a **per-user EFS
  storage quota** (flat for MVP, tiered later) bounds storage cost, and a
  manual `llmEnabled: true` boolean in `user.json` (defaulted to
  `false`/absent on creation) gates the genuinely expensive risk — LLM
  spend — behind an explicit, operator-set flag per user rather than
  granting it automatically on signup.
- Consent is recorded explicitly: `termsAndConditions: { accepted: true,
  auth: "<the OAuth token active in the accepting session>", acceptedAt:
  "<ISO-8601 timestamp>", version: "<major.minor.point>" }`. The timestamp is
  stored alongside the raw token specifically because a JWT's *signature*
  verifiability degrades over time (short-lived tokens, rotating JWKS)
  even though the string persists — the timestamp is the durable,
  format-independent record of when consent was actually given.
- **This is the only place Magpie Weaver stores PII.** It is out of scope
  for the ADR-022 lint (which governs narrative prose/metadata, not account
  records) and needs its own handling going forward — see the open items
  below, one of which is new as a direct consequence of this store existing.

**Resolved:** `user.json` is **not** Git-tracked — it's held outside the Git
working tree on EFS, alongside but separate from the user's Git-backed
narrative workspace. This means the right-to-erasure gap flagged below for
narrative content (Git history persisting even after squashing) does **not**
apply to this account PII: deleting/overwriting the file is a real, complete
erasure, with no historical copy retained anywhere. This was a deliberate
choice, not a default — worth keeping explicit for anyone touching this area
later, since it would be easy to assume "everything in the workspace
directory is Git-tracked" otherwise.

**Third-party LLM data use (accepted for MVP, revisit after):** MVP accepts
free/low-cost tier LLM providers training on submitted content, in exchange
for lower cost. Guarding author content against this (provider selection
requiring a no-training-on-submitted-data guarantee) is planned as
**probably the first feature after MVP**, not an MVP requirement. The same
applies to observability trace retention (§12.9) — full prompt/response
payloads in traces are an accepted MVP tradeoff, to be revisited alongside
the LLM data-use protection.

**Still genuinely open (not solved by the lint):**
- Whether the account-PII store (encrypted `user.json`) warrants its own ADR
  rather than living only in `docs/specs/tech-stack.md` and this footnote —
  flagged, not decided.
- Descriptive/contextual identification of real third parties (a character
  clearly modeled on a real, non-platform-user individual via biographical
  detail rather than structured fields) — not solvable by pattern-matching;
  remains a legal/policy question, not an engineering one.
- Right-to-erasure mechanics against Git-backed storage (history, even
  squashed, persists unless explicitly purged) — flagged, not resolved.
- Whether GDPR Article 85's artistic/literary-purpose exemptions apply, and
  how — requires legal counsel before EU users are in scope; not something
  to resolve by policy wording alone.
- Data residency — deferred until there's an actual user base in a
  jurisdiction where it matters.

**Also noted:** the scale-to-zero cache/backend model (§12.5, ADR-016; and
the MVP-specific EC2 auto-shutdown model, §12.10) is motivated by cost, but
also carries a genuine environmental-responsibility rationale worth stating
plainly alongside the cost one — not running compute nobody is using is
simply the right thing to do, independent of what it saves.