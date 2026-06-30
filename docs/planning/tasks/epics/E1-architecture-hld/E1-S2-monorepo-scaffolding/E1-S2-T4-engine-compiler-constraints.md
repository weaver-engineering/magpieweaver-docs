# E1-S2-T4 — Engine & Compiler Target Constraints

| Field        | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Reference    | `E1-S2-T4`                                                         |
| Type         | feature                                                            |
| Story / Epic | [`E1-S2`](E1-S2-monorepo-scaffolding.md) / `E1`                   |
| Output(s)    | `magpie-weaver/tsconfig.base.json`, `.editorconfig`, `.prettierrc` |
| Depends on   | `E1-S2-T3`                                                         |
| Branch       | `feature/E1-S2-T4`                                                 |
| Status       | Proposed                                                           |
| PRs          | —                                                                  |

## Purpose

Standardize the execution runtime and TypeScript compiler strictness across the
entire monorepo so that ambient environments and runtime drift between
contributors are impossible.

## Steps

1. Append an `"engines"` block to the root `package.json` enforcing minimum
   version requirements:
   - Node.js: `>=22.x`
   - pnpm: `>=9.x`
2. Create `tsconfig.base.json` at the monorepo root:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "strictNullChecks": true,
       "noImplicitAny": true,
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler"
     }
   }
   ```
3. Create `.editorconfig` at the monorepo root enforcing consistent file
   encoding (UTF-8), indentation (2 spaces), and trailing newlines across
   TypeScript and Rust source files.
4. Create `.prettierrc` at the monorepo root for consistent formatting
   (single quotes, 2-space indent, trailing commas).
5. Update this task file and the register to Done with PR link.
6. Raise the implementation PR.

## Acceptance criteria

- Attempting to run `pnpm install` with an unsupported Node or pnpm version
  fails immediately with an engine mismatch error.
- Sub-packages can cleanly extend `tsconfig.base.json` via `"extends":
  "../../tsconfig.base.json"` without bypassing strictness.

## Measure of done

`tsconfig.base.json`, `.editorconfig`, and `.prettierrc` are merged and engine
constraints are active.

## Estimated duration

Two hours (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (configuration files only; no application
logic to test). Depends on `E1-S2-T3` (directory structure must exist for
paths to make sense). Exact Node and pnpm versions should align with the
version constraints recorded in `docs/specs/tech-stack.md` (`E1-S1-T3`).
