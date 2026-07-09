# ADR-021 — GitHub Actions as CI/CD Provider (Open — pending investigation)

**Decision (draft, not fully approved):** Use GitHub Actions to enforce the
development gate guardrails (§12.3/ADR-015) — mechanical checks that no
code/test changes accompany a spec commit, no spec/code changes accompany a
test commit, new tests fail against pre-implementation code, etc. Running
these checks locally (a script executed by the same machine/trust boundary
as the agent doing the work) was explicitly rejected: it undermines the
purpose of an independent gate, since nothing would stop a commit from
skipping the check entirely.

**Key rationale:**
- GitHub Actions integrates directly with branch protection rules, making
  gate-passage an actual merge precondition rather than an optional script
  the developer/agent could bypass.
- Cost, initially assumed to be a blocker for a single-developer setup, is
  likely a non-issue in practice (2,000 free CI minutes/month on private
  repos, unlimited on public repos, and self-hosted runners are also free to
  register and run) — but this has not been verified against the actual
  gate-check workload.

**Status:** Open, pending investigation. Whether GitHub Actions' feature set
adequately supports the specific gate checks required (commit-level diff
inspection across Spec/Test/Act commits, enforcing test-fail-then-pass
ordering, etc.) has not been confirmed. Tracked as an external investigation
task (see companion task file) to validate feasibility and close this ADR
out as approved or revise the approach.