# E1-S1-T1 — Monorepo layout specification

| Field        | Value                                                    |
|--------------|----------------------------------------------------------|
| Reference    | `E1-S1-T1`                                               |
| Type         | feature                                                  |
| Story / Epic | [`E1-S1`](E1-S1-monorepo-scaffolding.md) / `E1`          |
| Output(s)    | `docs/specs/monorepo-layout.md`                          |
| Depends on   | —                                                        |
| Branch       | `feature/E1-S1-T1`                                       |
| Status       | Ready                                                    |
| PRs          | —                                                        |

## Purpose

Create the architectural specification for the `magpie-weaver` pnpm monorepo:
workspace layout, package boundaries, dependency graph, and pinned runtime
versions. This spec is the single source of truth for the workspace
initialization task that follows (`E1-S1-T2`).

## Steps

1. Create `docs/specs/monorepo-layout.md` covering:
   - Node engine (`>=20.x`) and pnpm (`>=9.x`) version constraints.
   - Exact version targets for Tauri v2, React 19, Vite, and Fastify v4/v5.
   - The full workspace listing (`apps/desktop`, `apps/web`, `apps/server`,
     `packages/filestore`, `packages/infra`) with each package's purpose.
   - Internal dependency graph (e.g. `apps/desktop` → `packages/filestore`).
   - Forbidden import boundaries (e.g. `packages/filestore` must not import
     from `apps/web`).
2. Update this task file and the register to Done with PR link.
3. Raise the spec PR.

## Acceptance criteria

- `docs/specs/monorepo-layout.md` exists and is complete.
- Node and pnpm version constraints are specified.
- All workspace packages are listed with exact pinned runtime versions.
- The dependency graph between workspaces is explicitly mapped.
- Forbidden import boundaries are documented.

## Measure of done

`docs/specs/monorepo-layout.md` is merged with the author's approval.

## Estimated duration

Half a day (single spec PR).

## Notes

Spec Mode only — no tests or implementation gate. Gate: Spec PR merged.
