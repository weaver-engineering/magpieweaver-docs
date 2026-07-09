# ADR-003 — Operational Separation via Task Modes (Approved)

**Decision:** Enforce a **Three-Phase Task Execution Gate** on every development
branch — Spec Mode → Test Mode → Act Mode — to prevent code-bleeding and scope
creep by the agent.

- **Spec Mode:** agent edits only `/docs/` to build a markdown blueprint.
  Gate: author reviews and merges the spec.
- **Test Mode:** agent edits only test files (`*.test.ts`) to write a
  comprehensive suite of *failing* tests that trap the approved spec's
  behaviours. Gate: author verifies tests fail for the correct reasons.
- **Act Mode:** agent edits `/apps/` or `/packages/` to write the minimal
  production code that makes the test suite green. Gate: author reviews and
  squash-merges.

**Key rationale:**
- Dividing work into modes prevents the agent from trying to fix a bug while
  simultaneously defining requirements for that fix (AI thrashing).
- Mandatory Test Mode forces tests to be written against the spec, not against
  a flawed implementation — the agent cannot shortcut the test suite in Act
  Mode.
- Three small review gates are less cognitively taxing for the author than one
  massive mixed PR.

**Consequence to note:** author participates in three review gates per task
rather than one.