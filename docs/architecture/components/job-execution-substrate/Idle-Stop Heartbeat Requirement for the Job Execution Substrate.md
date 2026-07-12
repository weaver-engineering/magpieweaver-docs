# Note: Idle-Stop Heartbeat Requirement for the Job Execution Substrate

**Origin:** Surfaced while resolving the MVP scale-to-zero mechanism in
`docs/specs/tech-stack.md` §4.1. Extracted here as its own note so it can
feed directly into the Job Execution Substrate design task, rather than
staying buried in an unrelated document.

**Status:** Requirement input, not a finished spec. The Job Execution
Substrate design task should work out the concrete implementation — this
note fixes *why* the requirement exists and *what shape* it needs to take,
not the exact API.

---

## 1. The problem this note exists to prevent

MVP's cost model depends on the host being able to stop itself when genuinely
idle (`docs/specs/tech-stack.md` §4.1) — that's the entire basis for keeping
AWS spend near-zero for sporadic, single-user usage. The naive way to detect
"idle" is watching incoming HTTP request activity: if no requests have
arrived in N minutes, stop.

That naive approach is **wrong** given how this system actually works, and
would actively break it:

- A Scene Director take can run for an extended period with the client
  disconected — HLD §9.1 states plainly that "the author can walk away or
  the client can drop; the end result is the same either way." Zero HTTP
  requests arriving during that stretch says nothing about whether the host
  is safe to stop.
- Async background jobs (HLD §10.2 — headless regeneration, direct prose
  correction) are explicitly designed to be client-connection-independent.
  They may run long after the client that triggered them has disconnected
  entirely.
- A single SceneEvent's LLM call, or a job's retry-with-backoff cycle, can
  itself last longer than a naive idle window, even while the job is
  actively, correctly working.

A request-idle-only timer would stop the host mid-generation or mid-job —
the same "quiet but alive, misread as dead" failure mode already identified
for Fargate health checks at Enterprise scale (tech-stack.md §7), just
showing up here via self-managed EC2 logic instead of an ECS health check.

## 2. The resolved design: heartbeat, not request-count

Two trip sources keep a **last-activity timestamp** fresh:

1. A new client session/connection being established.
2. A **short, fixed-interval heartbeat emitted by any in-progress
   long-running job** — a Scene Director take, or an async background job.

A lightweight watchdog on the host checks `now − lastHeartbeat >
idleThreshold`; when true, it calls `ec2:StopInstances` on itself.

**Why a heartbeat/timestamp, specifically, rather than a counting semaphore
(increment on job start, decrement on completion):** a counting semaphore
has a leak failure mode — if a job crashes or the process dies mid-task
without executing its decrement/release step, the count never returns to
zero, and the host would never stop again: silent, ongoing cost with nothing
to surface the problem. A last-heartbeat timestamp self-heals instead: a
dead job's heartbeats simply stop arriving, the timestamp ages out on its
own, and the watchdog resumes normal idle detection with no explicit cleanup
path required at all.

## 3. What this means for the Job Execution Substrate's design specifically

This lands on the Job Execution Substrate (not Scene Director or Weaver
individually) because HLD §1b already establishes it as the shared,
low-level durability layer both Scene Director takes and async background
jobs sit on top of — "a take is really just a job that happens to have a
live chat session attached" (§10.1). Heartbeat emission belongs at this
shared layer for the same reason the checkpoint/resume logic does: so every
kind of long-running work gets it uniformly, rather than Scene Director and
the Async Job Execution System each reinventing it slightly differently.

Concretely, the substrate design should account for:

- **Heartbeat interval** shorter than the planned idle-stop threshold by a
  comfortable margin — needs to be picked together with (or before) the
  idle-threshold tuning called out in tech-stack.md §7, since the two values
  are coupled (too sparse a heartbeat relative to the threshold reintroduces
  the exact false-idle risk this design exists to avoid).
- **Where the heartbeat write actually lands.** The substrate already tracks
  event-level checkpoint/resume state (§10.1) — the natural home for the
  heartbeat is likely alongside that existing liveness tracking, rather than
  a new, separate mechanism. Worth confirming explicitly whether the
  heartbeat *is* the checkpoint-write itself (i.e., every checkpoint
  incidentally refreshes liveness) or a distinct, more frequent signal
  alongside it — a single SceneEvent's LLM call may take longer than the
  desired heartbeat interval even though checkpoints only land at
  event boundaries, so these may need to be two different frequencies, not
  one.
- **Continuity-lint circuit breaker interaction (§9.2):** when a job trips
  its retry/time-per-event circuit breaker and fails gracefully, heartbeat
  emission should stop cleanly at that point (the job is no longer
  "in-progress" in the sense that matters for idle-stop) — the substrate's
  breaker-trip path and its heartbeat-stop path should be the same event,
  not two things that could drift out of sync.
- **Multi-job case:** if the substrate ever supports more than one
  concurrent job on the same host (not true at MVP's single-user scale, but
  worth not architecturally foreclosing), the heartbeat should be "any job
  is alive," not per-job — a single shared last-activity timestamp, refreshed
  by whichever job is most recently active, not one timestamp per job that
  the watchdog would need to aggregate.
- **Scope boundary:** this note only covers the *signal* (heartbeat) the
  substrate needs to emit. The watchdog/timer that consumes it and calls
  `StopInstances` is host-level infrastructure (tech-stack.md §4.1), not
  part of the substrate's own responsibility — worth keeping that line
  clear so the substrate's design doesn't take on EC2-lifecycle concerns
  that belong elsewhere.

## 4. Non-goals of this note

This note isn't proposing a specific heartbeat transport (in-process
timestamp update vs. a written record vs. something else) or a specific
interval value — both are implementation decisions for the Job Execution
Substrate design doc to make. It's recording why the requirement exists and
the constraints it needs to satisfy, so the substrate's design doesn't have
to rediscover the request-idle failure mode independently, and so the
heartbeat is designed in from the start rather than retrofitted after an
avoidable mid-take shutdown is found in testing.
