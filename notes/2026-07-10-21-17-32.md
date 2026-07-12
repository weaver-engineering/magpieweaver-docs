---
created: 2026-07-10T21:17:32+01:00
modified: 2026-07-10T21:17:41+01:00
---

# Task TBD-01: Local Dev Environment Setup

## Summary
Document how to stand up the Development Architecture environment (see `architecture.md`) from a clean machine,
and how to resume it cleanly after a break in development.

## Context
The architecture doc's own introduction notes that development effort may pause for a while, and that documentation
should let a developer (or the same developer returning later) pick the project back up without losing context.
There is currently no onboarding/setup reference for the local dev environment itself.

## Scope
- Required tool versions: Node.js/TypeScript toolchain, Git.
- LM Studio installation and model setup for local LLM use.
- Required environment variables / local config files.
- First-run steps to confirm the browser SPA, TS Service, and LM Studio are correctly wired together.
- A short "resuming after a break" checklist (what to check is still working before starting new task work).

## Out of scope
- Production/test environment setup (covered separately).
- CI/CD pipeline configuration (see task TBD-05).

## Deliverable
A new section or standalone doc describing the above, referenced from `architecture.md` under
"Local Dev Environment Setup".
