# ADR-002 — Repository Layout Strategy (Approved)

**Decision:** House all application code, infrastructure-as-code, and markdown
specifications in a **single pnpm monorepo** under one Git tracking tree.

**Key rationale:**
- An AI agent's context window cannot span multiple repositories without
  thrashing; collocating specs in `/docs` alongside code keeps the agent's view
  of the blueprint un-degraded.
- A single branch contains the complete evolution of a feature: spec
  modification + failing tests + production code, reviewable as one atomic
  package.
- A single `.git` tree prevents concurrent file locks that can leave agents in
  a detached-HEAD state.
- Internal packages (e.g. `/packages/filestore`) link to app targets
  (`/apps/desktop`) via pnpm workspace protocols without publishing to private
  registries.

**Consequence to note:** code refactors and planning text modifications mingle
in the commit history.