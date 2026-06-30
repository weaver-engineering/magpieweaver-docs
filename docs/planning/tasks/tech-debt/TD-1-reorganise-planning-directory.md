# TD-1 — Reorganise planning directory structure

| Field        | Value                                        |
|--------------|----------------------------------------------|
| Reference    | `TD-1`                                       |
| Type         | tech-debt                                    |
| Story / Epic | —                                            |
| Output(s)    | `docs/planning/tasks/`, `docs/planning/plans/`, `docs/ways-of-working.md`, `docs/planning/tasks.md`, `README.md` |
| Depends on   | —                                            |
| Branch       | `techdebt/TD-1`                              |
| Status       | Done                                         |
| PRs          | #7                                           |

## Purpose

Tidy the planning directory layout before it grows further: move all task
document files under a common `tasks/` subdirectory grouped by type, move plan
documents (roadmap etc.) to a `plans/` subdirectory, rename the `Component(s)`
field to `Output(s)` and record links to delivered documentation there, and
add a `tech-debt/` folder for future tech-debt tasks.

## Scope / deliverables

- `docs/planning/tasks/planning/` — planning task files moved here.
- `docs/planning/tasks/research/` — research task files moved here.
- `docs/planning/tasks/setup/` — setup task files moved here.
- `docs/planning/tasks/tech-debt/` — new; tech-debt task files live here.
- `docs/planning/plans/` — new; `roadmap.md` and future plan documents live here.
- `docs/planning/tasks.md` — all file links updated; `Component(s)` column
  renamed to `Output(s)`; output links added for completed tasks.
- `docs/ways-of-working.md` — planning directory structure diagram updated.
- `README.md` — link to `docs/planning/plans/` added.

## Measure of done

All task files are under `docs/planning/tasks/`, `roadmap.md` is under
`docs/planning/plans/`, internal links resolve correctly, and the PR is merged.
