**Status:** Approved

**Supersedes:** the earlier "open, pending investigation" status of this
decision.

**Related:** HLD §11.3 (Three-Phase Task Execution Gate), HLD §11.10;
ADR-015 (Development Gate: System-Level Tests, Mechanical Enforcement,
Squash-on-Merge).

---

## Context

The CI/CD pipeline is where this project's development-gate guardrails
(ADR-015) are actually enforced: no code/test changes on a spec commit, no
spec/code changes on a test commit, new tests must fail against
pre-implementation code and pass after implementation, diff-scoped coverage
thresholds, detection of weak-but-passing tests, and squash-on-merge to
mainline. Running these checks as a local script was explicitly rejected —
it would share a trust boundary with the agent doing the work, undermining
the point of an independent gate.

GitHub Actions was the intended provider, but was recorded as open pending
investigation: whether it could actually enforce these *specific* checks
(commit-level diff inspection across Spec/Test/Act, the fail-then-pass test
ordering) had been assumed, not confirmed.

## Investigation

The relevant question turned out not to be "is GitHub Actions good enough,"
but "does any CI provider support this natively, and if not, does GitHub
Actions provide the primitives needed to build it." No mainstream CI
platform — GitHub Actions, GitLab CI, CircleCI, Jenkins — ships
"three-phase development gate enforcement" as a built-in feature; this
requirement is inherently bespoke pipeline logic on any platform. What
matters is whether the platform's primitives are sufficient to build it.

Checked against each requirement:

- **Commit-level diff inspection across Spec/Test/Act:** achievable with
  `git diff` between commits inside a workflow step. GitHub Actions runners
  have full repository/history access; this is standard scripting, not a
  platform-specific capability.
- **Fail-then-pass test ordering** (new tests must fail against
  pre-implementation code; old tests must remain green): requires running
  the test suite at the Test-commit stage, before the Build commit exists,
  and asserting that specifically the new test files fail while everything
  else passes. Achievable with a structured test reporter (e.g. Jest's
  JSON/JUnit output) plus a script asserting results against the Spec→Test
  diff. Not a GitHub Actions feature per se — standard scripting GitHub
  Actions can run like any other CI platform.
- **Branch protection making gate-passage an actual merge precondition:**
  this is a genuine, mature, native GitHub Actions feature — "required
  status checks" fits this need directly, without custom scripting.
- **Diff-scoped coverage thresholds** (~80–85% overall, 95%+ on
  changed/new lines): achievable with standard diff-coverage tooling layered
  over the test runner's coverage output; provider-agnostic, GitHub Actions
  simply runs it as a step.
- **The "unicorn linter"** (detecting tests built on literal-value checks
  disconnected from actual behaviour): custom static analysis the project
  needs to build regardless of CI provider — not a platform capability
  question at all.
- **Squash-on-merge:** a native GitHub repository feature (squash-and-merge
  strategy), not a CI-provider concern.
- **Manual pipeline override:** standard GitHub branch-protection setting
  (admin bypass of required status checks).

## Decision

**GitHub Actions is confirmed as the CI/CD provider.** Every requirement in
HLD §11.3/§11.10 is achievable using GitHub Actions' existing primitives
(arbitrary script execution, full git access, structured test-result
ingestion, required status checks, native squash-merge, admin override).
There is no comparative advantage to evaluating an alternative provider —
none of GitLab CI/CircleCI/Jenkins offer this gate model natively either,
and the repositories are already hosted on GitHub, making GitHub Actions the
path of least operational friction as well as a technically sufficient one.

**What this decision does not resolve:** the actual gate-enforcement
pipeline (the specific scripts implementing diff inspection, fail-then-pass
assertion, diff-coverage checks, and the unicorn linter) is real engineering
work that still needs to be built and maintained. This is true regardless of
which CI provider had been chosen, so it isn't a reason to delay confirming
the provider — but it should be tracked as its own follow-up implementation
task, not assumed to fall out of this decision for free.

## Consequences

**Positive:**
- Closes the last open item blocking `docs/specs/tech-stack.md`'s
  finalization.
- No new platform/vendor to onboard — same platform the repositories already
  live on.
- Confirms the development-gate model (ADR-015) is technically enforceable
  as designed, rather than resting on an unconfirmed assumption.

**Negative / accepted:**
- The gate-enforcement scripts themselves are unbuilt. This ADR confirms
  *feasibility*, not that the pipeline exists yet — a real, separate
  implementation task remains.
- Still TODO, unrelated to the provider question and not resolved by this
  ADR (HLD §11.10): mobile app store distribution/review process, and the
  cloud/infra deployment pipeline specifics for the MVP EC2 auto-shutdown +
  Lambda-triggered-restart model (`docs/specs/tech-stack.md` §4.1).
