# E1-S3-T2 — Branch Protection Rules

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S3-T2`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S3`](E1-S3-git-governance.md) / `E1`                    |
| Output(s)    | GitHub branch protection rules on `magpie-weaver/main`        |
| Depends on   | `E1-S3-T1`                                                    |
| Branch       | `feature/E1-S3-T2`                                            |
| Status       | Proposed                                                      |
| PRs          | —                                                             |

## Purpose

Protect the stability of the platform's production code by blocking unreviewed
pushes and enforcing linear history through squash merges.

## Steps

1. Navigate to the upstream `magpie-weaver` repository settings on GitHub.
2. Enable protection on the `main` branch.
3. Toggle **Require a pull request before merging** with at least one qualified
   reviewer approval required.
4. Enable **Require linear history** via **Require squash merge**, stripping
   intermediate local commits on merge to maintain a clean history.
5. Block force pushes to `main`.
6. Update this task file and the register to Done with PR link.
7. Raise the implementation PR (documenting the settings applied).

## Acceptance criteria

- Direct terminal pushes to `main` by any developer are blocked.
- Pull requests in the repository default to **Squash and Merge** only.
- Force pushes to `main` are disabled.

## Measure of done

Branch protection rules are active and verified by attempting (and confirming
the failure of) a direct push to `main`.

## Estimated duration

Two hours (single configuration PR documenting the settings applied).

## Notes

Act Mode only — Test Mode skipped (GitHub repository settings; no application
logic). Depends on `E1-S3-T1` (contributing guidelines must define the
expected workflow before protection rules enforce it). Can proceed in parallel
with `E1-S3-T3` once `E1-S3-T1` is Done.
