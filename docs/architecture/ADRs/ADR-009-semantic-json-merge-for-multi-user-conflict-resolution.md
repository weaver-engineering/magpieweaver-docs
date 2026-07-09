# ADR-009 — Semantic JSON Merge for Multi-User Conflict Resolution (Approved)

**Decision:** Resolve multi-user merge conflicts by parsing both branch
versions into JSON-Schema-validated entity instances and applying attribute
priority rules. Conflicts priority rules can't resolve are surfaced to the
repo owner via PR rejection back to the contributor, with app-assisted
resolution before resubmission. Descriptive/prose fields may use LLM-assisted
merging; fields tagged as canonical fact are resolved by explicit author
choice between versions, never blended.

**Key rationale:**
- Structured, schema-aware merging catches and resolves the common case
  (non-overlapping attribute changes) without requiring text-level diff/merge
  tooling meant for source code.
- Distinguishing descriptive fields (safe to blend, since meaning is
  naturally fuzzy) from canonical-fact fields (unsafe to blend, since a
  contradiction blended into fluent prose can silently produce a wrong but
  plausible-looking result) prevents the most likely failure mode of
  LLM-assisted merging.
- Routing unresolved conflicts through the repo owner mirrors a standard,
  well-understood PR review workflow, scoped down to non-developer authors.

**Consequence to note:** requires every entity attribute to be explicitly
tagged (descriptive vs. canonical-fact) as part of the schema design (see
HLD §12.7), and requires priority-rule configuration per attribute type.
