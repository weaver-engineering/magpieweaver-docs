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

### 3.5 The BuildGate allows PRs with 2 commit}
* Given - 
  * a PR whose title starts with `{ref}`
  * a PR on a branch `build/{ref}`
  * a PR to `build` with 2 commits

#### 3.5.1 The BuildGate blocks PRs whose 1st commit does not start with {ref}
* Given -
  * The condition of §3.5
  * The 1st commit message does not start with {ref}
* When - the action runs
* Then -
  * The PR review states "The specification commit must start with `{ref}`, e.g. MAG-30"
  * a GitHub 'failure' commit status is raised

#### 3.5.2 The BuildGate blocks PRs whose 1st commit does not include a description
* Given -
  * The condition of §3.5
  * The 1st commit message does not include a description
* When - the action runs
* Then -
  * The PR review states "The specification commit must describe the change"
  * a GitHub 'failure' commit status is raised

#### 3.5.3 The BuildGate blocks PRs whose 1st commit makes changes outside /docs/tasks/task-{ref}
* Given -
  * The condition of §3.5
  * The 1st commit with changes outside `/docs/tasks/task-{ref}`
* When - the action runs
* Then -
  * The PR review states "The specification commit may only change /docs/tasks/tast-{ref}"
  * a GitHub 'failure' commit status is raised

#### 3.5.4 The BuildGate blocks PRs whose 1st commit [HEAD] does not define the task
* Given -
  * The condition of §3.5
  * The 1st commit [HEAD] does not include `/docs/tasks/task-{ref}/task-{ref}.md`
* When - the action runs
* Then -
  * The PR review states "The specification commit must include define the task"
  * a GitHub 'failure' commit status is raised

#### 3.5.5 The BuildGate blocks PRs whose 1st commit [HEAD] does not define the task spec
* Given -
  * The condition of §3.5
  * The 1st commit [HEAD] does not include `/docs/tasks/task-{ref}/task-{ref}-spec.md`
  * The 1st commit [HEAD] does not include `/docs/tasks/task-{ref}/task-{ref}-{NN}-spec.md`
* When - the action runs
* Then -
  * The PR review states "The specification commit must include the task spec"
  * a GitHub 'failure' commit status is raised

#### 3.5.6 The BuildGate blocks PRs whose 2nd commit does not start with {ref}
* Given -
  * The condition of §3.5
  * The 2nd commit message does not start with {ref}
* When - the action runs
* Then -
  * The PR review states "The test commit must start with `{ref}`, e.g. MAG-30"
  * a GitHub 'failure' commit status is raised

#### 3.5.7 The BuildGate blocks PRs whose 2nd commit does not include a description
* Given -
  * The condition of §3.5
  * The 2nd commit message does not include a description
* When - the action runs
* Then -
  * The PR review states "The test commit must describe the change"
  * a GitHub 'failure' commit status is raised

#### 3.5.8 The BuildGate blocks PRs whose 2nd commit makes changes outside /test
* Given -
  * The condition of §3.5
  * The 2nd commit with changes outside `/test`
* When - the action runs
* Then -
  * The PR review states "The test commit may only change /test"
  * a GitHub 'failure' commit status is raised

#### 3.5.9 The BuildGate blocks PRs whose 2nd commit updates existing tests
* Given -
  * The condition of §3.5
  * The 2nd commit updates an existing test `*.test.ts`
* When - the action runs
* Then -
  * The PR review states "The test commit may not change existing tests"
  * a GitHub 'failure' commit status is raised

#### 3.5.10 The BuildGate blocks PRs whose 2nd commit does not define a new test
* Given -
  * The condition of §3.5
  * The 2nd commit without a new `*.test.ts`
* When - the action runs
* Then -
  * The PR review states "The test commit may not change existing tests"
  * a GitHub 'failure' commit status is raised

#### 3.5.11 The BuildGate blocks PRs without a new failing test
* Given -
  * The condition of §3.5
  * The 2nd commit without a new `*.test.ts`
* When - the action runs
* Then -
  * The PR review states "The test commit must define a new failing test"
  * a GitHub 'failure' commit status is raised

#### 3.5.12 The BuildGate passes valid PRs
* Given -
  * The condition of §3.5
  * The 1st commit message starts with `{ref}`
  * The 1st commit message includes a description
  * The 1st commit defines `/docs/tasks/task-{ref}/task-{ref}.md`
  * The 1st commit defines `/docs/tasks/tqsk-{ref}/task-{ref}-spec.md`
  * The 2nd commit message starts with `{ref}`
  * The 2nd commit message includes a description
  * The 2nd commit defines a new file matching `/test/**/*.test.ts`
  * The 2nd commit fails a newly defined test matching `/test/**/*.test.ts`
  * THe 2nd commit does not update any files matching `test/**/*.test.ts`
* When - the action runs
* Then -
  * The PR review states "All BuildGate validations pass"
  * a GitHub 'success' commit status is raised


