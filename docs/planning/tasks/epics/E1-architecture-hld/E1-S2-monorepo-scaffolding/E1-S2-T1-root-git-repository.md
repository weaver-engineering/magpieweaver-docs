# E1-S2-T1 — Create Root Git Repository

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S2-T1`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S2`](E1-S2-monorepo-scaffolding.md) / `E1`              |
| Output(s)    | `magpie-weaver/` initialized repository                       |
| Depends on   | `E1-S1`                                                       |
| Branch       | `feature/E1-S2-T1`                                            |
| Status       | Proposed                                                      |
| PRs          | —                                                             |

## Purpose

Establish the foundational version control system for the `magpie-weaver`
implementation repository, configuring baseline ignore rules and locking in the
default branch name before any code is committed.

## Steps

1. Run `git init magpie-weaver` to initialize a blank Git repository locally.
2. Create a root `.gitignore` explicitly blocking:
   - `node_modules/` — Node dependency trees.
   - `target/` — Rust build output.
   - `dist/`, `build/` — compiled web bundles.
   - `.env*` — local environment keys.
   - `.DS_Store` — macOS filesystem metadata.
3. Execute an initial documentation-only commit to lock in `main` as the
   default branch name.
4. Update this task file and the register to Done with PR link.
5. Raise the implementation PR.

## Acceptance criteria

- `git status` on a clean clone confirms tracking is active on `main`.
- Adding test files to dummy `node_modules/` or `target/` directories confirms
  they are correctly intercepted and ignored.

## Measure of done

The initialized repository with `.gitignore` and initial commit is merged.

## Estimated duration

Two hours (single implementation PR).

## Notes

Act Mode only — Test Mode skipped (git init and .gitignore are purely
structural; no application logic to test). To be made Ready when `E1-S1` is
Done.
