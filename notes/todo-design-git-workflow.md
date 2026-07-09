---
created: 2026-07-05T16:48:42+01:00
modified: 2026-07-05T16:49:46+01:00
---

# task-design-git-workflow

# Design: Simplified Git Workflow UX for Non-Engineer Authors

## Summary
Define a deliberately simplified, strictly enforced Git workflow to expose
to authors, who are not software engineers. The full flexibility of the Git
CLI/API (arbitrary branching, rebasing, merge strategies, etc.) must not be
exposed directly — the app needs its own constrained vocabulary and set of
allowed operations layered over Git.

## Background
Several already-resolved architectural decisions depend on Git operations
happening in specific, predictable ways:
- Every author works on their own branch; multi-device use by the same
  author shares that branch (magpie-weaver-hld.md §7, §12.5).
- Background jobs (headless regeneration, prose correction, chronology/
  entity validation) each write to their own isolated branch until a PR is
  raised (§10.2).
- Cache invalidation is tied to specific Git operations: `commit` via the
  app's own write path needs no invalidation; `merge`/`rebase` must evict the
  cache of the branch being merged/rebased into, scoped to that branch only,
  non-cascading (§12.5, ADR-016).
- Conflict resolution, index rematerialization, and rebase onto a
  destination branch must be a single transactional unit (§12.5, ADR-016).

None of this works safely if authors can freely perform arbitrary Git
operations outside of what the app anticipates and manages.

## Goals
- Enumerate the complete, minimal set of Git-backed actions an author (or a
  background job) is ever allowed to perform (e.g.: save/publish, request
  review/PR, accept PR, resolve conflict, discard local changes).
- Define the UI vocabulary for each (author-facing terms, not Git jargon —
  no "rebase," "force push," "detached HEAD," etc. surfaced to the author).
- Map each allowed action to its underlying Git operation(s) and confirm
  which trigger cache eviction per the rules already defined in ADR-016.
- Explicitly enumerate what is *not* exposed (e.g. arbitrary branch creation/
  deletion, interactive rebase, manual merge strategy selection, direct
  history rewriting) and how the app prevents or hides those paths.
- Define failure/edge-case UX: what an author sees when a conflict can't be
  auto-resolved, when a PR is rejected, when a background job's branch needs
  cleanup, etc.

## Non-Goals
- Not defining new conflict-resolution logic — that's already specified
  (semantic JSON merge, priority rules, LLM-assist for descriptive fields;
  see ADR-009).
- Not revisiting the branch-per-user / branch-per-job model itself — that's
  settled (ADR-006, ADR-014).

## Open Questions to Resolve in This Task
- What is the author-facing name/metaphor for a "branch" (if it's surfaced
  at all), a "PR," and a "merge conflict"?
- Does the author ever see or need to understand that Git is involved, or
  is it fully invisible behind app-specific actions and states?
- How are background-job branches (headless regen, prose correction,
  validation) surfaced differently from the author's own working branch?

## References
- Magpie Weaver HLD, §7 (Editing Modes), §10 (Scene Execution Model), §12.5
  (Cloud Hosting Cost Model), §12.6a (this item)
- ADR-006 (Per-User Git Workspaces), ADR-009 (Semantic JSON Merge), ADR-014
  (Dual Execution Model), ADR-016 (Scale-to-Zero Cache Model)

## Labels
`design`, `architecture`, `ux`, `git`
