# E1-S3 — High-Speed Verification (In-Memory Mock)

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S3`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S2`                            |
| Status       | Proposed                           |

## Objective

Implement a zero-dependency in-memory mock of the FileStore interface to enable
fast agent test loops without physical disk overhead. This is distinct from the
full Git-backed implementations (`NativeGitFileStore`, `CloudGitFileStore`)
which are delivered in `E4`.

## Tasks

| Ref        | Task                        | Status   | Branch             | File |
|------------|-----------------------------|----------|--------------------|------|
| `E1-S3-T1` | Mock strategy specification | Proposed | `feature/E1-S3-T1` | — |
| `E1-S3-T2` | Failing test suite          | Proposed | `feature/E1-S3-T2` | — |
| `E1-S3-T3` | InMemoryMockFileStore implementation | Proposed | `feature/E1-S3-T3` | — |

## Measure of done

`pnpm --filter filestore test` returns 100% green with the in-memory mock
satisfying all test assertions.

## Notes

To be made Ready when `E1-S2` is Done. Full TDD cycle applies (Spec → Tests →
Implementation). The `NativeGitFileStore` and `CloudGitFileStore` implementations
are out of scope here — they are delivered in `E4 — Git-backed file store`.
