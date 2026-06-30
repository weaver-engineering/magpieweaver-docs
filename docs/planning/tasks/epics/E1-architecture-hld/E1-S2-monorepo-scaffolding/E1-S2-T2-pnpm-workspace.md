# E1-S2-T2 — Initialize pnpm Workspace

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S2-T2`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S2`](E1-S2-monorepo-scaffolding.md) / `E1`              |
| Output(s)    | `magpie-weaver/pnpm-workspace.yaml`, root `package.json`      |
| Depends on   | `E1-S2-T1`                                                    |
| Branch       | `feature/E1-S2-T2`                                            |
| Status       | Proposed                                                      |
| PRs          | —                                                             |

## Purpose

Configure the monorepo package orchestration layer to manage dependency
hoisting, internal package linking, and strict workspace isolation, preventing
accidental publication and locking the toolchain to pnpm.

## Steps

1. Create root `pnpm-workspace.yaml` declaring workspace boundaries:
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```
2. Generate root `package.json` with `"private": true` to prevent accidental
   npm registry publication.
3. Configure root scripts in `package.json` for global linting, formatting,
   and recursive building across sub-packages (e.g.
   `"build": "pnpm -r run build"`).
4. Add an explicit `packageManager` field or `.npmrc` to block `npm` and `yarn`
   execution, locking the codebase to pnpm.
5. Update this task file and the register to Done with PR link.
6. Raise the implementation PR.

## Acceptance criteria

- `pnpm-workspace.yaml` is structurally valid and correctly targets `/apps`
  and `/packages`.
- Root `package.json` contains `"private": true`.
- Attempting to run `npm install` or `yarn install` fails with a clear
  error, locking the codebase to pnpm.

## Measure of done

`pnpm-workspace.yaml` and root `package.json` are merged and workspace
configuration is valid.

## Estimated duration

Two hours (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (workspace configuration files; no
application logic to test). Depends on `E1-S2-T1` (repository must exist).
