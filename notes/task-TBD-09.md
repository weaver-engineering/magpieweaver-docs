---
created: 2026-07-10T21:20:03+01:00
modified: 2026-07-10T21:20:06+01:00
---

# Task TBD-09: Cost Management

## Summary
Define cost guardrails and alerting thresholds for Magpie Weaver's pay-per-use and scale-to-zero cloud components.

## Context
Bedrock is billed pay-per-use and EC2 is scale-to-zero in both the MVP and test architectures. Without active
monitoring, a solo-developed project can be surprised by usage spikes (e.g. runaway agent loop calling Bedrock
repeatedly, an instance failing to scale to zero).

## Scope
- Cost alert thresholds (e.g. AWS Budgets / Cost Explorer alerts) and who they notify.
- Guardrails against runaway Bedrock usage (e.g. per-session or per-day call caps).
- Confirmation that EC2 scale-to-zero is actually triggering as expected, and what to check if it isn't.
- A rough expected monthly cost baseline for the MVP (2-3 users) so deviations are noticeable.

## Related
- MVP Production Architecture / Test Architecture sections (Bedrock pay-per-use, EC2 scale-to-zero).
- Task TBD-08 (Observability & Monitoring) — likely shares alerting infrastructure.

## Deliverable
Completed "Cost Management" section in `architecture.md`.
