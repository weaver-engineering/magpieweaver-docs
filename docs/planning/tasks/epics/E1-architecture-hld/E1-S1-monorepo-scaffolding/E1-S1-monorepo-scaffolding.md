# E1-S1 — Monorepo Scaffolding & Dependency Pinning

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S1`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Status       | Proposed                           |

## Objective

Build the physical repository layout and lock down cross-workspace dependency
boundaries. Establishes the `magpie-weaver` pnpm monorepo that all subsequent
E1 stories and later epics build on.

## Tasks

| Ref        | Task                            | Status | Branch             | File |
|------------|---------------------------------|--------|--------------------|------|
| `E1-S1-T1` | Monorepo layout specification   | Ready  | `feature/E1-S1-T1` | [file](E1-S1-T1-monorepo-layout-spec.md) |
| `E1-S1-T2` | Workspace initialization        | Ready  | `feature/E1-S1-T2` | [file](E1-S1-T2-workspace-init.md) |

## Measure of done

`pnpm install` resolves cleanly across all workspace directories and the
monorepo layout spec is approved.
