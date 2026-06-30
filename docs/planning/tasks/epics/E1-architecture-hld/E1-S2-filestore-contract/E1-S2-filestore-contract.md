# E1-S2 — FileStore Core Interface Contract

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S2`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S1`                            |
| Status       | Proposed                           |

## Objective

Define the strictly typed TypeScript boundary separating core engine logic from
Git/filesystem machinery. All application layers interact solely through this
contract, never touching the filesystem directly.

## Tasks

| Ref        | Task                              | Status   | Branch             | File |
|------------|-----------------------------------|----------|--------------------|------|
| `E1-S2-T1` | Storage abstraction specification | Proposed | `feature/E1-S2-T1` | — |
| `E1-S2-T2` | FileStore TypeScript interface export | Proposed | `feature/E1-S2-T2` | — |

## Measure of done

`docs/specs/filestore-contract.md` is approved and `packages/filestore/src/index.ts`
exports the typed interface; all workspaces resolve it via pnpm workspace references.

## Notes

To be made Ready when `E1-S1` is Done. Informed by ADR-004 from `RES-3`.
