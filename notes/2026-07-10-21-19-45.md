---
created: 2026-07-10T21:19:45+01:00
modified: 2026-07-10T21:19:48+01:00
---

# Task TBD-08: Observability & Monitoring

## Summary
Define what is monitored across Magpie Weaver environments and how the architect checks system health day to day.

## Context
ADR-020 commits to OpenObserve for local observability, with its lifecycle owned by MagpieWeaverApp, but there is no
section describing what's actually monitored, where that data lives per environment, or how it's used operationally.

## Scope
- What is logged/measured/traced (e.g. TS Service errors, Bedrock call latency/failures, EFS/cache health, EC2
  scale-to-zero transitions).
- Where observability data lives in each environment (local via OpenObserve, test, production).
- How the architect reviews this day to day (dashboards, alerts, manual checks).
- Retention policy for logs/metrics.

## Related
- ADR-020 (OpenObserve for Local Observability, Lifecycle Owned by MagpieWeaverApp).
- Task TBD-09 (Cost Management) — likely shares underlying metrics/alerting infrastructure.

## Deliverable
Completed "Observability & Monitoring" section in `architecture.md`.
