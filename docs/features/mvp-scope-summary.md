# MVP Scope: Detailed Working Record (Closed)

**Status: Closed.** Every decision below is finalized. This document served
as the source material for **ADR-019 (MVP Scope Boundary)**, which is now
Approved and is the authoritative record — this document remains as the
detailed working history behind that ADR's more condensed decision, not as
a tracker of anything still pending. The one substantive open question this
document originally surfaced (§5's Desktop scope tension) is resolved,
along with everything else recorded here.

**Baseline already established (HLD §1a, pre-dating this conversation):**
MVP covers only MagpieEngine, Weaver, and Scene Director, operating on a
single scene, with no chronology (no branching/merging narrative time) and
no cross-user collaboration (no PR/merge flow, single author/single-branch
operation). Android is the only client surface (Architecture doc's MVP
note) — no iOS, no Desktop shipped to end users. Everything below either
elaborates that baseline or was decided fresh in this conversation.

---

## 1. Compute & Scale-to-Zero

- **Single EC2 instance**, not Fargate — no ALB, no container requirement.
  Chosen over Fargate specifically because Fargate has no true zero-cost
  idle state without extra plumbing (Lambda-fronted wake, still non-trivial)
  and because "fixed IP, no load balancer" is native to EC2 (Elastic IP) but
  requires extra infrastructure to fake on Fargate.
- **Fixed address:** an Elastic IP attached directly to the instance,
  persists across stop/start.
- **Stop mechanism:** self-managed by the TS Service, based on a
  **last-heartbeat timestamp** (not request-count, and not a counting
  semaphore). Trip sources: new client session, and periodic heartbeats from
  any in-progress long-running job (Scene Director take, async job) — this
  is a real requirement on the **Job Execution Substrate**, recorded
  separately in `docs/specs/notes/job-execution-substrate-heartbeat-note.md`.
  A watchdog stops the instance when the timestamp goes stale past a tuned
  threshold.
- **Wake mechanism:** client attempts a direct connection first; only on
  failure does it call a Lambda (behind a Function URL, not API Gateway) to
  check state and trigger `StartInstances`. The Lambda is invoked roughly
  once per idle-stop→wake boundary, not per session.
- **Cold start is accepted, not engineered away** — appropriate given a
  single sporadic user, and explicitly *not* appropriate to carry forward
  once real concurrent usage exists (Enterprise scale uses Fargate pooling
  instead, a genuinely different shape — promotion is an acknowledged real
  migration, not a config flip).

## 2. Storage

- **EFS, not EBS, even at MVP** — despite a single instance having no use
  for EFS's multi-host access. Justified by avoiding a data-migration step
  at promotion (only compute changes at that point, not where data lives),
  not by cost — the EBS/EFS cost delta is genuinely trivial at MVP's data
  volume.
- **Elastic throughput mode** (pay-per-use, no capacity planning) and an
  **Infrequent Access lifecycle policy** — both chosen to match sporadic
  usage.
- **No NAT Gateway required** — EFS mount targets don't force a private
  subnet; a public subnet with a tight security group is sufficient and
  avoids that fixed cost.

## 3. Authentication, Authorization & Onboarding

- **Authentication:** Google Sign-In (OAuth ID token), verified via
  `google-auth-library`. Stateless, per-request — no Cognito, no DynamoDB,
  no session store. Same verification logic reused by the TS Service and
  the wake-path Lambda.
- **Authorization:** the token's `sub` claim (never email — email can
  change/be reassigned) is checked against EFS for a matching workspace
  directory. Reuses the existing per-user workspace model rather than a
  second mechanism.
- **Onboarding is self-service:** a `sub` with no workspace is walked
  through Terms & Conditions acceptance, then workspace creation. This
  corrected an earlier, wrong assumption in this same conversation that
  onboarding would be hand-provisioned — worth remembering that correction
  happened, since it changes the access-control picture. Storage and LLM
  cost exposure from unrestricted self-service creation are bounded
  separately — see §6.
- **Wake-path access control:** the Lambda requires **both** a valid Google
  ID token **and** a shared secret bundled in the client — a narrow gate
  against blind/automated discovery, explicitly *not* the data-access
  boundary. Residual risk (a targeted actor who extracts the secret can
  still wake the instance) is accepted; mitigated by a billing alarm, not a
  `sub`-allowlist on the Lambda.

## 4. Account PII

- **The only place Magpie Weaver stores PII:** `user.json` per workspace —
  `firstName`, `lastName`, `emailAddress`, each encrypted at rest, plus a
  `termsAndConditions` consent record (`accepted`, the accepting session's
  OAuth token, an `acceptedAt` timestamp, and the T&C version). Also carries
  `llmEnabled` (boolean, not PII) — the manual operator-controlled gate on
  LLM access described in §6; defaults to `false`/absent for a newly
  self-onboarded workspace.
- **Encryption key** sourced from SSM Parameter Store (`SecureString`) at
  instance boot — never in plaintext outside the running process's memory.
- **`user.json` is confirmed not Git-tracked** — held outside the Git
  working tree on EFS, which means the right-to-erasure gap already flagged
  for narrative content (HLD §11.11) does not apply to this account PII;
  deleting the file is a real, complete erasure.
- Distinct in kind from ADR-022's narrative-content PII lint (a character's
  email appearing in prose) — different threat model, deliberately kept
  conceptually separate.

## 5. Desktop Backend Process Lifecycle

- Resolved as: explicit tray-icon quit only, **no idle-timeout self-exit**
  locally — rejected as confusing UX (a tray icon that quits itself with no
  clear user-visible cause) and actively bad for local development (an
  unpredictable self-exit mid-debug session).
- **Scope tension — resolved by ADR-019.** This design work is for the
  **Local Desktop Mode** client surface, which ADR-019 confirms is *not*
  shipped at MVP (deferred to Enterprise, per the Architecture doc's
  Android-only MVP note). It was done ahead of when it's actually needed —
  not wasted, since the design is sound and will be needed at Enterprise
  scale, but correctly filed as Enterprise-scope work rather than MVP work.
  Local development during MVP build-out uses the separate Development
  Architecture (`pnpm dev`/`pnpm dev:ui` directly), which doesn't involve
  the tray-icon launcher at all — so this resolution doesn't affect how MVP
  itself gets built.

## 6. Items Surfaced While Compiling This Summary (Both Resolved)

- **Self-service onboarding ceiling — resolved.** Two separate, independent
  controls, matched to the two different things at risk:
  - **Storage (workspace creation itself):** bounded by an EFS usage quota
    per user (a fixed cap for MVP; tiered quotas are a natural later
    extension once there's a reason to differentiate users). Any Google
    account holder can still self-onboard and create a workspace, but the
    blast radius is capped storage, not unbounded storage.
  - **LLM spend (the actually expensive risk):** gated separately by a
    manual `llmEnabled: true` field in `user.json`, defaulted to `false` (or
    absent) on self-service creation. A newly self-onboarded workspace exists
    but cannot trigger LLM calls until the operator manually flips this flag
    for that user — a deliberate, manual, per-user switch, appropriate for
    MVP's actual user count. This decouples "anyone can create a workspace"
    (acceptable, now bounded) from "anyone can cost money" (not acceptable,
    now requires explicit operator action).
  - This means the wake-path shared secret (§3) and the EFS quota/`llmEnabled`
    gate are doing different jobs at different layers, not redundant: the
    secret protects against blind automated wake-triggering; the quota
    protects storage; `llmEnabled` protects the LLM cost surface specifically.
- **Desktop scope tension — resolved.** See §5 above; ADR-019 confirms
  Local Desktop Mode is Enterprise-scope, not MVP.

## 7. Explicitly Deferred, Not MVP

- **LLM model selection** — critical, but independent of every other stack
  element; a dedicated evaluation task, out of scope for project
  initialisation. Candidate shortlist recorded separately in
  `docs/specs/llm-evaluation-candidates.md`.
- **Account-PII design now has its own ADR** — resolved: recorded as
  ADR-023, added to the Architecture doc's ADR table.
- Everything HLD §1a already excludes: multi-scene chronology/branching,
  multi-user collaboration/merge, the cache scale-up (only scale-to-zero is
  MVP), LLM request queuing/tiering, and the mobile push-notification
  walk-away model (though the underlying Job Execution Substrate it will
  eventually run on is in scope now, per HLD §1b).

**Not included above:** the CI/CD provider question was tracked separately
as ADR-021 (now also Approved) and deliberately isn't listed here — it was
always a project-wide tooling decision, orthogonal to what MVP includes or
excludes as a feature set, not an MVP-scope item, regardless of whether it
was open or resolved at the time this document was written.
