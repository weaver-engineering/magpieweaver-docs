# E1-S1-T2 — Design FileStore Interface Contract

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S1-T2`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S1`](E1-S1-hld-and-interface-design.md) / `E1`          |
| Output(s)    | `docs/specs/filestore-contract.md`                            |
| Depends on   | `E1-S1-T1`                                                    |
| Branch       | `feature/E1-S1-T2`                                            |
| Status       | Ready                                                         |
| PRs          | —                                                             |

## Purpose

Establish a strictly typed, immutable contract for the persistence and version
control layers that completely isolates application logic from physical storage
engines. This spec is the single source of truth for all FileStore
implementations in later epics.

## Steps

1. Create `docs/specs/filestore-contract.md` defining:
   - Formal TypeScript type signatures for the core methods: `read()`, `write()`,
     `list()`, `commit()`, and `revert()`.
   - Return structures for the Git execution layer — shape of a commit transaction
     payload (commit hash string, author metadata, timestamp).
   - Error boundary structures (e.g. `FileStoreError`, `GitConflictError`) for
     scenarios where async Git mutations fail or the continuity linter rejects a
     commit.
   - Compilation requirements: `strictNullChecks`, `noImplicitAny`, zero `any`
     types, `Promise` wrappers on every state-mutation method.
2. Update this task file and the register to Done with PR link.
3. Raise the spec PR.

## Acceptance criteria

- `docs/specs/filestore-contract.md` exists and is approved.
- Interface signatures cover all five methods (`read`, `write`, `list`,
  `commit`, `revert`) with precise input/output types.
- Zero `any` types in the interface definition.
- All state-mutation methods use `Promise` wrappers.
- Error boundary structures are defined for both OS-level and Git-level failure
  modes.

## Measure of done

`docs/specs/filestore-contract.md` is merged with the author's approval.

## Estimated duration

Half a day (single spec PR).

## Notes

Spec Mode only — no tests or implementation gate. Gate: Spec PR merged.
Depends on `E1-S1-T1` being Done so interface decisions are grounded in the
approved component topology.
Can proceed in parallel with `E1-S1-T3` once `E1-S1-T1` is Done.
