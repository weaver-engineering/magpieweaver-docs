# E1-S2-T3 — Scaffold Monorepo Directory Tree

| Field        | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Reference    | `E1-S2-T3`                                                         |
| Type         | feature                                                            |
| Story / Epic | [`E1-S2`](E1-S2-monorepo-scaffolding.md) / `E1`                   |
| Output(s)    | `magpie-weaver/apps/`, `magpie-weaver/packages/`, `magpie-weaver/docs/` |
| Depends on   | `E1-S2-T2`                                                         |
| Branch       | `feature/E1-S2-T3`                                                 |
| Status       | Proposed                                                           |
| PRs          | —                                                                  |

## Purpose

Materialize the concrete workspace layout corresponding exactly to the approved
HLD, creating all sub-package directories with valid stub manifests so the pnpm
workspace resolves cleanly.

## Steps

1. Create application directories under `/apps`:
   - `apps/desktop/`
   - `apps/server/`
   - `apps/web/`
2. Create package directories under `/packages`:
   - `packages/filestore/`
   - `packages/infra/`
3. Create the documentation root: `docs/`.
4. Place a minimal stub `package.json` inside every sub-directory with its
   workspace-scoped name:
   - `{"name": "@magpie-weaver/desktop", "version": "0.1.0", "private": true}`
   - `{"name": "@magpie-weaver/server", "version": "0.1.0", "private": true}`
   - `{"name": "@magpie-weaver/web", "version": "0.1.0", "private": true}`
   - `{"name": "@magpie-weaver/filestore", "version": "0.1.0", "private": true}`
   - `{"name": "@magpie-weaver/infra", "version": "0.1.0", "private": true}`
5. Verify `pnpm install` at root exits with `0` and all five workspace packages
   are listed.
6. Update this task file and the register to Done with PR link.
7. Raise the implementation PR.

## Acceptance criteria

- Directory layout matches the structural topology in `docs/hld.md` exactly.
- All five internal workspace packages are listed cleanly when running
  `pnpm list -r` from the workspace root (no errors).
- `pnpm install` exits `0` at the monorepo root.

## Measure of done

The directory scaffold is merged and `pnpm install` passes cleanly.

## Estimated duration

Two hours (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (directory structure and stub manifests;
no application logic to test). Depends on `E1-S2-T2` (workspace config must
exist). Directory layout must match `docs/hld.md` exactly — no directories
beyond what the HLD specifies.
