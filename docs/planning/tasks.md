# Task Register

The single at-a-glance index of all Magpie Weaver work. Each task has its own
file (see [Ways of Working → Planning documents](../ways-of-working.md#planning-documents));
this register links to them and tracks status. Every branch and PR maps to a
task recorded here.

## Status legend

Status records the last milestone reached; it advances when a PR is approved and
merged. See [Ways of Working → Task lifecycle](../ways-of-working.md#task-lifecycle).

- **Proposed** — identified, not yet fully defined.
- **Ready** — defined and SMART, ready to be worked, but not yet started.
- **In Progress** — work has started; the task's record may be updated (incl. new
  dependencies) under its own ref before the next milestone.
- **Spec** *(features)* — spec PR approved and merged.
- **Tests** *(features)* — failing-tests PR approved and merged.
- **Done** — final PR (implementation, or the single deliverable PR) approved and merged.

Flows: features `Proposed → Ready → In Progress → Spec → Tests → Done`;
documentation / non-feature `Proposed → Ready → In Progress → Done`.
**Blocked** is an attribute (not a status): note it in the status cell, e.g.
*In Progress — blocked by `RES-3`*.

## Tasks

| Ref       | Title                  | Type     | Story / Epic | Component(s) | Status   | Branch            | PRs | File |
|-----------|------------------------|----------|--------------|--------------|----------|-------------------|-----|------|
| `SETUP-1` | Define ways of working | setup    | —            | —            | Done     | `setup/SETUP-1`   | #1  | [file](setup/SETUP-1-define-ways-of-working.md) |
| `SETUP-2` | Add In Progress state and mid-task dependency handling | setup | — | — | Done | `setup/SETUP-2` | _(this PR)_ | [file](setup/SETUP-2-in-progress-state-and-dependencies.md) |
| `SETUP-3` | Google Drive research handoff | setup | — | — | Done | `setup/SETUP-3` | #6 | [file](setup/SETUP-3-google-drive-research-handoff.md) |
| `PLAN-1`  | Triage ToDos into roadmap and first epics | planning | — | — | Done | `planning/PLAN-1` | #5  | [file](planning/PLAN-1-triage-todos.md) |
| `PLAN-2`  | Plan E1 — Architecture & HLD | planning | — | — | Proposed | `planning/PLAN-2` | — | [file](planning/PLAN-2-plan-e1-architecture-hld.md) |
| `PLAN-3`  | Plan E2 — Hello World Prototype | planning | — | — | Proposed | `planning/PLAN-3` | — | [file](planning/PLAN-3-plan-e2-hello-world-prototype.md) |
| `PLAN-4`  | Plan E3 — Stand up LLM | planning | — | — | Proposed | `planning/PLAN-4` | — | [file](planning/PLAN-4-plan-e3-stand-up-llm.md) |
| `PLAN-5`  | Plan E4 — Git-backed file store | planning | — | — | Proposed | `planning/PLAN-5` | — | [file](planning/PLAN-5-plan-e4-git-backed-file-store.md) |
| `PLAN-6`  | Plan E5 — Minimum Product | planning | — | — | Proposed | `planning/PLAN-6` | — | [file](planning/PLAN-6-plan-e5-minimum-product.md) |
| `PLAN-7`  | Plan E6 — MVP | planning | — | — | Proposed | `planning/PLAN-7` | — | [file](planning/PLAN-7-plan-e6-mvp.md) |
| `RES-1`   | Summarise Magpie Weaver architecture research | research | — | — | Done | `research/RES-1` | #2 | [file](research/RES-1-magpieweaver-architecture.md) |
| `RES-2`   | Summarise research on running and training LLMs cheaply | research | — | — | Done | `research/RES-2` | #3 | [file](research/RES-2-running-and-training-llms.md) |
