# Ways of Working

This document defines how the Magpie Weaver project is planned, specified, and
built. It is authoritative: every contribution to any Magpie Weaver repository
follows this process.

## Principles

- **Spec-driven development.** Nothing is built without an agreed spec. We
  decide *what* and *how* here, in the docs repo, before any code is written.
- **The author does not edit code directly.** All implementation is done by the
  AI agent, against approved specs, through pull requests the author reviews.
- **Every change is linked to a task.** No commit, branch, or PR exists without
  a task it belongs to — including documentation and setup changes.
- **Review gates, not trust.** Work advances only when the author approves the
  PR for the current stage.

## Planning hierarchy

Work is organised top-down so that any branch traces back to the roadmap:

```
Roadmap (top-level plan)
└─ Epic            a large body of work; gets its own sub-plan
   └─ Story        a deliverable slice of the epic ("how we deliver it")
      └─ Task      a granular, SMART unit of delivery; 1+ tasks per story
```

- The **roadmap** is the top-level plan and lists the epics.
- Each **epic** grows its own sub-plan describing how it is delivered as stories.
- Each **story** is implemented through one or more **tasks**.
- **Tasks are the unit of delivery.** Each task maps to exactly one branch and
  its associated PR(s).

Planning is itself work: a `planning/` task produces epics, breaks an epic into
stories, and breaks stories into tasks. Planning happens before building.

## Task references

Every task has a self-describing reference so any branch traces up to its story,
epic, and the roadmap.

| Level             | Format            | Example      |
|-------------------|-------------------|--------------|
| Epic              | `E<n>`            | `E1`         |
| Story             | `E<n>-S<n>`       | `E1-S2`      |
| Feature task      | `E<n>-S<n>-T<n>`  | `E1-S2-T3`   |
| Non-feature task  | `<TYPE>-<n>`      | `SETUP-1`    |

Non-feature task types correspond to the branch roots below (e.g. `SETUP-`,
`PLAN-`, `TD-`).

## Branches

- **Branch name = `<root>/<TaskRef>`**, and is **identical across repositories**
  (the docs repo and the relevant implementation repo use the same branch name
  for the same task).
- Branch roots in use: `setup/`, `feature/`, `planning/`, `research/`. Others may
  be added as needed (e.g. `techdebt/`).

Examples: `feature/E1-S2-T3`, `setup/SETUP-1`, `planning/PLAN-1`,
`research/RES-1`, `techdebt/TD-1`.

## SMART tasks

Every task must be **SMART** before it is Ready. For Magpie Weaver, SMART means:

- **S — Steps.** The task is broken down into the concrete steps required to
  complete it.
- **M — Measurable.** We have defined how we will measure that the task is done.
  A task is not Ready until its measure of done is defined.
- **A — Actionable.** We can start the task immediately, *or* we know exactly
  which tasks, stories, or epics must be complete before it becomes actionable.
  Dependencies are explicit.
- **R — Realistic.** The task has a realistically achievable outcome.
- **T — Time limited.** The task has an estimated duration. A task whose
  duration is too long must be split into smaller tasks, each sensibly
  completable in a single PR.

## Specs

- **Specs are per component.** Each component has one living spec at
  `docs/specs/<component>.md`.
- A feature task **creates a new component** or **updates an existing one**, and
  names the component(s) it affects.
- A component spec evolves over the project's life as successive tasks revise it.

## The task workflow

For each task:

1. **Discuss.** We talk the task through in conversation.
2. **Spec PR** *(docs repo, branch `<root>/<TaskRef>`)*. The agent writes or
   updates the affected component spec(s) and commits them. The author reviews
   and merges.
3. **Failing-tests review** *(implementation repo, same branch name)*. The first
   commit on the branch is the failing test definitions that encode the spec.
   The author reviews the tests.
4. **Implementation review** *(implementation repo, same branch)*. The agent
   updates the branch so the failing tests pass. The author reviews and merges.

So every task passes through up to three review gates — **spec → failing tests →
implementation** — and nothing proceeds until the prior gate is approved.

## Definition of Ready

A task may start only when all of the following hold:

- It is recorded in the [task register](planning/tasks.md) with a reference.
- Feature tasks are linked to a parent story (and therefore an epic);
  non-feature tasks state their rationale.
- It satisfies the [SMART criteria](#smart-tasks) — steps, measure of done,
  actionability, a realistic outcome, and an estimated duration that fits a
  single PR.
- The affected component(s) are identified.
- It has been discussed and is understood.

## Definition of Done

A task is done only when all relevant gates and conditions are satisfied:

- **Spec gate** — the affected component spec(s) are created/updated and the
  spec PR is merged.
- **Tests gate** — the failing test definitions are reviewed and merged.
- **Implementation gate** — the code makes the tests pass, the full suite is
  green, and the implementation PR is merged.
- The **acceptance criteria** are demonstrably met.
- The [task register](planning/tasks.md) is updated to *Done* with all PR links.
- Any documentation impacted by the change is updated.

Gates apply **as relevant to the task type**. A `setup/`, `planning/`, or other
docs-only task has no tests or implementation gates, so its Definition of Done
is simply: the deliverable is merged and the task register is updated.

## ToDo items

A running scratch list at [`docs/planning/todo.md`](planning/todo.md) captures
quick notes to ourselves — things to do, plan, or investigate.

- **ToDos are not tasks.** They have no reference, branch, or gates, and carry
  no commitment.
- **ToDos are still captured under a task.** They typically arise while working
  a task — e.g. during discussion we identify something else that needs doing.
  The edit to `todo.md` is committed on that task's branch and included in its
  PR, so the rule that every change links to a task holds with no exception.
- **Lifecycle.** During planning, ToDos are triaged — promoted into proper tasks
  (epic/story/task) or dropped — and removed from the list once actioned.
- **Format.** Dated bullets, e.g.
  `- [2026-06-28] Investigate how scene state is persisted between sessions.`

## Research workflow

The project depends on research (e.g. into architecture, or running AI models).
Research is captured as agreed fact *before* it informs any design, through its
own lightweight flow:

1. **ToDo `<Research>`.** A research need is recorded as a ToDo. The author
   provides the source — typically a **URL** (e.g. a chat history).
2. **Summarise into docs** *(a `research/` task)*. The agent reviews the source
   and writes a faithful summary at `docs/research/<slug>.md`, on branch
   `research/<TaskRef>`, and raises a PR. This is a **docs-only task with a
   single review gate** (the summary PR). The author reviews and merges,
   confirming we both agree the summary is correct — at which point the research
   is a **statement of fact** the project may rely on.
3. **Generate tasks.** With the research agreed, we discuss it and create
   `planning/`/`feature/` tasks to update the roadmap, design, and specs. These
   re-enter the standard workflow above.

Conventions and principles:

- **Branch root `research/`**, task references **`RES-<n>`** (e.g. `RES-1`).
- Research summaries live at **`docs/research/<slug>.md`**.
- **Summarise faithfully.** The summary captures what the source actually says;
  anything ambiguous or inferred is flagged as such. Research (fact) is kept
  separate from our decisions, which follow as tasks.
- **Fetch caveat.** The agent can only read **public** source URLs. If a source
  is private/authenticated, its content must be pasted in instead.

## Normal sequence vs. bootstrap

- **Normal:** a `planning/` PR defines and gets approval for the next SMART
  tasks; a subsequent `feature/` PR delivers a task.
- **Bootstrap exception:** when there is no prior planning PR to define a task
  (as when first establishing the project), the task may be defined within its
  own PR. `SETUP-1` ("Define ways of working") is defined this way.

## Task register

All tasks are recorded in [`docs/planning/tasks.md`](planning/tasks.md), the
single source of traceability: reference, title, type, parent story/epic,
affected component(s), status, branch, and PR links.
