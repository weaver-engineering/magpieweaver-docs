**Status:** Approved

**Supersedes:** the earlier open/placeholder draft of this ADR.

**Related:** HLD §1a/§1b; `docs/specs/tech-stack.md`;
`docs/specs/mvp-scope-summary.md`; `docs/specs/llm-evaluation-candidates.md`;
ADR-013 (Native Mobile App as Primary Target); ADR-023 (Account PII Storage).

---

## Context

This HLD deliberately documents the full intended system — including
capabilities well beyond a first release — so that MVP-stage design and
implementation choices don't foreclose or require expensive rework of later
capabilities (HLD §1a). That intent was recorded as a placeholder in an
earlier draft of this ADR, with the specific boundary left open. A
substantial amount of MVP-scope design work has since been done (recorded in
`docs/specs/tech-stack.md` and consolidated in
`docs/specs/mvp-scope-summary.md`), providing enough grounding to finalize
the actual boundary and resolve the one open scope question that work
surfaced.

## Decision

**Component scope (reaffirming HLD §1a):** MVP covers only **MagpieEngine**,
**Weaver**, and **Scene Director**, operating on a single scene, with no
chronology (no branching/merging narrative time) and no cross-user
collaboration (no PR/merge flow — single author, effectively single-branch
operation). The **Job Execution Substrate** is in scope at the interface
level — Scene Director depends on it for every take (HLD §1b) — even though
the Async Job Execution System built on top of it is not.

**Client surface: Android only.** No iOS. **No Local Desktop Mode as a
shipped product surface** — this resolves the one open question flagged in
`docs/specs/mvp-scope-summary.md` §5/§6. The packaged tray-icon launcher
(`MagpieWeaverApp`) and its process-lifecycle design (HLD §11.1: explicit
quit only, no idle self-exit) are **Enterprise-scope work** — correctly
designed ahead of need per this project's stated build-the-whole-design,
ship-a-narrow-slice philosophy, but not required for MVP itself and not to
be built/shipped at this stage. This is distinct from the **Development
Architecture** used to build MVP itself (Architecture doc's Development
Architecture diagram) — a developer runs the TS Service and UI directly
(`pnpm dev` / `pnpm dev:ui`), with no Electron shell and no tray icon
involved at all. The two should not be conflated: Local Desktop Mode is a
deferred *product* surface; the Development Architecture is the *tooling*
used to build MVP, and exists regardless of Local Desktop Mode's scope.

**Infrastructure:** a single EC2 instance with an attached Elastic IP,
scaled to zero via a self-managed, heartbeat-based stop (not
request-activity-based) and a Lambda-Function-URL wake path — no ALB, no
ECS/Fargate task pooling (Enterprise-only). Storage is EFS (not EBS) from
MVP onward, using Elastic throughput and an Infrequent Access lifecycle
policy. Full rationale in `docs/specs/tech-stack.md` §4.1/§4.2.

**Authentication, authorization, and account data:** Google Sign-In
(stateless ID-token verification), `sub`-keyed EFS workspace authorization,
self-service onboarding bounded by a per-user EFS storage quota and a
manual `llmEnabled` gate on LLM spend specifically. Account PII handling is
recorded in its own ADR-023.

**LLM provider:** AWS Bedrock is the confirmed provider. The specific model
is explicitly **not** part of this scope boundary — model selection is an
independent evaluation task with no bearing on any other stack element,
tracked separately via `docs/specs/llm-evaluation-candidates.md`.

**Explicitly excluded from MVP** (reaffirming and consolidating HLD §1a):
- Multi-scene chronology, branching, and validation (§9)
- Multi-user collaboration, semantic merge, and conflict resolution (§7.3,
  ADR-009)
- The scale-*up* side of the cost-scaling model (§12.5, ADR-016) — the
  scale-to-*zero* side is in MVP scope; there is nothing to scale up to yet
- LLM request queuing/tiered prioritization (§12.8)
- The Mobile app's push-notification walk-away model (§5.3, ADR-013) —
  though the Job Execution Substrate it will eventually run on is in scope
  now, per the component-scope decision above
- **Local Desktop Mode as a shipped surface**, including its process
  lifecycle (HLD §11.1) — newly reaffirmed by this ADR, resolving the
  scope tension `docs/specs/mvp-scope-summary.md` flagged
- iOS

**Explicitly not part of this scope boundary** (tracked elsewhere,
deliberately excluded from this ADR so they aren't mistaken for MVP-scope
questions): the CI/CD provider (ADR-021) and the specific Bedrock model
choice are project-wide/cross-cutting decisions orthogonal to what MVP
includes as a feature or surface set.

## Consequences

**Positive:**
- A genuinely narrow, buildable slice, with every exclusion tied to a
  documented reason and — per HLD §1a's stated design philosophy — a clear
  path back in later without architectural rework.
- Infrastructure and auth choices are sized to actual expected MVP usage
  (a single sporadic user) while remaining promotable to Enterprise without
  data loss (EFS chosen specifically to avoid a storage migration at
  promotion; see `docs/specs/tech-stack.md` §4.2).
- The Local Desktop Mode scope tension is resolved rather than left
  ambiguous — the HLD §11.1 design work isn't wasted, it's correctly filed
  as Enterprise-scope work done ahead of need.

**Negative / accepted:**
- Promotion from MVP to Enterprise remains a genuine migration (compute
  model, auth/session shape, and now Local Desktop Mode all change
  together), not a config flip — already tracked as an accepted cost in
  `docs/specs/tech-stack.md` §4.1's "Promotion path."
- The manual `llmEnabled` gate and hand-tuned idle thresholds are explicitly
  MVP-scale mechanisms, not designed to survive a materially larger user
  base unchanged (ADR-023).
- Sub-items intentionally left open by this ADR, tracked elsewhere rather
  than here: the CI/CD provider (ADR-021), the specific Bedrock model
  (`docs/specs/llm-evaluation-candidates.md`), and account-PII encryption
  key rotation (ADR-023).
