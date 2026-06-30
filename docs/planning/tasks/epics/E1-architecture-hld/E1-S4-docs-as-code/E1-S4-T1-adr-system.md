# E1-S4-T1 — ADR System Setup

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S4-T1`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S4`](E1-S4-docs-as-code.md) / `E1`                      |
| Output(s)    | `magpie-weaver/docs/adr/TEMPLATE.md`, `magpie-weaver/docs/adr/0001-record-architecture-decisions.md` |
| Depends on   | `E1-S2`                                                       |
| Branch       | `feature/E1-S4-T1`                                            |
| Status       | Proposed                                                      |
| PRs          | —                                                             |

## Purpose

Create a standardized, version-controlled process for tracking major design
choices so that all technical pivots are recorded with full context and
rationale and never diverge silently from the approved HLD.

## Steps

1. Create the `/docs/adr/` directory at the `magpie-weaver` repository root.
2. Author `TEMPLATE.md` containing the following sections:
   - **Title** — short imperative phrase.
   - **Status** — one of: Proposed / Accepted / Superseded.
   - **Context** — the problem or constraint driving the decision.
   - **Decision** — the chosen solution.
   - **Consequences** — trade-offs and impact on the rest of the system.
3. Draft and save `0001-record-architecture-decisions.md` as the bootstrap
   ADR, establishing this pattern as the project standard.
4. The `0001` ADR must explicitly mandate that any structural deviation from
   `docs/hld.md` requires a new sequential ADR file.
5. Update this task file and the register to Done with PR link.
6. Raise the implementation PR.

## Acceptance criteria

- `/docs/adr/` exists and contains both `TEMPLATE.md` and the committed
  `0001` ADR.
- The `0001` ADR status is **Accepted** and mandates new sequential ADRs for
  any HLD deviations.

## Measure of done

Both ADR files are merged with the author's approval.

## Estimated duration

Two hours (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (documentation files). Depends on `E1-S2`
being Done (repository and `docs/` directory must exist). Can proceed in
parallel with `E1-S4-T2`.
