---
created: 2026-07-10T21:18:12+01:00
modified: 2026-07-10T21:18:15+01:00
---

# Task TBD-03: Security & Secrets Management

## Summary
Document how credentials and sensitive data are protected across all Magpie Weaver environments.

## Context
No section currently covers security or secrets handling, despite the system holding Bedrock API credentials, Git
credentials for per-user workspaces, and user session data in cache. ADR-022 (Structured PII Linter) implies
sensitive data handling is already a live concern.

## Scope
- How Bedrock API credentials are stored and rotated, per environment (local/test/production).
- How Git credentials for per-user workspaces are issued, stored, and scoped.
- What session data (cache: indexes, semaphores, etc.) is considered sensitive and how it's protected at rest and
  in transit.
- How ADR-022's PII linter fits into the overall security posture (what it catches vs. what still needs separate
  controls).

## Related
- ADR-004 (Storage Tier Isolation).
- ADR-022 (Structured PII Linter: Hard Block with Audited Override).

## Deliverable
Completed "Security & Secrets Management" section in `architecture.md`.
