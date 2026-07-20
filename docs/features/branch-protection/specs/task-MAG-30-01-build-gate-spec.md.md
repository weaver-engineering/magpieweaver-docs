# Task MAG-30 -Build Gate Specification 

**Companion to:** `task-MAG-101.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).
## 1. Interface Under Test
Not applicable. This spec defines the requirements for the GitHub workflow actions that provide the guard rails for Magpie Weaver development. 

## 2. Deliverable
This spec delivers the BuildGate GitHub workflow action.
`.github/workflow/actions/build-gate.yaml`
The action validates PRs sent to GitHub for all branches starting with `build`
It raises a GitHub workflow Status so that a branch protection rule can validate changes to the `build`branch.
## 3. Required Behaviours
* A valid task ref `{ref}` matches regex `[A-Z]+-[0-9]+`
* Commit status context is `BuildGate`
### 3.1 The BuildGate blocks PRs that don't start with {ref}
* Given - a PR to `build` whose title does not start with `{ref}`
* When - the action runs 
* Then -
  * The PR review states "The title of the PR must start with `{ref}`, e.g. 'MAG-30'"
  * A GitHub 'failure' commit status is raised
### 3.2 The BuildGate blocks PRs that are not on a branch named build/{ref}
* Given - a PR to `build`whose branch does not match `build/{ref}`
* When - the action runs
* Then -
  * The PR review states "The branch of the PR must match `build/{ref}`, e.g. 'build/MAG-30'"
  * a GitHub 'failure' commit status is raised
### 3.3 The BuildGate blocks PRs with less than 2 commits
* Given - a PR to `build` with < 2 commits
* When - the action runs
* Then -
  * The PR review states "PRs to build must contain 2 commits."
  * a GitHub 'failure' commit status is raised
### 3.4 The BuildGate blocks PRs with more than 2 commits
* Given - a PR to `build` with > 2 commits
* When - the action runs
* Then -
  * The PR review states "PRs to build must contain 2 commits."
  * a GitHub 'failure' commit status is raised


Relevant excerpt from architecture document.
>- ***Build Gate***
>   - Is a PR from `test/{ref}` to `origin/build/{ref}`.
>   - `{ref}` conforms to the regex `[A-Z]+-[0-9]+`
>   - Requires human approval to proceed.
>   - Validates
>     - 2 inbound commits
>     - 1st commit
>       - Commit messages starts with `{ref}`
>       - Commit message includes a description.
>       - Changes are **ONLY** in `/docs/tasks/task-{ref}`
>       - `/docs/tasks/task-{ref}/task-{ref}.md` exists.
>       - `/docs/tasks/task-{ref}/task-{ref}[-NN]-spec.md` exists.
>     - 2nd commit
>       - Commit message starts with `{ref}`
>       - Commit message includes a description.
>       - Changes are **ONLY** in `/test`
>       - Existing tests not changed.
>       - At least 1 new test
>     - Existing tests pass.
>     - At least 1 new test fails.
>   - Requires human override of failing validation.

