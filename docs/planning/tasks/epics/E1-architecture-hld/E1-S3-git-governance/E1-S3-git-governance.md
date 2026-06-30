# E1-S3 — Git Governance & Branch Naming Strategy

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S3`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S2`                            |
| Status       | Proposed                           |

## Objective

Establish branch naming conventions, repository protection rules, and
pre-commit validation hooks for the `magpie-weaver` implementation monorepo,
ensuring agents and contributors follow a deterministic integration workflow.

## Tasks

| Ref        | Task                              | Status   | Branch             | File |
|------------|-----------------------------------|----------|--------------------|------|
| `E1-S3-T1` | Contributing guidelines           | Proposed | `feature/E1-S3-T1` | [file](E1-S3-T1-contributing-guidelines.md) |
| `E1-S3-T2` | Branch protection rules           | Proposed | `feature/E1-S3-T2` | [file](E1-S3-T2-branch-protection.md) |
| `E1-S3-T3` | Pre-commit validation hooks       | Proposed | `feature/E1-S3-T3` | [file](E1-S3-T3-pre-commit-hooks.md) |

## Measure of done

Direct pushes to `main` are blocked; pull requests default to squash merge;
pre-commit hook fires on malformed TypeScript or formatting errors.

## Notes

To be made Ready when `E1-S2` is Done. May run in parallel with `E1-S4`.
Branch naming conventions must be consistent with `magpie-weaver-docs`
ways-of-working (branch root `feature/`, refs `E1-S1-T1` etc.).
