---
created: 2026-07-10T21:18:51+01:00
modified: 2026-07-10T21:18:54+01:00
---

# Task TBD-05: Deployment / CI/CD Pipeline

## Summary
Document the deployment process (CI/CD pipeline), the gates between pipeline stages, and the devOps infrastructure
behind it.

## Context
This section is currently a placeholder, and is blocked on ADR-021 (GitHub Actions as CI/CD Provider), which is open
pending investigation. This task should not be started in earnest until ADR-021 is resolved.

## Scope
- Pipeline stages, mapped onto the `deploy-test` / `deploy-prod` subphases already defined under Development Cycle.
- Gate conditions between stages (what must pass for a change to progress).
- CI/CD infrastructure once the provider is decided (ADR-021).
- How the squash-on-merge step (specification/test/build commits → single commit) is enforced in the pipeline.

## Blocked by
- ADR-021 (GitHub Actions as CI/CD Provider) — open, pending investigation.

## Related
- Development Cycle section (deploy-test/deploy-prod subphases).
- ADR-015 (Development Gate: System-Level Tests, Mechanical Enforcement, Squash-on-Merge).
- Task TBD-06 (Rollback / Incident Response) — depends on this pipeline being defined.

## Deliverable
Completed "Deployment / CI/CD Pipeline" section in `architecture.md`.
