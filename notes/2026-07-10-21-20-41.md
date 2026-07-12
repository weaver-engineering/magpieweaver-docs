---
created: 2026-07-10T21:20:41+01:00
modified: 2026-07-10T21:20:44+01:00
---

# Task TBD-11: Branching Strategies

## Summary
Define the branching strategy used across the Magpie Weaver code and documentation repositories.

## Context
The Repositories section states all changes must be tied to a Linear task via commit message, and that the three
Development Cycle commits (specification/test/build) are squashed into one before merging to mainline — but the
underlying branching model itself (e.g. one branch per task, naming convention, when branches are cut/deleted) is
not yet defined.

## Scope
- Branch naming convention, tied to `task-<REF>`.
- Branch lifecycle: created at `specification` phase start, merged and deleted at `deploy-test` pass (or wherever
  the squash-on-merge step occurs).
- Whether the documentation repository follows the same model as the code repository.

## Related
- Repositories section.
- Development Cycle section (squash-on-merge).
- ADR-002 (Repository Layout Strategy).
- ADR-015 (Development Gate: System-Level Tests, Mechanical Enforcement, Squash-on-Merge).

## Deliverable
Completed "Branching Strategies" section in `architecture.md`.
