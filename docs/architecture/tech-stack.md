# Tech Stack Specification

**Task:** MAG-24 — Finalise the tech stack
**Status:** Draft — **not** ready to close as Done. See §5 "Open Items Blocking Finalisation."

## 0. Note on Scope vs. the Original Task Brief

The original MAG-24 brief asked this document to validate **Tauri v2** for the
desktop shell. That validation is moot: ADR-012 ("Desktop as Thin Launcher, No
Native Shell") already removed Tauri/Rust from the design, and HLD §11.2
records this as resolved — the desktop app is a launcher that starts a local
TypeScript backend and hands off to the system browser, with no native
shell/IPC bridge at all. §2 below documents the launcher model in place of the
requested Tauri validation, and flags the supersession explicitly rather than
silently dropping the requirement.

The brief also asked this document to confirm ALB/Fargate behaviour for the
cloud backend. The two source documents disagreed on the compute model at
enterprise scale (EC2 vs. ECS Fargate). This is now resolved: **ECS Fargate,
pooled behind an ALB, is confirmed for Enterprise scale** — the Architecture
doc's Enterprise-Scale diagram showing raw EC2 instances at that tier was an
error in that document, now corrected there directly (Architecture, HLD, and
Glossary have all been updated to match). **MVP stays on EC2** — a single
instance with a fixed Elastic IP and no load balancer, matching the
Architecture doc's actual MVP diagram — since MVP's real requirement (minimal
compute, EFS, a fixed IP, for one sporadic user) doesn't call for Fargate/ALB
at all; see §4.1.

---

## 1. React 19 + Vite

**Chosen for:** shared UI across Enterprise Cloud (PWA), Local Desktop
(browser handoff), and the codebase's general "high training-data density"
stack rationale (ADR-001) — relevant since 100% of code is agent-authored.

**Streaming/Suspense vs. long-running LLM generation:**
- Scene Director takes are not single request/response calls — a take can run
  for an extended period, autonomously, independent of client connection
  (HLD §9.1). This means the UI cannot rely on Suspense's request-scoped
  streaming model (`<Suspense>` + a thrown promise) as the *primary* mechanism
  for showing generation progress, since the generating process outlives any
  single component mount/fetch lifecycle.
- Suspense/streaming is still the right fit for the parts of the UI that
  genuinely are request-scoped: initial context load, entity reads, and the
  scene-event-level progressive reveal of prose *as it streams in* during an
  active, client-connected take.
- The durable, walk-away-safe state of a take (event-level checkpoint,
  §9.1/§9.2) needs a separate delivery mechanism — polling or a
  push-notification wake — layered *outside* the React render tree, updating
  local state that Suspense-driven components then read. This split (Suspense
  for in-flight rendering, an external channel for durable job state) should
  be an explicit interface, not something left implicit in component code.

## 2. Desktop Shell — Thin Launcher (supersedes Tauri v2 validation)

**Status:** Resolved per ADR-012; HLD §11.2 confirms.

- No native shell, no Rust, no IPC bridge. `MagpieWeaverApp` (the
  Electron-family launcher referenced in HLD §11.9) is a thin process whose
  only jobs are: show a loading screen, start the local Fastify backend if
  not already running, hand off to the system browser once the backend
  responds, and (per §11.9) manage the local OpenObserve process lifecycle
  alongside it.
- Filesystem mutation and Git operations happen entirely inside the
  TypeScript backend via the same `GitDataStore` implementation used by
  Enterprise Cloud/Mobile — invoking the Git CLI directly, no Rust layer
  mediating this. There is no separate desktop-specific `BranchingDataStore`
  implementation; `GitDataStore` covers local Git access without one.
- Because there is no IPC bridge, **IPC payload limits are not applicable**
  to this design; the removal of Tauri removed the one component that would
  have required this analysis (HLD §11.2: "eliminating the one component that
  broke the high-training-density stack rationale").
- Open item carried over from HLD §11.1: what stops the local backend process
  when the user is "done" (explicit quit vs. idle-timeout vs. tray-icon
  managed) is still undecided. This is a process-lifecycle question, not a
  stack-choice question, so it doesn't block finalising the *stack* itself,
  but it should be tracked separately (see task `TBD-06`-adjacent work in the
  Architecture doc's Rollback/Incident Response section, which is also open).

## 3. Fastify

**Chosen for:** both the Local Desktop backend and the Enterprise Cloud API
server (HLD §4.1, §4.2) — a single backend framework across both surfaces.

- **JSON validation:** Fastify's schema-based validation (JSON Schema per
  route) is low-overhead by design — schemas are compiled to serialization/
  validation functions ahead of request time rather than validated
  reflectively per request. This aligns directly with the project's own data
  model, since project entities are already JSON-Schema-validated
  (ADR-017/018, entity-state-schema.md) — the same schema definitions can, in
  principle, back both the GitDataStore entity validation and the API
  request/response contracts, avoiding a second parallel schema language.
- **Streaming text loops:** Fastify supports raw Node.js stream responses,
  which is the mechanism Weaver's generation pipeline needs to push
  in-progress prose to a connected client during an interactive take (§9.1).
  For the walk-away/reconnect case, the stream is not the durability
  mechanism — durability comes from the event-level checkpoint (§9.1) — the
  stream is purely a live-viewing convenience when a client is attached.

## 4. AWS CDK v2 / Cloud Compute / Networking

**Confirmed:** AWS CDK v2 is the infrastructure-as-code tool (`/packages/infra`,
HLD §4.2) regardless of which compute model is used underneath (see §5 below
for the compute-model discrepancy this document cannot resolve).

- **Confirmed at Enterprise scale:** an ALB sits in front of a **pooled fleet
  of ECS Fargate tasks** — any task can serve any user's request (isolation
  lives at the Git-workspace/EFS layer, not at the compute layer; see §4.2).
  EFS backs per-user Git workspaces; ElastiCache (Memcached) backs
  session/index caching; Bedrock is the target LLM provider for production
  (model TBD — see §5).
- **Confirmed at MVP scale:** **no ALB, no Fargate.** A single EC2 instance
  with an attached **Elastic IP** (fixed address, persists across stop/start),
  minimal compute/RAM, and EFS for storage — matching the Architecture doc's
  actual MVP diagram, which this document's earlier drafts incorrectly
  over-rode by assuming a container-native, ALB-fronted picture that was
  never the stated MVP requirement. See §4.1.
- **ALB + persistent WebSocket/SSE feasibility (Enterprise only):** ALBs
  support long-lived WebSocket and SSE connections natively (idle-timeout
  configurable up to 4000 seconds, extendable further with application-level
  keep-alive pings) — compatible with Scene Director's interactive,
  connection-attached generation streaming (§9.1), **provided** the
  idle-timeout is set above the longest expected gap between server-sent
  events during a take. This should be an explicit, tested configuration
  value, not a default left unexamined. Not applicable at MVP, since there's
  no ALB in that tier.
- **Task execution timeouts for deep agent loops (Enterprise only):** Fargate
  tasks have no inherent max-runtime cap (unlike, say, Lambda), but ECS
  service health checks and deployment rollover can terminate a task believed
  unhealthy if it isn't responding to its configured health check during a
  long, quiet generation stretch. The health check must be liveness-based
  (process responsive) rather than activity-based (recent request served),
  or a long, quiet take could be killed as a false-positive unhealthy task.
  Carried into §7 as a tracked bottleneck.
- **Pooling prerequisite — cache externalization is not optional polish.**
  A pool of interchangeable Fargate tasks only works if any task can safely
  serve any request. If each task holds a local in-memory session cache
  (the MVP-style `Map<string,any>` pattern), two tasks serving the same
  user's different requests would see inconsistent state, unless sessions
  are pinned to one task (sticky sessions — a real option, but reintroduces
  the per-task coupling pooling is meant to avoid) or the cache is
  externalized to ElastiCache so tasks are genuinely stateless. HLD §12.5
  already specifies this externalization at scale-up specifically to retire
  the sticky-session requirement — this document treats that as a hard
  prerequisite for enabling task pooling, not a nice-to-have optimization
  that can slip.

### 4.1 MVP compute: EC2 + Elastic IP + Lambda-triggered start/stop

**Resolved.** MVP is a single, small EC2 instance — not Fargate, not a
container-orchestrated fleet — matching what was actually specified: minimal
compute, a bit of RAM, EFS, and a fixed IP, for one user (sporadic,
convenience access) at minimum ongoing AWS cost.

- **Fixed IP:** an **Elastic IP** attached directly to the instance. This is
  the natural fit for "fixed IP with no load balancer" — the address persists
  across stop/start with no extra infrastructure. (AWS charges a small flat
  hourly fee for any allocated EIP regardless of instance state — roughly
  $0.005/hr — trivial at this scale, but worth naming so it isn't a surprise
  line item later.)
- **Scale-to-zero:** a small Lambda, triggered on idle detection (or on
  incoming-request detection via a lightweight always-on listener/DNS
  approach — exact trigger mechanism is a sub-decision, see §5) calls
  `StopInstances`/`StartInstances` on the EC2 instance directly. No ECS
  service, no task definitions, no `UpdateService` calls — just the plain
  EC2 start/stop API.
- **Cold start accepted, not engineered away.** Booting a stopped instance
  and having the TS Service come up is a one-time per-session wait for a
  single sporadic user (your daughter) — explicitly worth it for near-zero
  idle AWS spend, same reasoning as before, just against EC2 boot time
  instead of Fargate task/image-pull time. EC2 boot is often *faster* than a
  cold Fargate task pull, though this isn't the deciding factor here — cost
  and simplicity are.
- **No container requirement at MVP.** The TS Service can run as a plain
  Node process directly on the instance (systemd-managed, or similar) rather
  than needing to be packaged as a Docker image this early. Packaging as a
  container is still reasonable to do anyway for consistency and to ease a
  future move to Fargate, but it is **not being treated as a hard MVP
  requirement** — doing so would reintroduce exactly the "extra plumbing to
  fake an Enterprise capability" problem this correction is meant to avoid.
- **Consequence for the UI:** same as before — the client needs to treat
  "instance is starting" as an explicit, named UI state, not a bare
  timeout/error on the first request of a session.

**Promotion path — a real, acknowledged cost, not assumed away.** Moving from
this MVP shape to the Fargate-pooled Enterprise architecture (§4) is a
genuine re-platforming step: packaging the service as a container (if not
already done), standing up the ALB + task pool + externalized cache, and
retiring the EC2/EIP/Lambda-start-stop path entirely. This is not free, and
this document should not claim otherwise. It's accepted here as the right
tradeoff *because* MVP is a single-user side project where minimizing
ongoing cost and operational complexity right now outweighs avoiding a later
rework that only becomes necessary if/when there's an actual Enterprise-scale
user base to build for.

## 5. Open Items Blocking Finalisation

This document cannot honestly claim MAG-24's acceptance criteria are fully
met while the following remain unresolved. Recording them here rather than
papering over them:

| Item | Why it blocks a locked matrix |
|---|---|
| **MVP idle-detection trigger mechanism** | §4.1 confirms EC2 `StopInstances`/`StartInstances` via Lambda in principle, but the exact trigger — a scheduled idle check, a lightweight always-listening component that wakes the instance on first inbound connection, or something else — isn't chosen yet. Needs an answer before implementation, but doesn't change the matrix's compute-model entry. |
| **Bedrock model selection** | Every architecture diagram marks the Bedrock model as "TBD" and explicitly defers this to its own ADR (Architecture doc, LLM model selection note). HLD §12.8 similarly says no candidate model at any tier is locked. Cannot version-pin what hasn't been chosen. |
| **CI/CD provider (ADR-021)** | GitHub Actions is the *intended* provider but is recorded as open, pending investigation into whether it can actually enforce the Spec/Test/Act commit-level gate (HLD §11.10). The matrix row exists but should be labelled "proposed," not "chosen," until that investigation closes. |
| **MVP scope boundary (ADR-019)** | Still open per both source docs. This affects which rows of the matrix are "must be finalised now" vs. "can stay provisional" — e.g., mobile-native tooling is deferred regardless of stack choice once ADR-019 confirms MVP is Android-only, limited-user scope. |

---

## 6. Technology Matrix

| Component | Chosen Technology | Version Pin | Engineering Rationale |
|---|---|---|---|
| Shared UI | React | 19 | HLD §2; ADR-001 training-data-density rationale; single UI across all client surfaces. |
| Build tool | Vite | *not yet pinned* | Paired with React 19 per HLD §2; no explicit version decision recorded — carry forward as a gap, not a silent assumption. |
| Backend framework (local + cloud) | Fastify | *not yet pinned* | HLD §4.1/§4.2; low-overhead JSON Schema validation reusing entity schema definitions (ADR-017/018); native stream support for generation output. |
| Desktop shell | Thin launcher (Electron-family, no native shell) | *not yet pinned* | ADR-012; supersedes original Tauri v2 proposal — no Rust/IPC layer exists in the design. Local Git access runs through the same `GitDataStore` implementation as Enterprise/Mobile — no separate desktop-specific `BranchingDataStore` implementation exists (§2). |
| Cloud IaC | AWS CDK | v2 | HLD §4.2, `/packages/infra`. |
| Cloud compute (Enterprise) | AWS ECS Fargate, pooled task fleet | — | Confirmed over raw EC2 for managed scalability — no instance/AMI lifecycle to own, capacity scales at task level. Requires cache externalization (below) as a pooling prerequisite, not optional polish. Architecture doc's Enterprise-Scale diagram now corrected to match (originally showed EC2 in error). |
| Cloud compute (MVP) | Single EC2 instance + Elastic IP, `StopInstances`/`StartInstances` via Lambda | — | §4.1: matches the actual MVP requirement (minimal compute/RAM, EFS, fixed IP, no ALB) for a single sporadic user. No container requirement at this tier. Genuinely different run target from Enterprise — promotion is a real, acknowledged re-platforming step, not a config change. |
| Load balancing (Enterprise) | AWS ALB | — | **Enterprise only.** Not present at MVP — a single EC2 instance with an Elastic IP needs no load balancer. |
| Shared storage | AWS EFS | — | Architecture doc + HLD; per-user workspaces & Git repos. |
| Session/index cache (Enterprise scale-up) | ElastiCache (Memcached) | — | Architecture doc Enterprise diagram; explicitly **not MVP** (HLD §1a — scale-up excluded from MVP). |
| Session/index cache (MVP/Test/Dev) | In-process `Map<string, any>` | — | Architecture doc MVP/Test/Dev diagrams; ADR-010, ADR-016. |
| LLM provider (target) | AWS Bedrock | **model TBD** | Both source docs mark this explicitly unresolved; own ADR required. |
| LLM provider (local dev) | LM Studio (or Ollama/llama.cpp per HLD §12.8 candidates) | model TBD (e.g. Phi-4-mini, Qwen3 8B candidates, unpinned) | Architecture doc Development Architecture diagram; HLD §12.8 sizing table. |
| Data store contract | `GitDataStore` implementing `BranchingDataStore` interface | — (interface still draft, HLD §5) | ADR-004, ADR-006; not yet finalised — HLD itself labels the interface a draft. Renamed from the earlier "FileStore" naming; the rename is now propagated across Architecture, HLD, and Glossary. There is no separate desktop-specific implementation — `GitDataStore` alone covers all surfaces, so the earlier `NativeGitFileStore` naming question is now moot rather than open (§2, §5). |
| Test-only data store | `MockDataStore` | — | HLD §5; zero-dependency in-memory CI implementation. |
| Wake-on-demand path (MVP scale-to-zero) | AWS Lambda calling EC2 `StartInstances`/`StopInstances` | — | §4.1/§5: idle-detection trigger mechanism is the one remaining sub-decision; the API calls themselves are plain EC2, no ECS involved. |
| CI/CD provider | GitHub Actions (**proposed, not confirmed**) | — | ADR-021, open pending investigation (HLD §11.10). |
| Local observability | OpenObserve | — | ADR-020; HLD §11.9. |
| Ticketing/task tracking | Linear | — | Architecture doc, Task Tracking section. |

---

## 7. Identified Engineering Bottlenecks & Mitigations

| Bottleneck | Risk | Mitigation |
|---|---|---|
| **Long-running take vs. request-scoped UI patterns** | A naive Suspense-only implementation could implicitly assume a take completes within one component's mounted lifetime, breaking on walk-away/reconnect. | Explicitly separate "live stream rendering" (Suspense-appropriate) from "durable job state" (external channel, §1 above) at the interface level before any Scene Director UI work starts, so this isn't discovered mid-implementation. |
| **ALB idle-timeout vs. quiet generation stretches** *(Enterprise only)* | A take with a long gap between SSE events (e.g. slow LLM response, retry-with-backoff) could be dropped by the ALB if idle-timeout is left at a default unrelated to actual generation behaviour. | Set ALB idle-timeout explicitly based on measured worst-case gap between events, plus application-level keep-alive pings; treat as a tested configuration value, not a default. |
| **Fargate health checks vs. quiet-but-alive tasks** *(Enterprise only)* | A liveness check that doubles as an activity check could kill a task that's correctly alive but quietly waiting on a slow LLM call, losing in-flight state the checkpoint model wasn't designed to protect against at this layer. | Use a lightweight liveness endpoint decoupled from request-serving activity, so a long, quiet generation stretch isn't misread as an unhealthy task. |
| **Cache-consistency prerequisite for task pooling** *(Enterprise only)* | If task-pooling ships before the cache is genuinely externalized (HLD §12.5), two tasks serving the same user's requests could see inconsistent in-memory state — a correctness bug, not just a performance one. | Treat ElastiCache externalization as a hard prerequisite gating the move to a pooled Fargate fleet, not an optional later optimization; don't enable pooling until it's in place. |
| **Cold-start UX on instance wake** *(MVP)* | A first request hitting a stopped EC2 instance with no explicit handling looks like a bare timeout or connection error to the user, not "starting up" — jarring for a casual, sporadic user. | Client treats "instance starting" as an explicit, named UI state with its own loading message, distinct from the desktop launcher's own startup screen; test the full boot-to-ready path, not just the warm-path happy case. |
| **Idle-detection threshold tuning** *(MVP)* | Too aggressive an idle-timeout stops the instance mid-session during a normal pause in usage (e.g. re-reading a scene before the next take), forcing an avoidable cold start; too lax a threshold erodes the cost benefit that's the entire point of this design for MVP. | Treat the idle-timeout value as a tested configuration, tuned against realistic session-gap behaviour, not a default left unexamined. |
| **MVP → Enterprise re-platforming** | Because MVP (bare EC2 process, no ALB) and Enterprise (pooled Fargate fleet behind an ALB, externalized cache) are genuinely different infrastructure, promotion is a real migration project, not a config flip — risk is this being underestimated later because it wasn't flagged early. | Named explicitly here (§4.1) as an accepted, real cost — plan for it as its own piece of work when the time comes, rather than assuming continuity that doesn't exist. |
| **Schema duplication between Fastify request contracts and entity JSON Schemas** | Maintaining two parallel schema definitions (API contracts vs. entity-state-schema.md) risks drift as `entity-state-schema.md` evolves. | Generate/derive Fastify route schemas from the same JSON Schema source used for entity validation where the shapes genuinely overlap, rather than hand-authoring both. |
| **Provider abstraction lock-in risk** | Weaver/MagpieEngine calls are meant to share an OpenAI-compatible provider abstraction (HLD §12.8) regardless of tier — if early implementation hard-codes Bedrock-specific request/response shapes, swapping providers later (a stated goal) becomes an architectural change instead of a config change. | Enforce the OpenAI-compatible interface as the only surface Weaver/MagpieEngine code is allowed to call, with the actual provider (Bedrock, LM Studio, or a future self-hosted vLLM/SGLang endpoint) behind it from day one — even at MVP, even though only one provider is in use. |
| **Undeclared Vite version drift** | With no version pin recorded, agent-authored setup work could land on a different Vite major version across environments (local dev machine vs. CI) without anyone deciding that on purpose. | Pin explicitly in this document once decided; until then, lockfile-enforced consistency (`pnpm-lock.yaml` committed) is the interim guard, not a substitute for an actual decision. |

---

## 8. Task Status

Per the note in §0 and the open items in §5, this document should **not** be
marked Done against MAG-24's original acceptance criteria yet. Resolved in
this pass (and now propagated to the source docs themselves): Enterprise
compute (pooled ECS Fargate fleet behind an ALB, with cache externalization
as a hard pooling prerequisite), MVP compute (single EC2 instance + Elastic
IP, Lambda-triggered `Stop`/`StartInstances`, no ALB, no container
requirement — cold start explicitly accepted given single-sporadic-user usage
and cost-minimization priority), the Architecture doc's Enterprise-Scale
diagram correction, the FileStore→BranchingDataStore rename across
Architecture/HLD/Glossary, and the removal of the (unnecessary) separate
desktop-specific `NativeGitFileStore` implementation — `GitDataStore` alone
now covers Local Desktop as well as Enterprise/Mobile, so that naming
question is moot rather than open. Remaining before this can be finalised:
the MVP idle-detection trigger mechanism (§5), Bedrock model selection, and
the CI/CD provider investigation (ADR-021) — plus the still-open MVP scope
boundary (ADR-019) that affects how much of the rest is worth locking down
now. Recommended next step: pick the MVP idle-detection trigger, and track
the remaining two ADRs to closure before merging this as final.
