# PLAN-1 — Triage ToDos into roadmap and first epics

| Field        | Value              |
|--------------|--------------------|
| Reference    | `PLAN-1`           |
| Type         | planning           |
| Story / Epic | —                  |
| Output(s)    | —                  |
| Depends on   | `RES-1`, `RES-2`   |
| Branch       | `planning/PLAN-1`  |
| Status       | Done               |
| PRs          | #5                 |

## Purpose

Take the open items in [`todo.md`](../../todo.md) and turn them into a real plan:
draft the top-level roadmap, identify the five epics, and create the planning
tasks (`PLAN-2` through `PLAN-6`) that will break each epic into stories and
SMART tasks when picked up.

## Scope / deliverables

- `docs/planning/roadmap.md` — top-level plan listing all five epics in
  sequence, each with a description and end state.
- `docs/planning/planning/PLAN-2` through `PLAN-6` — one planning task per
  epic, recorded in the task register as Proposed.
- `docs/planning/todo.md` — open ToDos annotated with the epic or task that
  will action them.

## Steps

1. Annotate open ToDos with their actioning epic/task. ✓
2. Write `docs/planning/roadmap.md` with all five epics. ✓
3. Create `PLAN-2` through `PLAN-6` task files and register them in `tasks.md`.
4. Update `tasks.md` — set `PLAN-1` to *Done* with PR link. ✓
5. Raise the PR. ✓

## Measure of done

- `docs/planning/roadmap.md` exists and lists all five epics with descriptions
  and end states.
- `PLAN-2` through `PLAN-6` are recorded as Proposed in the task register.
- Open ToDos are annotated with their actioning epic/task.
- Task register shows `PLAN-1` as Done with a PR link.

## Estimated duration

Half a day (single PR).
