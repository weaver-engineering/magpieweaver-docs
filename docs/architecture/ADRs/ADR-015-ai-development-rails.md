# ADR-015 — Development Gate: System-Level Tests, Mechanical Enforcement, Squash-on-Merge (Approved)

**Decision:** Enforce the Spec → Test → Act gate (ADR-003) with system-level
(not component/function-level) tests, a mechanical pass/fail gate (new tests
must fail pre-implementation and pass post-implementation; old tests must
keep passing unless explicitly changed via a separately reviewed test
branch), diff-scoped coverage thresholds (~80–85% overall, 95%+ on
changed lines), and a linter targeting tests/code that check literal values
disconnected from natural component behavior. Spec/Test/Act commits stay
separate on the feature branch for review, then squash into a single commit
on merge to mainline. Per-task documentation (`task-<ref>.md`,
`task-<ref>-spec.md`) tracks gate state (Specified → Tested → Done)
independent of Git history.

**Key rationale:**
- With 100% agent-authored code, this gate is the primary correctness
  mechanism (there is no separate human line-by-line review layer), so its
  rigor is treated as worth the resulting velocity cost.
- System-level tests keep the test suite itself human-reviewable and tied
  directly to system requirements, preventing the agent from unilaterally
  redefining what a test verifies to suit an implementation.
- Mechanical (not judgment-based) fail/pass criteria remove reliance on the
  author eyeballing whether a test is "meaningful," which is a check that
  degrades under review fatigue.
- Squashing only at mainline merge (not before) keeps the in-review PR
  focused on gate-by-gate changes while still producing clean mainline
  history — a deliberate tradeoff of detailed agent/reviewer workflow
  forensics for a navigable long-term history, with the per-task doc files
  carrying that forensic record forward instead.
- Kiro is the intended IDE for native gate support; an independent CI-side
  check (rejecting PRs where Spec/Test/Act commits aren't cleanly separated)
  is required as a backstop, since IDE-level gating may be a workflow
  convention rather than a hard enforcement boundary.

**Consequence to note:** small changes that don't require altering existing
tests but still pass coverage checks may skip the full three-gate cycle;
detailed gate-by-gate commit history is not recoverable from mainline alone
once squashed, only from the (possibly non-persistent) feature branch or the
task doc files.