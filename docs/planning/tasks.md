# Task Register

The single at-a-glance index of all Magpie Weaver work. Each task has its own
file (see [Ways of Working → Planning documents](../ways-of-working.md#planning-documents));
this register links to them and tracks status. Every branch and PR maps to a
task recorded here.

## Status legend

Status records the last milestone reached; it advances when a PR is approved and
merged. See [Ways of Working → Task lifecycle](../ways-of-working.md#task-lifecycle).

- **Proposed** — identified, not yet fully defined.
- **Ready** — defined and SMART, ready to be worked (may be blocked by dependency tasks).
- **Spec** *(features)* — spec PR approved and merged.
- **Tests** *(features)* — failing-tests PR approved and merged.
- **Done** — final PR (implementation, or the single deliverable PR) approved and merged.

Flows: features `Proposed → Ready → Spec → Tests → Done`; documentation /
non-feature `Proposed → Ready → Done`.

## Tasks

| Ref       | Title                  | Type     | Story / Epic | Component(s) | Status   | Branch            | PRs | File |
|-----------|------------------------|----------|--------------|--------------|----------|-------------------|-----|------|
| `SETUP-1` | Define ways of working | setup    | —            | —            | Done     | `setup/SETUP-1`   | #1  | [file](setup/SETUP-1-define-ways-of-working.md) |
| `PLAN-1`  | Triage ToDos into roadmap and first epics | planning | — | — | Proposed | `planning/PLAN-1` | —   | [file](planning/PLAN-1-triage-todos.md) |
| `RES-1`   | Summarise Magpie Weaver architecture research | research | — | — | Done | `research/RES-1` | #2 | [file](research/RES-1-magpieweaver-architecture.md) |
| `RES-2`   | Summarise research on running and training LLMs cheaply | research | — | — | Done | `research/RES-2` | _(this PR)_ | [file](research/RES-2-running-and-training-llms.md) |
