# ADR-006 — Multi-User Collaboration via Per-User Git Workspaces (Approved)

**Decision:** Host each Enterprise Cloud user in their own cloud workspace
running Git natively. Multi-user collaboration on a shared project is
achieved through ordinary Git push/pull and pull-request flow between user
workspaces and the project's mainline repo, rather than shared runtime state
or a live multi-user session model.

**Key rationale:**
- Eliminates cross-user runtime contention entirely — each author edits a
  private workspace/cache, so no locking or live conflict handling is needed
  during normal editing.
- Conflicts only ever surface at PR/merge time, which is a well-understood,
  reviewable checkpoint rather than a live-editing hazard.
- Reuses Git's native branching/merge machinery instead of building a bespoke
  multi-user document-collaboration engine.

**Consequence to note:** collaboration latency is PR-cycle latency, not
real-time — two authors will not see each other's in-progress edits until a
PR is raised and merged. Infrastructure must support one workspace per user
rather than one shared backend (see ADR-013 and HLD §12.5 for the resulting
cost/idle-suspend question).