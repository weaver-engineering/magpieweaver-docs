---
created: 2026-07-06T12:57:46+01:00
modified: 2026-07-06T12:57:53+01:00
---

# Investigate: GitHub Actions Support for Development Gate Guardrails

## Summary
Validate whether GitHub Actions can adequately enforce the Spec → Test →
Act development gate guardrails (see ADR-015, ADR-021), and close out
ADR-021 as approved (or revise the CI provider choice) based on findings.

## Background
The gate relies on mechanical, CI-enforced checks — not developer/agent
judgment — because 100% of code is agent-authored and there's no separate
human line-by-line review layer (ADR-015). Running these checks as a local
script was explicitly rejected: it shares a trust boundary with the agent
doing the work, so nothing would stop a commit from skipping the check.
GitHub Actions was chosen as the likely provider (ADR-021), but its
suitability for these *specific* checks — not just "does GitHub Actions
exist and run scripts" — has not been confirmed.

## What to Investigate
- Can a GitHub Actions workflow inspect a PR's individual commits (not just
  the final diff) to verify Spec/Test/Act commits are cleanly separated —
  i.e., that a commit tagged as "spec" touches only `task-<ref>.md`/
  `task-<ref>-spec.md` and no code or test files, and similarly for "test"
  and "act" commits?
- Can a workflow verify the mechanical fail/pass sequence — that new tests
  fail against the pre-implementation commit and pass after, without
  requiring a bespoke test harness to be built from scratch?
- Does GitHub Actions' branch protection integration allow blocking merge
  on these specific custom checks (not just standard "tests pass")?
- What's the actual expected CI-minutes cost for this repo's real workflow
  frequency — confirm free-tier (2,000 min/month private repo) is
  sufficient, or self-hosted runners are a viable free/near-free fallback.
- Any limitation that would require a different or additional tool
  (e.g. a custom GitHub App, a bot account performing commit-level
  validation, or a different CI provider entirely).

## Outcome
- If GitHub Actions is confirmed sufficient: close this task, mark ADR-021
  as **Approved**.
- If not sufficient (or only partially): document the gap and propose a
  revision to ADR-021 (e.g. GitHub Actions plus a custom check, or a
  different provider).

## References
- ADR-015 (Development Gate: System-Level Tests, Mechanical Enforcement,
  Squash-on-Merge)
- ADR-021 (GitHub Actions as CI/CD Provider — open, pending this task)

## Labels
`investigation`, `ci-cd`, `architecture`
