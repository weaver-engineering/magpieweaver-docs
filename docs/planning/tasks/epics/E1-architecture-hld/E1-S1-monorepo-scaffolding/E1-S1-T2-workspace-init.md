# E1-S1-T2 — Workspace initialization

| Field        | Value                                                    |
|--------------|----------------------------------------------------------|
| Reference    | `E1-S1-T2`                                               |
| Type         | feature                                                  |
| Story / Epic | [`E1-S1`](E1-S1-monorepo-scaffolding.md) / `E1`          |
| Output(s)    | `magpie-weaver/` monorepo scaffold                       |
| Depends on   | `E1-S1-T1`                                               |
| Branch       | `feature/E1-S1-T2`                                       |
| Status       | Ready                                                    |
| PRs          | —                                                        |

## Purpose

Initialize the physical `magpie-weaver` pnpm monorepo per the approved layout
spec (`E1-S1-T1`), creating all workspace directories and verifying the
workspace resolves cleanly.

## Steps

1. Initialize pnpm workspace at the monorepo root.
2. Create root `pnpm-workspace.yaml` declaring all five workspaces.
3. Create root `package.json` with engine constraints and workspace scripts.
4. Create empty, compilation-valid placeholder structure for each workspace:
   `apps/desktop`, `apps/web`, `apps/server`, `packages/filestore`,
   `packages/infra`.
5. Verify `pnpm install` exits with `0` at root.
6. Update this task file and the register to Done with PR link.
7. Raise the implementation PR.

## Acceptance criteria

- Root `pnpm-workspace.yaml` and `package.json` present and configured.
- All five workspace directories exist with valid placeholder structure.
- `pnpm install` at root exits with `0`.
- No workspace imports a forbidden package (per `docs/specs/monorepo-layout.md`).

## Measure of done

The initialized monorepo scaffold is merged and `pnpm install` passes cleanly.

## Estimated duration

Half a day (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (purely structural scaffolding; no logic to
trap with tests, per ADR-003). Depends on `E1-S1-T1` being Done (spec approved)
before implementation begins.
