---
created: 2026-07-10T21:19:26+01:00
modified: 2026-07-10T21:19:29+01:00
---

# Task TBD-07: OpenCode Configuration

## Summary
Specify the configuration of the OpenCode Agentic AI IDE used to keep the agent working efficiently within the
confines of the development cycle phase.

## Context
The architecture doc's introduction commits to this ("It specifies the configuration of the OpenCode Agentic AI
IDE..."), but the section is currently a placeholder.

## Scope
- OpenCode configuration needed to enforce phase-scoped change permissions (e.g. agent can only touch test packages
  during the `test` phase).
- Any project-specific rules/prompts/tooling configured for the agent.
- How this configuration is kept in sync with the Development Cycle and Guard Rails sections.

## Related
- Development Cycle section.
- Task TBD-02 (Guard Rails).

## Deliverable
Completed "OpenCode Configuration" section in `architecture.md`.
