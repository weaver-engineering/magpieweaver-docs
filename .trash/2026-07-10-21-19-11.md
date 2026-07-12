---
created: 2026-07-10T21:19:11+01:00
modified: 2026-07-10T21:19:14+01:00
---

# Task TBD-06: Rollback / Incident Response

## Summary
Define what happens when a `deploy-prod` sanity test fails after a change has already been merged to mainline and
deployed to production.

## Context
The Development Cycle section defines forward gates (`deploy-test` UAT, `deploy-prod` sanity test) but is currently
silent on the failure path once mainline has already absorbed the squashed commit. This gap matters more given the
project is solo-developed — there's no second person to catch or handle an incident.

## Scope
- Rollback procedure: how to revert production to the last known-good state (e.g. redeploy previous EC2/Bedrock
  config, revert mainline commit).
- Whether/how the task returns to an earlier phase (per the phase-revert rule already defined) or is handled as a
  separate incident outside the normal task lifecycle.
- Any immediate mitigations (e.g. scale-to-zero EC2 instance, disable a feature) available before a full rollback.

## Blocked by
- Task TBD-05 (Deployment / CI/CD Pipeline) — rollback mechanics depend on the chosen CI/CD provider and pipeline
  design.

## Related
- Development Cycle section (deploy-test/deploy-prod, phase reverts).

## Deliverable
Completed "Rollback / Incident Response" section in `architecture.md`.
