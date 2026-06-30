# E1-S2 — Monorepo Scaffolding & Tooling Initialization

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S2`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S1`                            |
| Status       | Proposed                           |

## Objective

Initialize the physical `magpie-weaver` repository and configure the workspace
package manager so there is a structured, zero-friction environment to write
code. The directory layout must exactly match the approved HLD.

## Tasks

| Ref        | Task                               | Status   | Branch             | File |
|------------|------------------------------------|----------|--------------------|------|
| `E1-S2-T1` | Create root Git repository         | Proposed | `feature/E1-S2-T1` | [file](E1-S2-T1-root-git-repository.md) |
| `E1-S2-T2` | Initialize pnpm workspace          | Proposed | `feature/E1-S2-T2` | [file](E1-S2-T2-pnpm-workspace.md) |
| `E1-S2-T3` | Scaffold monorepo directory tree   | Proposed | `feature/E1-S2-T3` | [file](E1-S2-T3-scaffold-directory-tree.md) |
| `E1-S2-T4` | Engine & compiler target constraints | Proposed | `feature/E1-S2-T4` | [file](E1-S2-T4-engine-compiler-constraints.md) |

## Measure of done

`pnpm install` exits `0` at the monorepo root across a correctly mapped
workspace directory tree matching the approved HLD.

## Notes

To be made Ready when `E1-S1` is Done.
