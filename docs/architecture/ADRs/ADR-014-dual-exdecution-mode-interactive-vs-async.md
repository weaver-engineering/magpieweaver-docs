# ADR-014 — Dual Execution Model: Interactive Sessions vs. Isolated Async Jobs (Approved)

**Decision:** Support two distinct execution models — interactive scene
direction (live chat/control session with autonomous actor execution once
`[Action]` is given) and asynchronous background jobs (headless scene
regeneration, direct prose correction, and non-LLM project validation) —
both durable independent of client connection, both checkpointed at
scene-event granularity, and both isolated to their own Git branch until a
PR is raised.

**Key rationale:**
- Once `[Action]` is given, actor execution is autonomous by design — walking
  away must produce the same result as staying connected, which requires the
  same server-side durability whether or not a client is present, so
  interactive sessions and background jobs share one durability model rather
  than needing two.
- Branch isolation is what allows job-death handling to stay simple: because
  a background job's writes are confined to its own branch until a PR is
  raised, the author only ever needs to be notified of an end state (PR
  raised, or direction sought) — no rollback logic is required regardless of
  why or when a job fails.
- A bounded circuit breaker (configurable retry count and max time per scene
  event) on continuity-lint failures prevents an agent from looping
  indefinitely on a stuck scene, instead persisting in-progress state and
  asking the author for direction.
- Async jobs are queued (SQS in Enterprise Cloud; an equivalent
  filesystem-persisted queue locally) rather than fire-and-forget, giving
  jobs explicit state (queued/running/failed/awaiting-review) that survives
  independent of any client connection — required for the mobile walk-away
  use case (ADR-013).

**Consequence to note:** headless replay is expected to produce prose that
differs from the original take (non-deterministic generation is the point of
replay), so completed background-job PRs must flag to the author that prose
may be substantially different, even though it remains within project
metadata bounds; review rigor for that difference is left to author
discretion.
