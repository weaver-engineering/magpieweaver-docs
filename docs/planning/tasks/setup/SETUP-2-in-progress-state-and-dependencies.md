# SETUP-2 — Add In Progress state and mid-task dependency handling

| Field        | Value                                            |
|--------------|--------------------------------------------------|
| Reference    | `SETUP-2`                                         |
| Type         | setup                                            |
| Story / Epic | —                                                |
| Output(s)    | —                                                |
| Depends on   | —                                                |
| Branch       | `setup/SETUP-2`                                  |
| Status       | Done                                             |
| PRs          | _(this PR)_                                       |

## Purpose

Close a gap in the task lifecycle: while working a task we may discover another
task that must be done first. Recording the new dependency and updating the
current task's details is a repo change that must link to a task — naturally the
task we were working on — but that task is then no longer pristine `Ready`. We
need an **In Progress** state so a task's record can be committed after work has
started and before it reaches a gate.

## Scope / deliverables

- `docs/ways-of-working.md`:
  - Add the **In Progress** status to the lifecycle and both flows.
  - Make **Blocked** an explicit attribute applicable to `Ready` or
    `In Progress`.
  - Add the **Discovering dependencies mid-task** procedure.
  - Note that a task may have **multiple PRs** over its life.
  - Generalise the bootstrap exception so `setup/` and `techdebt/` process tasks
    may be defined in their own PR.
- `docs/planning/tasks.md` — register legend updated; `SETUP-2` registered.
- Add a **Depends on** field to the task-file format (applied to `PLAN-1`).

## Measure of done

The ways of working describe the In Progress state, the mid-task dependency
procedure, and dependency/blocked tracking; the register reflects them; merged
with the author's approval.

## Notes

A setup/process task, defined within its own PR (it does not arise from roadmap
planning). Docs-only: single review gate. Marked Done as the closing change of
this PR per the completion convention.
