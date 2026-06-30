# E1-S4-T2 — Per-Package README Templates

| Field        | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Reference    | `E1-S4-T2`                                                         |
| Type         | feature                                                            |
| Story / Epic | [`E1-S4`](E1-S4-docs-as-code.md) / `E1`                           |
| Output(s)    | `README.md` in each of the five `magpie-weaver` sub-packages       |
| Depends on   | `E1-S2`, `E1-S4-T1`                                                |
| Branch       | `feature/E1-S4-T2`                                                 |
| Status       | Proposed                                                           |
| PRs          | —                                                                  |

## Purpose

Ensure every application and package in the monorepo maintains clear,
up-to-date documentation for its responsibilities, dependencies, and local
build steps — keeping docs close to the code so they never rot.

## Steps

1. Create a boilerplate README template for internal workspace modules with
   placeholder sections:
   - **Overview** — what this package does and its role in the system.
   - **Local Installation** — prerequisites and setup commands.
   - **Scripts** — available `pnpm run` commands with descriptions.
   - **Architecture Overview** — component boundaries and key design decisions.
   - **Exported API Boundaries** — public interfaces or entry points.
2. Distribute a targeted README to each sub-package root:
   - `apps/desktop/README.md` — Tauri v2 setup steps and Rust prerequisite
     installation.
   - `apps/server/README.md` — Fastify routing notes and local Docker setup.
   - `apps/web/README.md` — React 19 / Vite build targets and dev server.
   - `packages/filestore/README.md` — FileStore interface signature; explicit
     description of the boundary between local native storage and cloud
     container persistence.
   - `packages/infra/README.md` — AWS CDK deployment steps and environment
     variable requirements.
3. Update this task file and the register to Done with PR link.
4. Raise the implementation PR.

## Acceptance criteria

- All five sub-packages contain a unique, targeted `README.md`.
- `packages/filestore/README.md` explicitly documents the boundary between
  local native storage and cloud container persistence paths.
- Each README contains populated content for all five placeholder sections
  (not empty stubs).

## Measure of done

All five `README.md` files are merged with the author's approval.

## Estimated duration

Half a day (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (documentation files). Depends on `E1-S2`
(directories must exist) and `E1-S4-T1` (ADR pattern should be referenced
from the Architecture Overview section). Can proceed in parallel with
`E1-S4-T1` for drafting; merge after `E1-S4-T1` is Done.
