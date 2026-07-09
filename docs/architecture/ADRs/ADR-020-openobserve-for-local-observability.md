# ADR-020 — OpenObserve for Local Observability, Lifecycle Owned by MagpieWeaverApp (Approved)

**Decision:** Use **OpenObserve** (single-binary, self-hosted, open source)
as the local-deployment observability tool, covering both general
backend/API metrics and Weaver/MagpieEngine LLM-call traces in one process.
Its lifecycle is managed by `MagpieWeaverApp` (ADR-012) identically to the
local backend — started alongside it, stopped when the app is quit via the
tray icon. Enterprise Cloud continues to use AWS CloudWatch (or equivalent
managed tooling); this decision covers Local Desktop only.

**Key rationale:**
- Local Desktop has no managed-cloud observability equivalent, and whatever
  fills that gap has to respect the same tight resource budget as the rest
  of the local stack (backend, frontend, LLM) — ruling out heavier
  multi-container options (e.g. Langfuse's full self-hosted stack: Postgres,
  ClickHouse, Redis, web, worker) in favor of a single lightweight binary.
- Covering both general infra metrics and LLM-specific traces in one tool
  avoids running a separate stack for each (e.g. Prometheus/Grafana/Loki
  alongside a dedicated LLM observability tool), which matters more locally
  than in a resource-elastic cloud environment.
- Tying OpenObserve's lifecycle to `MagpieWeaverApp` keeps local process
  lifecycle ownership singular (ADR-012's principle: `MagpieWeaverApp` is the
  one platform-dependent, lifecycle-owning component) rather than
  introducing a second independently-managed local service the author would
  need to start/stop separately.

**Consequence to note:** OpenObserve's specific dashboard/metric definitions
(what's tracked for LLM calls, continuity-lint pass/fail, circuit-breaker
trips) are not yet specified — the tool choice is locked, the exact metrics
schema is not (see HLD §12.9).