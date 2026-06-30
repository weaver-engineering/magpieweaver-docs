# E1-S3-T3 — Pre-Commit Validation Hooks

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S3-T3`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S3`](E1-S3-git-governance.md) / `E1`                    |
| Output(s)    | `magpie-weaver/.husky/`, root `lint-staged` configuration     |
| Depends on   | `E1-S3-T1`                                                    |
| Branch       | `feature/E1-S3-T3`                                            |
| Status       | Proposed                                                      |
| PRs          | —                                                             |

## Purpose

Establish an automated local gatekeeper that catches malformed TypeScript or
formatting errors before they can be committed, enforcing the code quality
standards defined in the contributing guidelines.

## Steps

1. Install `husky` and `lint-staged` as devDependencies at the workspace root:
   ```
   pnpm add -Dw husky lint-staged
   ```
2. Initialize husky:
   ```
   pnpm exec husky init
   ```
3. Configure the pre-commit hook (`.husky/pre-commit`) to run `lint-staged`.
4. Configure `lint-staged` in the root `package.json` (or `lint-staged.config.js`)
   to run on staged TypeScript and Rust source files:
   - TypeScript (`.ts`, `.tsx`): run the workspace TypeScript compiler check
     and Prettier format check.
   - Rust (`.rs`): run `cargo fmt --check` if Rust toolchain is present.
5. Verify the hook fires correctly by staging a file with a known formatting
   error and confirming the commit is blocked.
6. Update this task file and the register to Done with PR link.
7. Raise the implementation PR.

## Acceptance criteria

- Attempting to commit TypeScript code with syntax errors or formatting
  violations is blocked, with errors printed to the terminal.
- Well-formed, correctly formatted code passes through the hook and commits
  cleanly.

## Measure of done

Pre-commit hooks are merged and verified by both a failing and a passing
staged commit.

## Estimated duration

Half a day (single implementation PR including verification).

## Notes

Act Mode only — Test Mode skipped (tooling configuration). Depends on
`E1-S3-T1` (contributing guidelines must define the formatting and commit
standards the hook enforces). Can proceed in parallel with `E1-S3-T2` once
`E1-S3-T1` is Done.
