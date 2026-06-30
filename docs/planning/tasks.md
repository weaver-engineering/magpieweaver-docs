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

| Ref       | Title                  | Type      | Story / Epic | Output(s) | Status   | Branch            | PRs | File |
|-----------|------------------------|-----------|--------------|-----------|----------|-------------------|-----|------|
| `SETUP-1` | Define ways of working | setup     | —            | [ways-of-working.md](../ways-of-working.md) | Done | `setup/SETUP-1` | #1 | [file](tasks/setup/SETUP-1-define-ways-of-working.md) |
| `SETUP-2` | Add In Progress state and mid-task dependency handling | setup | — | [ways-of-working.md](../ways-of-working.md) | Done | `setup/SETUP-2` | #4 | [file](tasks/setup/SETUP-2-in-progress-state-and-dependencies.md) |
| `SETUP-3` | Google Drive research handoff | setup | — | [ways-of-working.md](../ways-of-working.md) | Done | `setup/SETUP-3` | #6 | [file](tasks/setup/SETUP-3-google-drive-research-handoff.md) |
| `PLAN-1`  | Triage ToDos into roadmap and first epics | planning | — | [roadmap.md](plans/roadmap.md) | Done | `planning/PLAN-1` | #5 | [file](tasks/planning/PLAN-1-triage-todos.md) |
| `PLAN-2`  | Plan E1 — Architecture & HLD | planning | — | — | In Progress — blocked by `RES-3`, `RES-4` | `planning/PLAN-2` | — | [file](tasks/planning/PLAN-2-plan-e1-architecture-hld.md) |
| `PLAN-3`  | Plan E2 — Hello World Prototype | planning | — | — | Proposed | `planning/PLAN-3` | — | [file](tasks/planning/PLAN-3-plan-e2-hello-world-prototype.md) |
| `PLAN-4`  | Plan E3 — Stand up LLM | planning | — | — | Proposed | `planning/PLAN-4` | — | [file](tasks/planning/PLAN-4-plan-e3-stand-up-llm.md) |
| `PLAN-5`  | Plan E4 — Git-backed file store | planning | — | — | Proposed | `planning/PLAN-5` | — | [file](tasks/planning/PLAN-5-plan-e4-git-backed-file-store.md) |
| `PLAN-6`  | Plan E5 — Minimum Product | planning | — | — | Proposed | `planning/PLAN-6` | — | [file](tasks/planning/PLAN-6-plan-e5-minimum-product.md) |
| `PLAN-7`  | Plan E6 — MVP | planning | — | — | Proposed | `planning/PLAN-7` | — | [file](tasks/planning/PLAN-7-plan-e6-mvp.md) |
| `RES-3`   | HLD and Architectural Decision Records | research | — | `docs/research/hld-and-adrs.md` | Ready | `research/RES-3` | — | [file](tasks/research/RES-3-hld-and-adrs.md) |
| `RES-4`   | E1 Sub Plan | research | — | `docs/research/e1-sub-plan.md` | Ready | `research/RES-4` | — | [file](tasks/research/RES-4-e1-sub-plan.md) |
| `RES-1`   | Summarise Magpie Weaver architecture research | research | — | [magpieweaver-architecture.md](../research/magpieweaver-architecture.md) | Done | `research/RES-1` | #2 | [file](tasks/research/RES-1-magpieweaver-architecture.md) |
| `RES-2`   | Summarise research on running and training LLMs cheaply | research | — | [running-and-training-llms.md](../research/running-and-training-llms.md) | Done | `research/RES-2` | #3 | [file](tasks/research/RES-2-running-and-training-llms.md) |
| `TD-1`    | Reorganise planning directory structure | tech-debt | — | [tasks/](tasks/), [plans/](plans/) | Done | `techdebt/TD-1` | #7 | [file](tasks/tech-debt/TD-1-reorganise-planning-directory.md) |
