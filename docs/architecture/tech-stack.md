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
  lives at the Git-workspace/EFS layer, not at the compute layer; see HLD
  §4.2). EFS backs per-user Git workspaces (see §4.2 below for why EFS is
  used at MVP too, not just Enterprise); ElastiCache (Memcached) backs
  session/index caching; Bedrock is the target LLM provider for production
  (model TBD — final selection is a dedicated evaluation task, out of scope
  for project initialisation; see `docs/specs/llm-evaluation-candidates.md`
  for the candidate shortlist that feeds that future evaluation).
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
- **Scale-to-zero (resolved — mechanism, trigger, and auth):**
  - **Stop:** self-managed, no Lambda involved — but **not** based on
    request activity alone. A pure request-idle timer would be wrong: a
    Scene Director take can run for a long stretch with the client walked
    away and zero incoming HTTP requests (HLD §9.1), and async background
    jobs (§10) are explicitly client-connection-independent — either would
    get killed mid-generation by a request-activity-only timer, the same
    "quiet but alive" failure mode already flagged for Fargate health checks
    in §7. Instead: a **last-heartbeat timestamp**, refreshed by (1) a new
    client session/connection, and (2) a short, fixed-interval heartbeat
    emitted by any in-progress long-running job (Scene Director take, async
    background job) — not just at job start/end, since a single SceneEvent's
    LLM call could itself outlast the idle window. A lightweight watchdog
    checks `now − lastHeartbeat > idleThreshold` and calls
    `ec2:StopInstances` on itself when true, via an IAM role scoped to that
    one action on its own instance ID. A timestamp-refresh design is
    preferred over a literal acquire/release semaphore specifically because
    it self-heals: if a job crashes without hitting a release path, a
    counter-based semaphore would leak and never let the host stop, whereas
    a stale timestamp just ages out naturally — no explicit cleanup code
    required. **Consequence for the Job Execution Substrate:** emitting this
    heartbeat needs to be part of its durability model — see the companion
    note, `docs/specs/notes/job-execution-substrate-heartbeat-note.md`, for
    what this implies for that component's own design.
  - **Start:** a Lambda behind a **Function URL** (not API Gateway — no
    fixed hourly cost, standard Lambda pricing only, and the free tier alone
    likely covers this workload indefinitely at this usage volume). The
    client's normal path is to connect directly to the instance's Elastic IP
    first, exactly as if scale-to-zero didn't exist; it only calls the
    Lambda if that direct attempt fails, to check state and trigger
    `StartInstances` if stopped. This means the Lambda is invoked roughly
    once per idle-stop→wake boundary, not once per session and not
    repeatedly through a session.
  - **Auth on the wake path (resolved):** the Lambda requires **both** a
    valid, signed Google ID token (verified via `google-auth-library`,
    checked against Google's public keys — no VPC needed, since this hits
    Google's public endpoint directly) **and** a shared secret bundled in
    the client. Neither alone is sufficient. This is a deliberately narrow
    gate: it exists only to block blind/automated discovery of the Function
    URL (e.g. scanner bots hitting a leaked or guessed endpoint with no app
    involved at all) — it is explicitly **not** the data-access boundary.
    A leaked secret only ever grants what "is a valid Google account holder"
    already grants: the ability to see whether the backend is running and
    to start it, which is functionally identical to what opening the app
    legitimately allows. See §7 for the accepted residual risk and its
    mitigation (a billing alarm, not a `sub`-allowlist).
  - **Real authorization happens once, on the backend, per request — not on
    the wake path.** The TS Service verifies the same Google ID token, then
    checks whether the token's `sub` claim (the stable per-account
    identifier — **not** email, which can change or be reassigned) has a
    corresponding workspace directory on EFS. This reuses the per-user
    workspace model that already exists for data isolation, rather than
    inventing a second authorization mechanism.
  - **Onboarding is self-service, not hand-provisioned — correction from an
    earlier draft.** A `sub` with no existing workspace is not rejected;
    instead the user is prompted through a first-run flow: accept Terms &
    Conditions, then the backend creates the workspace directory and writes
    a `user.json` containing `firstName`, `lastName`, `emailAddress` (each
    **encrypted at rest**) and a `termsAndConditions` record — `{ accepted:
    true, auth: "<the OAuth token active in the accepting session>",
    acceptedAt: "<ISO-8601 timestamp>", version: "<major.minor.point>" }`.
    The `acceptedAt` timestamp is deliberately stored alongside the raw
    token: Google ID tokens are short-lived and signed against a JWKS that
    rotates over time, so the token's *signature* may become unverifiable
    long after the fact even though the string itself persists — the
    timestamp gives a format-independent record of *when* consent was given,
    independent of whether the token can still be cryptographically checked
    years later.
  - **Bounding self-service onboarding's cost/abuse exposure (resolved):**
    unrestricted self-service creation means any Google account holder who
    reaches the running instance directly (not through the wake path, whose
    shared-secret gate only protects the stopped→running transition, above)
    could create a workspace. Two separate controls bound the two different
    things actually at risk here, rather than one mechanism trying to do
    both:
    - **Storage:** an EFS usage quota per user (flat for MVP; tiered quotas
      are a natural later extension). Bounds the cost of unrestricted
      workspace creation to capped storage, not unbounded storage.
    - **LLM spend (the genuinely expensive risk):** a manual `llmEnabled:
      true` boolean field in `user.json`, defaulted to `false`/absent on
      self-service creation. A newly self-onboarded workspace exists but
      cannot trigger LLM calls until the operator manually sets this flag
      for that specific user — appropriate given MVP's actual user count,
      and a deliberate manual gate rather than an automated one.
  - **Encryption key sourcing:** the static key used to encrypt those three
    fields is fetched from **SSM Parameter Store as a `SecureString`** at
    instance boot (the instance's IAM role calls `get-parameter
    --with-decryption` in user-data), not baked into an AMI or user-data
    script in plaintext. SSM `SecureString` is itself KMS-encrypted at rest
    and free at standard-parameter tier, so the key exists in plaintext only
    in the running process's memory, never on disk or in version control.
  - **This is the only place Magpie Weaver stores PII**, and it's a
    genuinely different category from ADR-022's narrative-content PII lint
    (a character's email address appearing *in prose*, hard-blocked by
    default) — this is the real, authenticated account holder's own data,
    deliberately stored with explicit consent tracking. `llmEnabled` itself
    is not PII, but lives in the same file. Worth keeping these
    two conceptually separate rather than conflated, since they have
    different threat models and different handling rules. See the flag added
    to HLD §12.11 for this.
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
- **Consequence for the UI:** the client attempts a direct connection first
  and only falls back to the wake-check Lambda on failure (§4.1 above); when
  that fallback fires, the client needs to treat "instance is starting" as
  an explicit, named UI state, not a bare timeout/error.

### 4.2 Storage: Amazon EFS (used at MVP too, not just Enterprise)

**This needed its own examination rather than being carried forward as a
given.** Every diagram in the Architecture doc uses EFS at every tier,
including MVP — but EFS's defining feature is concurrent multi-host access,
which a single-instance MVP has no use for at all. That's worth actually
justifying rather than assuming, since the obvious alternative (EBS) is
simpler and roughly 3-4x cheaper per GB.

- **Why EFS anyway, at MVP, despite EBS being cheaper and simpler for a
  single host:** data-continuity at promotion time, not cost. If MVP used
  EBS and Enterprise uses EFS (required there, for genuine multi-task
  access), promotion would require an actual data migration — copying every
  user workspace from an EBS volume onto EFS — on top of the
  already-accepted compute re-platforming (§4.1's EC2→Fargate promotion
  cost). Migrating a live Git-backed workspace correctly (mid-repo-history,
  possibly mid-write) is meaningfully riskier than a compute change, since a
  compute promotion touches infrastructure, not data. Using EFS from MVP
  onward means promotion only ever changes *where compute runs*, never
  *where data lives* — one variable moving instead of two.
- **Cost check at actual MVP scale:** the ~3-4x per-GB premium sounds
  significant in isolation, but at a couple of users' worth of narrative
  JSON + prose (realistically low single-digit GB for a long while), the
  absolute difference is on the order of a few dollars a month, not a
  meaningful line item — nowhere near the scale of the fixed-cost traps
  already avoided elsewhere (ALB ~$16/mo, NAT Gateway ~$32+/mo, §4). The
  earlier cost-minimization argument that ruled out Fargate/ALB at MVP does
  **not** carry over to ruling out EFS — the dollar amounts involved are in
  a completely different bracket.
- **No NAT-gateway conflict:** an EFS mount target is just an ENI reachable
  over NFS (port 2049) from whatever subnet the instance is in — it doesn't
  require the instance to be in a private subnet, and doesn't reintroduce
  the NAT Gateway cost already avoided in §4 for outbound internet access.
  The two decisions are independent and compatible.
- **Throughput mode:** **Elastic throughput** is the better fit here over
  the default Bursting mode — it's pay-per-use (scales automatically with
  actual read/write volume, no capacity planning) rather than a
  provisioned/credit-based model, which matches the same "pay for what's
  actually used" ethos already applied to compute (§4.1) and fits genuinely
  sporadic, low-and-bursty access far better than a steady-baseline
  assumption would.
- **Storage class / lifecycle policy:** EFS Infrequent Access (IA), with a
  lifecycle policy moving files untouched for a configurable period (e.g. 30
  days) into the cheaper IA tier automatically, is a good fit specifically
  *because* usage here is sporadic — most workspace data will sit untouched
  between sessions. This should be enabled from day one; it costs nothing to
  configure and only saves money as access patterns fall into IA-eligible
  territory naturally, given how the whole system is expected to be used.
- **AZ alignment (small operational note, not a design risk):** an EFS
  mount target is per-AZ; the EC2 instance's stop/start cycle (§4.1) keeps
  the instance in its originally assigned subnet/AZ unless explicitly moved,
  so this doesn't introduce a real risk — just worth confirming the mount
  target exists in that specific AZ when the CDK stack is written, rather
  than assumed.

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

**None remain.** This section is kept (rather than deleted) as a record
that every item it once listed was actually resolved, not silently dropped:
Enterprise/MVP compute model, storage, authentication/authorization,
account-PII handling (ADR-023), the Desktop Backend Process Lifecycle
question, LLM model selection (deferred with a candidate shortlist, per
ADR-019), the MVP scope boundary itself (ADR-019, Approved), and finally the
CI/CD provider (ADR-021, Approved — GitHub Actions confirmed as
sufficient for this project's specific gate-enforcement needs; the
gate-enforcement scripts themselves remain a separate follow-up
implementation task, not a blocker to this document).

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
| Shared storage | AWS EFS, Elastic throughput, IA lifecycle policy enabled | — | §4.2: used from MVP onward (not just Enterprise) specifically to avoid a data-migration step at promotion — only compute changes at that point, not where data lives. Elastic throughput and IA lifecycle both chosen to match the sporadic, pay-per-use usage pattern; cost premium over EBS is real but immaterial at actual MVP data volume (a few dollars/month, not a fixed-cost trap like the ALB/NAT costs avoided elsewhere). |
| Session/index cache (Enterprise scale-up) | ElastiCache (Memcached) | — | Architecture doc Enterprise diagram; explicitly **not MVP** (HLD §1a — scale-up excluded from MVP). |
| Session/index cache (MVP/Test/Dev) | In-process `Map<string, any>` | — | Architecture doc MVP/Test/Dev diagrams; ADR-010, ADR-016. |
| LLM provider (target) | AWS Bedrock | **model TBD — candidate shortlist established** | Final selection is a dedicated evaluation task, out of scope for project initialisation and independent of every other stack choice in this document. See `docs/specs/llm-evaluation-candidates.md` for the top-5 shortlist (input to that evaluation, not a decision). |
| LLM provider (local dev) | LM Studio (or Ollama/llama.cpp per HLD §12.8 candidates) | model TBD (e.g. Phi-4-mini, Qwen3 8B candidates, unpinned) | Architecture doc Development Architecture diagram; HLD §12.8 sizing table. |
| Data store contract | `GitDataStore` implementing `BranchingDataStore` interface | — (interface still draft, HLD §5) | ADR-004, ADR-006; not yet finalised — HLD itself labels the interface a draft. Renamed from the earlier "FileStore" naming; the rename is now propagated across Architecture, HLD, and Glossary. There is no separate desktop-specific implementation — `GitDataStore` alone covers all surfaces, so the earlier `NativeGitFileStore` naming question is now moot rather than open (§2, §5). |
| Test-only data store | `MockDataStore` | — | HLD §5; zero-dependency in-memory CI implementation. |
| Wake-on-demand path (MVP scale-to-zero) | AWS Lambda + Function URL, calling EC2 `StartInstances`; stop is self-managed by the TS Service calling `StopInstances` on itself | — | §4.1: fully resolved — trigger (client direct-connect-first, Lambda fallback only), mechanism (plain EC2 API, no ECS), and auth (below) are all decided. Function URL chosen over API Gateway: no fixed hourly cost, free tier covers this workload's volume. |
| Idle-stop signal (MVP) | Last-heartbeat timestamp, refreshed by client sessions and by in-progress job heartbeats; watchdog checks staleness | — | §4.1: request-activity-only idle detection would kill a quiet-but-alive Scene Director take or async job; a self-healing timestamp (vs. a leak-prone acquire/release semaphore) requires the Job Execution Substrate to emit heartbeats — see the companion note. |
| User authentication | Google Sign-In (OAuth ID token), verified via `google-auth-library` | — | §4.1: minimal backend for MVP — stateless per-request token verification, no Cognito/DynamoDB/session store required. Same verification logic reused by both the TS Service and the wake-path Lambda. |
| User authorization | `sub`-keyed EFS workspace lookup (TS Service only) | — | §4.1: reuses the existing per-user workspace model as the authorization source; keyed on Google's `sub` claim specifically, not email (email can change/be reassigned). Onboarding is **self-service** — a `sub` with no workspace triggers first-run Terms & Conditions acceptance + workspace creation, not operator hand-provisioning (corrected from an earlier draft). |
| Account PII storage | `user.json` per workspace: `firstName`/`lastName`/`emailAddress`, encrypted at rest | — | §4.1: the only place Magpie Weaver stores PII; distinct in kind from ADR-022's narrative-content PII lint — this is real account-holder data with explicit consent tracking, not narrative prose. Now reflected in HLD §11.11, including the resolved (non-Git-tracked) storage location. |
| Self-service onboarding cost/abuse gating | Per-user EFS quota (storage) + manual `llmEnabled` flag in `user.json` (LLM spend) | — | §4.1: two separate controls for two different risks — unrestricted self-service workspace creation is bounded to capped storage; LLM spend requires an explicit, manual operator flag per user, appropriate at MVP's actual user count. |
| PII encryption key sourcing | AWS SSM Parameter Store (`SecureString`), fetched at instance boot | — | §4.1: static key never lives in plaintext outside the running process's memory — not baked into an AMI or user-data script. Free at standard-parameter tier, itself KMS-encrypted at rest. |
| Wake-path access control | Shared secret (client-bundled) + valid Google ID token, both required | — | §4.1/§7: narrow gate blocking blind/automated Function URL discovery only — explicitly not the data-access boundary, which lives entirely in the backend's `sub`/workspace check above. Residual risk (a targeted actor extracting the secret can still wake the instance, same bar as a legitimate app user) is accepted; see §7 for the billing-alarm mitigation. |
| Cost-abuse backstop | AWS Billing/CloudWatch alarm on a small spend threshold | — | §7: cheaper and simpler than adding a `sub`-allowlist to the wake-path Lambda; catches the residual boot-cycling/griefing risk the shared secret doesn't fully close. |
| CI/CD provider | GitHub Actions (**confirmed**) | — | ADR-021, Approved (HLD §11.10) — confirmed sufficient via required status checks, scripted commit-diff inspection, and structured test-result ingestion; gate-enforcement scripts themselves are separate follow-up work. |
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
| **Idle-detection threshold tuning** *(MVP)* | Too aggressive an idle-timeout stops the host mid-take/mid-job (a long-running generation or async job with no recent heartbeat yet still legitimately in progress), forcing an avoidable cold start and losing in-flight work at the point of shutdown; too lax a threshold erodes the cost benefit that's the entire point of this design for MVP. | Treat the idle-timeout value as a tested configuration, tuned against realistic session-*and-job* gap behaviour (§4.1's heartbeat design), not a default left unexamined. |
| **Semaphore-leak risk (avoided by design)** *(MVP)* | A literal acquire/release semaphore for "job in progress" would leak if a job crashed without hitting its release path — the count never returns to zero, the host never stops, silent ongoing cost with nothing to notice it. | Use a last-heartbeat timestamp instead of a counter (§4.1): a dead job's heartbeats simply stop and the timestamp ages out naturally, no explicit cleanup code required. |
| **Direct-connect timeout tuning** *(MVP)* | The client's direct-connect-first attempt (§4.1) needs a timeout short enough that a genuinely stopped instance doesn't leave the user staring at a hung request, but not so short that a brief network blip gets misread as "stopped," triggering an unnecessary (though harmless-cost-wise) wake-check Lambda call and a spurious "starting up" message. | Tune the direct-connect timeout empirically once real usage exists, same discipline as the idle-detection threshold above; don't ship a guessed default unexamined. |
| **Residual wake-path abuse after secret leak** *(MVP, accepted)* | A shared secret extracted from the client app (realistic — mobile secrets aren't truly secret) combined with any Google account clears the wake-path gate, allowing scripted repeated `StartInstances` calls (boot-cycling cost/availability griefing), though never data access. | Deliberately accepted rather than closed with a `sub`-allowlist on the Lambda, given the actual threat level at this scale (§7); mitigated instead by a billing alarm as a cheap detection backstop, not prevention. |
| **`sub` vs. email as the authorization key** *(MVP)* | Keying workspace authorization on email risks a future account takeover if an email address is ever freed and re-registered by someone else under the same address. | Key exclusively on Google's `sub` claim (stable, opaque, non-reassignable per-account identifier), never email, for the EFS workspace lookup (§4.1). |
| **MVP → Enterprise re-platforming** | Because MVP (bare EC2 process, no ALB) and Enterprise (pooled Fargate fleet behind an ALB, externalized cache) are genuinely different infrastructure, promotion is a real migration project, not a config flip — risk is this being underestimated later because it wasn't flagged early. | Named explicitly here (§4.1) as an accepted, real cost — plan for it as its own piece of work when the time comes, rather than assuming continuity that doesn't exist. |
| **EFS-IA first-access latency after long idle periods** *(MVP)* | Files moved to the Infrequent Access storage class (§4.2) have marginally higher per-request latency than Standard on first touch — could compound with the instance's own cold-start wait if a session begins right after a long idle stretch, both landing on the same first request. | Acceptable given the small absolute latency delta and that it's already masked behind the explicit "instance starting" UI state (§4.1); worth confirming empirically once real usage exists, not a reason to withhold the IA lifecycle policy. |
| **Schema duplication between Fastify request contracts and entity JSON Schemas** | Maintaining two parallel schema definitions (API contracts vs. entity-state-schema.md) risks drift as `entity-state-schema.md` evolves. | Generate/derive Fastify route schemas from the same JSON Schema source used for entity validation where the shapes genuinely overlap, rather than hand-authoring both. |
| **Provider abstraction lock-in risk** | Weaver/MagpieEngine calls are meant to share an OpenAI-compatible provider abstraction (HLD §12.8) regardless of tier — if early implementation hard-codes Bedrock-specific request/response shapes, swapping providers later (a stated goal) becomes an architectural change instead of a config change. | Enforce the OpenAI-compatible interface as the only surface Weaver/MagpieEngine code is allowed to call, with the actual provider (Bedrock, LM Studio, or a future self-hosted vLLM/SGLang endpoint) behind it from day one — even at MVP, even though only one provider is in use. |
| **Undeclared Vite version drift** | With no version pin recorded, agent-authored setup work could land on a different Vite major version across environments (local dev machine vs. CI) without anyone deciding that on purpose. | Pin explicitly in this document once decided; until then, lockfile-enforced consistency (`pnpm-lock.yaml` committed) is the interim guard, not a substitute for an actual decision. |

---

## 8. Task Status

**Done.** All items originally tracked in §5 are resolved, and every one is
reflected in the source documents themselves, not left living only in this
file:

- **Compute:** Enterprise (pooled ECS Fargate fleet behind an ALB, cache
  externalization as a hard pooling prerequisite) and MVP (single EC2
  instance + Elastic IP, self-managed heartbeat-based stop, Lambda-Function-
  URL wake, no ALB, no container requirement) — genuinely different shapes,
  with the promotion cost between them explicitly accepted rather than
  assumed away.
- **Storage:** EFS from MVP onward (not EBS), Elastic throughput, IA
  lifecycle policy — chosen to avoid a data migration at promotion, not for
  cost, which is a wash at this scale.
- **Auth, authorization, and account PII:** Google Sign-In, `sub`-keyed EFS
  workspace authorization, self-service onboarding bounded by an EFS quota
  and a manual `llmEnabled` gate on LLM spend specifically — now formally
  recorded in its own **ADR-023**.
- **Naming/documentation corrections:** the Architecture doc's
  Enterprise-Scale diagram (EC2 → Fargate), the FileStore→BranchingDataStore
  rename across Architecture/HLD/Glossary, and the removal of the
  unnecessary desktop-specific `NativeGitFileStore` implementation.
- **Desktop Backend Process Lifecycle** (HLD §11.1): explicit tray-icon quit
  only, no idle self-exit — and, per ADR-019, correctly filed as
  Enterprise-scope work rather than MVP work.
- **LLM model selection:** deliberately deferred as an independent
  evaluation task with no bearing on any other stack element; a five-model
  candidate shortlist is recorded separately in
  `docs/specs/llm-evaluation-candidates.md` as the starting point for that
  future evaluation.
- **MVP scope boundary:** finalized and Approved as **ADR-019**, consolidating
  every MVP-scope decision above (and resolving the Desktop Mode scope
  question this document's own analysis surfaced) into one authoritative
  record.
- **CI/CD provider:** finalized and Approved as **ADR-021** — GitHub Actions
  confirmed sufficient for this project's specific gate-enforcement
  requirements (HLD §11.3/§11.10), via required status checks, scripted
  commit-diff inspection, and structured test-result ingestion. The
  gate-enforcement scripts themselves remain real, separate follow-up
  engineering work, tracked outside this document.

MAG-24's acceptance criteria — a technology matrix with version pins and
rationale, identified bottlenecks with mitigations, and an approved spec — are
met. Recommended next steps, all outside this document's scope: build the
CI/CD gate-enforcement pipeline itself (ADR-021), and hand
`docs/specs/llm-evaluation-candidates.md` off as the starting point for the
separate LLM evaluation task.
