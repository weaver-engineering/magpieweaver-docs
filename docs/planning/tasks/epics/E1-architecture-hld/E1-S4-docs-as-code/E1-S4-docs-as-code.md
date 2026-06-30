# E1-S4 — Documentation-as-Code Framework

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S4`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S2`                            |
| Status       | Proposed                           |

## Objective

Implement an Architecture Decision Record (ADR) system and per-package README
templates in the `magpie-weaver` monorepo so design decisions and component
schemas stay close to the code and never rot.

## Tasks

| Ref        | Task                              | Status   | Branch             | File |
|------------|-----------------------------------|----------|--------------------|------|
| `E1-S4-T1` | ADR system setup                  | Proposed | `feature/E1-S4-T1` | [file](E1-S4-T1-adr-system.md) |
| `E1-S4-T2` | Per-package README templates      | Proposed | `feature/E1-S4-T2` | [file](E1-S4-T2-package-readmes.md) |

## Measure of done

`/docs/adr/` directory contains an ADR template and the initial bootstrap ADR;
all five sub-packages contain a targeted README.

## Notes

To be made Ready when `E1-S2` is Done. May run in parallel with `E1-S3`.
