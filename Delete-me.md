I can’t copy to your clipboard directly, but here it is as plain text for one-click copy:

```text
Define and document the guardrails that keep AI-agent-authored changes to the Magpie Weaver code base controlled and aligned with the agreed design.

The architecture doc's introduction states it "documents the guardrails to keep changes to the code base controlled and delivering changes in line with the agreed design," but the Guard Rails section itself is currently a placeholder.

This is foundational to the 100% AI-authored development approach described under "Development Approach" and "Development Cycle."

Scope:
- What mechanical checks (linting, type-checking, test coverage thresholds, etc.) run automatically before an agent's changes can progress a task phase.
- What the agent is and is not permitted to change in each development phase (this is partly covered already under Development Cycle — this section should consolidate and formalize it).
- How violations are surfaced to the architect.

Related:
- Development Cycle section (phase-scoped change permissions).
- ADR-015 (Development Gate: System-Level Tests, Mechanical Enforcement, Squash-on-Merge).
- ADR-022 (Structured PII Linter).

Deliverable:
Completed "Guard Rails" section in architecture.md.
```

If you want, I can also give you a shorter shareable summary version.