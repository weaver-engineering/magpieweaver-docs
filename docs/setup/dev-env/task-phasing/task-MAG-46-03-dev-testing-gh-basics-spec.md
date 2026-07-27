# Task MAG-46 - real GitHub (`gh`) wrapper

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/deps/gh.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`GitHubTool` (§2's `ExternalTools.github`, §4.9 of `task-phasing-lld.md`),
exercised for real via `pnpm task --dev-testing gh <method> [-i |
--args-file <path>]` (grammar fixed in
`task-MAG-46-dev-testing-cli-design.md`): `createPR`, `findMergedPRs`,
`findMergedPR`, `findOpenPR`.

This is the sole merge/PR-status detection mechanism in the whole design
(§3.3) — it must be proven against a real GitHub repository, not a mock,
since the entire phase-derivation model depends on `gh`'s actual behavior
matching what §3.2/§3.3 assume.

## 2. Deliverable
The `--dev-testing gh` branch of the dispatch path from MAG-46-01, plus the
real `GitHubTool` implementation (a thin wrapper over the `gh` CLI) it
routes to.

### 2.1 Deliverable Notes For Agent
- Each behavior below needs a real sandbox GitHub repo state — the Given
  describes both the git branch state *and* the actual GitHub PR state
  (open/merged/none), since `gh`'s behavior is what's under test, not a
  mocked stand-in for it.
- `findMergedPRs` (plural) vs `findMergedPR` (singular, most-recent) are
  separate methods — cover both, since §4.9 notes more than one merged PR
  per base/head pair is an expected, designed-for case (§3.5's superseded-
  merge scenario), not an edge case.
- Don't attempt to assert on `mergeCommitOid`/`headRefOid` exact values
  here beyond "present and well-formed" — their specific use in the
  rebase-forward logic is MAG-46-13/10.01's concern, not this wrapper's.
- Reminder from the design doc's §6: `--dev-testing gh` runs against
  whatever repo `cwd` is in — invoke it from inside the sandbox checkout,
  not from `task-phases`'s own working directory.

## 3. Required Behaviors
* Creates a real PR via `gh pr create` and returns its number/URL.
* Finds real merged PRs for a base/head pair, oldest-first, full history.
* Finds the single most recent merged PR for a base/head pair.
* Finds a real currently-open PR for a base/head pair, or reports none.

### 3.1 createPR
#### 3.1.1 Opens a real PR
* Given
  * `spec/AAA-001` and `test/AAA-001` both exist and are pushed to `origin`
  * No PR currently exists between them
* When -
  ```bash
  pnpm task --dev-testing gh createPR -i << EOF
  {"base": "spec/AAA-001", "head": "test/AAA-001", "opts": {"title": "Tests for AAA-001"}}
  EOF
  ```
* Then -
  * A real PR now exists on GitHub from `test/AAA-001` into `spec/AAA-001`
  * The reported result includes that PR's real number and URL

### 3.2 findOpenPR
#### 3.2.1 Reports an open PR
* Given - the PR created in §3.1.1 is still open (unmerged)
* When -
  ```bash
  pnpm task --dev-testing gh findOpenPR -i << EOF
  {"base": "spec/AAA-001", "head": "test/AAA-001"}
  EOF
  ```
* Then - the reported result's `number`/`url` match that real PR

#### 3.2.2 Reports null when no PR is open
* Given - no PR exists between `spec/AAA-002` and `test/AAA-002`
* When -
  ```bash
  pnpm task --dev-testing gh findOpenPR -i << EOF
  {"base": "spec/AAA-002", "head": "test/AAA-002"}
  EOF
  ```
* Then - the reported result is `null`

### 3.3 findMergedPR / findMergedPRs
#### 3.3.1 findMergedPR reports the single merged PR
* Given
  * A PR from `test/AAA-003` into `build/AAA-003` was merged via squash
* When -
  ```bash
  pnpm task --dev-testing gh findMergedPR -i << EOF
  {"base": "build/AAA-003", "head": "test/AAA-003"}
  EOF
  ```
* Then - the reported result includes `mergedAt`, `headRefOid`, and
  `mergeCommitOid`, all matching the real merge on GitHub

#### 3.3.2 findMergedPR reports null when nothing has merged
* Given - no PR between `test/AAA-004` and `build/AAA-004` has ever merged
* When -
  ```bash
  pnpm task --dev-testing gh findMergedPR -i << EOF
  {"base": "build/AAA-004", "head": "test/AAA-004"}
  EOF
  ```
* Then - the reported result is `null`

#### 3.3.3 findMergedPRs reports full history, oldest first
* Given
  * A first PR from `test/AAA-005` into `build/AAA-005` merged
  * `test/AAA-005` was later amended and a second PR into `build/AAA-005`
    also merged (the superseded-merge scenario, §3.5 of the LLD)
* When -
  ```bash
  pnpm task --dev-testing gh findMergedPRs -i << EOF
  {"base": "build/AAA-005", "head": "test/AAA-005"}
  EOF
  ```
* Then -
  * The reported result contains exactly 2 entries
  * The first entry's `mergedAt` is earlier than the second's
  * `findMergedPR` (singular) against the same pair reports only the
    second (most recent) entry

### 3.4 Error Handling
#### 3.4.1 createPR against a non-existent head branch
* Given - `nonexistent-branch` does not exist on `origin`
* When -
  ```bash
  pnpm task --dev-testing gh createPR -i << EOF
  {"base": "main", "head": "nonexistent-branch", "opts": {"title": "x"}}
  EOF
  ```
* Then -
  * Exit code 1
  * The real `gh` error is surfaced in the output, not an uncaught
    exception

#### 3.4.2 Malformed JSON args is rejected before any gh call
* When -
  ```bash
  pnpm task --dev-testing gh findOpenPR -i << EOF
  {not valid json
  EOF
  ```
* Then -
  * No `gh` call was made
  * Exit code 2
