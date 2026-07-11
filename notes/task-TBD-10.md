---
created: 2026-07-10T21:20:23+01:00
modified: 2026-07-10T21:20:26+01:00
---

# Task TBD-10: Backup & Disaster Recovery

## Summary
Define backup frequency/retention and the recovery procedure for EFS, which holds all per-user workspaces and Git
repositories — the system's actual product data.

## Context
No section currently covers backup or disaster recovery, despite EFS being the sole store of user workspace and
Git repo data across both the enterprise and MVP architectures.

## Scope
- Backup frequency and retention policy for EFS (e.g. AWS Backup schedule, snapshot retention window).
- Recovery procedure and expected recovery time if EFS data is lost or corrupted.
- Whether per-user Git repos need any recovery handling beyond the EFS-level backup (e.g. remote mirrors).
- A periodic test-restore process to confirm backups are actually usable.

## Related
- ADR-004 (Storage Tier Isolation).
- Target Production Architecture / MVP Production Architecture sections (EFS storage).

## Deliverable
Completed "Backup & Disaster Recovery" section in `architecture.md`.
