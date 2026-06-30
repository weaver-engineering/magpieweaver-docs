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

## Planning documents

Because tasks are granular and numerous, **every epic, story, and task is its own
file**, and the **directory path mirrors the planning hierarchy**. Filenames carry
the **full reference**, so a file is unambiguous when opened on its own.

```
docs/planning/
  plans/
    roadmap.md                        top-level plan; links to each epic
  todo.md                             scratch list of ToDos
  tasks.md                            register/index: every task, status, link to its file
  tasks/
    epics/
      E1-<slug>/
        E1-<slug>.md                  epic definition + sub-plan (its stories)
        E1-S1-<slug>/
          E1-S1-<slug>.md             story definition + its tasks
          E1-S1-T1-<slug>.md          task file
          E1-S1-T2-<slug>.md
    setup/    SETUP-1-<slug>.md       non-feature task files, foldered by branch root
    planning/ PLAN-1-<slug>.md
    research/ RES-1-<slug>.md         the research *task* (its summary lives in docs/research/)
    tech-debt/ TD-1-<slug>.md
```

- **Feature work** lives under `epics/` so the path encodes epic → story → task.
  The epic and story each have a document at their own level.
- **Non-feature tasks** have no epic/story parent, so they are foldered by their
  **branch root** (`setup/`, `planning/`, `research/`, `techdebt/`).
- A **research task** file documents the work item; the research **summary**
  deliverable still lives at `docs/research/<slug>.md` (see Research workflow).

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
- Branch roots in use: `setup/`, `feature/`, `planning/`, `research/`, `techdebt/`.
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

## Task lifecycle

A task's **status** records the furthest point it has reached. Most transitions
happen when a gate PR is **approved and merged** (the act that completes a gate);
the exception is `Ready → In Progress`, which happens when work begins. There is
no separate "in review" status: a task keeps its current status while a gate PR is
open, and advances only when that PR is approved and merged.

Statuses:

- **Proposed** — identified, not yet fully defined.
- **Ready** — defined and SMART, ready to be worked, but **not yet started**.
  Meeting the [Definition of Ready](#definition-of-ready) is what moves a task
  from Proposed to Ready. A Ready task may be **blocked** by dependency tasks
  that must complete first (see SMART → Actionable).
- **In Progress** — work has started. In this state we may commit changes to the
  task's **own record** — refined understanding, design notes, and any
  **newly discovered dependencies** — under the task's own reference, before it
  reaches its next milestone (Spec for features, Done for documentation /
  non-feature tasks). An In Progress task may also be **blocked** (see
  [Discovering dependencies mid-task](#discovering-dependencies-mid-task)).
- **Spec** *(features)* — the spec PR has been approved and merged.
- **Tests** *(features)* — the failing-tests PR has been approved and merged.
- **Done** — the final PR has been approved and merged: the implementation PR for
  features, or the single deliverable PR for documentation / non-feature tasks.

Two flows:

- **Feature tasks:** `Proposed → Ready → In Progress → Spec → Tests → Done`.
- **Documentation / non-feature tasks** (setup, planning, research, techdebt):
  `Proposed → Ready → In Progress → Done` (no spec or tests gates).

**Blocked** is an attribute, not a status: a `Ready` or `In Progress` task is
blocked while it has dependency tasks that are not yet `Done`. Record the
dependency and reason in the task file, and note it in the register status cell
(e.g. *In Progress — blocked by `RES-3`*).

A task may have **more than one PR** over its life. While `In Progress`, an
intermediate PR (on the task's own branch) may update the task's record or add
dependencies **without completing the task**; the gate PRs (Spec / Tests / Done)
advance the status.

### Discovering dependencies mid-task

While working a task we may realise another task must be completed before the
current one can finish — we simply hadn't understood the dependency up front.
Because no repo change is allowed without a task reference, and the discovery was
made while working the current task, the change is recorded **under the current
task's reference**:

1. **Create the new dependency task** (e.g. a `research/` or `feature/` task) in
   the planning structure, starting at **Proposed**.
2. **Update the current task's record** — set it to **In Progress**, add the new
   task as a dependency (the current task is now **blocked** by it), and explain
   **why** the dependency is needed (refined understanding, changed design, etc.).
3. **Commit via the normal branch + PR flow** on the current task's branch.
   Merging this updates our shared understanding **without** completing the
   current task.
4. **Work the dependency task** through to **Done**, which unblocks the current
   task; then resume it.

### Recording completion

A task is marked **Done** as the **closing change of its final PR** — the
register and the task file are updated to *Done* with their PR links, and merging
that PR is what completes the task. The status therefore reads *Done* on the
branch in the moment before merge; the merge realises it.

For a feature task whose final gate is in the implementation repo, the *Done*
update to the docs register is made as a brief closing change in the docs repo
once the implementation PR is approved.

### Commit conventions

**One commit per status transition.** Each gate PR should land as a single,
self-contained commit that advances the task to its next status:

- A **Proposed → Ready** change (making a task SMART) is one commit.
- An **In Progress** intermediate update (e.g. adding a discovered dependency)
  is one commit.
- Each gate commit (**Spec**, **Tests**, **Done**) is one commit.

Work-in-progress commits made while completing a gate should be **squashed**
before the PR is merged, so the branch history reads as one clean commit per
status reached. Use `git reset --soft <base>` and recommit, then
`git push --force-with-lease`.

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
Research is conducted in Google Gemini and captured as agreed fact *before* it
informs any design, through its own lightweight flow:

1. **ToDo `<Research>`.** A research need is recorded as a ToDo.
2. **Create the research task and seed Gemini.** A `research/` task (`RES-<n>`)
   is created. The agent creates a directory at
   `~/GoogleDrive/My Drive/MagpieWeaver/Research/<TaskRef>-<slug>/` and writes
   a `context_and_question.md` — project context plus the specific research
   question — to seed the Gemini conversation. The agent and author agree the
   content of this file before proceeding.
3. **Research in Gemini.** The author copies `context_and_question.md` into the
   Gemini app (typically on their tablet) and conducts the research
   conversation. As Gemini surfaces findings, the author extracts them as
   markdown or rich text and saves the files into the same Drive directory.
4. **Summarise into docs.** The agent reads the findings from the Drive
   directory and writes a faithful summary at `docs/research/<slug>.md`, on
   branch `research/<TaskRef>`, and raises a PR. This is a **docs-only task
   with a single review gate** (the summary PR). The author reviews and merges,
   confirming the summary is correct — at which point the research is a
   **statement of fact** the project may rely on.
5. **Generate tasks.** With the research agreed, we discuss it and create
   `planning/`/`feature/` tasks to update the roadmap, design, and specs. These
   re-enter the standard workflow above.

Conventions and principles:

- **Branch root `research/`**, task references **`RES-<n>`** (e.g. `RES-1`).
- Research summaries live at **`docs/research/<slug>.md`**.
- **Google Drive handoff directory:**
  `~/GoogleDrive/My Drive/MagpieWeaver/Research/<TaskRef>-<slug>/`.
  This directory is outside the repository and not subject to commit or PR
  gates — it is a working scratch space for the handoff between the agent and
  the author's Gemini session.
- **Summarise faithfully.** The summary captures what the source actually says;
  anything ambiguous or inferred is flagged as such. Research (fact) is kept
  separate from our decisions, which follow as tasks.

## Normal sequence vs. bootstrap

- **Normal:** a `planning/` PR defines and gets approval for the next SMART
  tasks; a subsequent `feature/` PR delivers a task.
- **Process tasks defined in their own PR:** tasks that do **not** arise from
  roadmap planning — `setup/` and `techdebt/` tasks, and the original bootstrap —
  may be defined within their own PR. This is the same path `SETUP-1` ("Define
  ways of working") and `SETUP-2` followed.
- **Mid-task discovery:** a dependency task discovered while working another task
  is created under that task's reference (see
  [Discovering dependencies mid-task](#discovering-dependencies-mid-task)).

## Task register

[`docs/planning/tasks.md`](planning/tasks.md) is the register/index — the single
at-a-glance view of all work. Each row gives a task's reference, title, type,
parent story/epic, affected component(s), status, branch, and PR links, and
**links to the task's own file** (see Planning documents). The detail lives in
the task file; the register is the index over them.
