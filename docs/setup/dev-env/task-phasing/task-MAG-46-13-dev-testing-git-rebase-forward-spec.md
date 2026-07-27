# Task MAG-46 - real `rebase()` / amend-and-roll-forward primitive

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/deps/git-rebase-forward.test.ts`.
See `task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`GitTool.rebase(branch, ontoRef)` (§4.8, §3.5, Appendix §3.5.a/§3.5.b),
plus `mergeBase` and `isAncestor`, exercised for real via `pnpm task
--dev-testing git <method> [-i | --args-file <path>]` (the entry point and
grammar from MAG-46-01 / the design doc). This is the single riskiest
primitive in the whole design — every case below needs a real repository
fixture, not a mock, since a force-push-adjacent rewrite is exactly the
kind of operation that must be proven against real git behavior before
`promote` is allowed to call it unattended (MAG-46-14, MAG-46-10.01 both
depend on this).

## 2. Deliverable
A real, working `rebase()` covering all three scenarios named in §3.5: the
spec-amended-under-test case, the build-reorder-after-superseded-merge
case, and the main-drift case — including its commit-count precondition
and conflict reporting, without attempting to auto-resolve anything.

### 2.1 Deliverable Notes For Agent
- The commit-count precondition is checked *before* any rewrite is
  attempted — assert that a real `unexpected-commit-count` case leaves the
  branch completely untouched (still on its original commit), not
  partially rebased.
- The build-reorder case's `upstream` is the **prior** merged PR's
  `mergeCommitOid`, not `headRefOid` (§4.8's own note) — the fixture for
  that case needs two real merged PRs on the same base/head pair
  (superseded-merge), which MAG-46-03 already proved `findMergedPRs`
  reports in full.
- Conflict reporting must surface the real conflict, then leave the
  repository in whatever state `git rebase` itself leaves it in (an
  in-progress rebase) — don't attempt to auto-abort it; that's a decision
  for `promote`'s own error handling, not this primitive.
- `rebase(branch, ontoRef)` takes exactly two named arguments — the
  envelope is always `{"branch": "...", "ontoRef": "..."}`; `ontoRef` must
  be a concretely resolvable ref at invocation time (a branch name or a
  remote-tracking ref), never a placeholder.

## 3. Required Behaviors
* Rebases a branch with exactly one unique commit onto a new base,
  force-push-ready.
* Refuses (reports `unexpected-commit-count`) without rewriting anything
  when the branch has zero or more than one unique commit.
* Reports `conflict` with details when a real conflict occurs, without
  auto-resolving.
* Correctly derives `upstream` for all three named scenarios.

### 3.1 spec-amended-under-test: ordinary rebase-forward
* Given
  * `spec/AAA-001` has an amended commit past `test/AAA-001`'s original
    fork point
  * `test/AAA-001` has exactly one commit of its own beyond that original
    fork point, no conflicting changes with the amendment
* When -
  ```bash
  pnpm task --dev-testing git rebase -i << EOF
  {"branch": "test/AAA-001", "ontoRef": "spec/AAA-001"}
  EOF
  ```
* Then -
  * The reported outcome is `{status: "ok"}`
  * `test/AAA-001`'s one commit now sits on top of `spec/AAA-001`'s amended
    HEAD (confirmed via a real `git log`/`merge-base --is-ancestor` check)

### 3.2 main-drift: spec/{ref} rebased onto a newer main
* Given
  * `main` has advanced past `spec/AAA-002`'s original fork point (other
    tasks merged)
  * `spec/AAA-002` has exactly one commit of its own
* When -
  ```bash
  pnpm task --dev-testing git rebase -i << EOF
  {"branch": "spec/AAA-002", "ontoRef": "main"}
  EOF
  ```
* Then -
  * The reported outcome is `{status: "ok"}`
  * `spec/AAA-002`'s commit now sits on top of `main`'s current tip

### 3.3 build-reorder: onto a fresh test→build merge result
* Given
  * A first Build Gate PR (`test/AAA-003` → `build/AAA-003`) merged;
    `build/AAA-003` then received one build-phase commit
  * `test/AAA-003` was subsequently amended and a second Build Gate PR also
    merged (superseded merge, confirmed via `findMergedPRs` returning 2
    entries — MAG-46-03 §3.3.3)
  * `build/AAA-003`'s one pre-existing build commit doesn't conflict with
    the new test content
  * `origin/build/AAA-003` has been fetched and reflects the state after
    the second merge
* When -
  ```bash
  pnpm task --dev-testing git rebase -i << EOF
  {"branch": "build/AAA-003", "ontoRef": "origin/build/AAA-003"}
  EOF
  ```
* Then -
  * The reported outcome is `{status: "ok"}`
  * The resulting commit order on `build/AAA-003` is `spec, test(new),
    build` — the pre-existing build commit now sits after the fresh merge,
    not before it

### 3.4 Commit-count precondition refuses cleanly
* Given
  * `test/AAA-004` has **two** commits beyond `spec/AAA-004` (an agent
    stacked two `wip` commits without squashing)
* When -
  ```bash
  pnpm task --dev-testing git rebase -i << EOF
  {"branch": "test/AAA-004", "ontoRef": "spec/AAA-004"}
  EOF
  ```
* Then -
  * The reported outcome is `{status: "unexpected-commit-count", expected:
    1, actual: 2, ...}`
  * `test/AAA-004` is completely untouched — still its original two
    commits, not partially rebased

### 3.5 Genuine conflict is reported, not resolved
* Given
  * `spec/AAA-005`'s amendment and `test/AAA-005`'s one commit both modify
    the same line of the same file, incompatibly
* When -
  ```bash
  pnpm task --dev-testing git rebase -i << EOF
  {"branch": "test/AAA-005", "ontoRef": "spec/AAA-005"}
  EOF
  ```
* Then -
  * The reported outcome is `{status: "conflict", details: ...}` containing
    real conflict information from git
  * No commit was force-pushed; the local repository is left mid-rebase
    for a human/agent to resolve manually

### 3.6 Malformed JSON args is rejected before any rebase is attempted
* When -
  ```bash
  pnpm task --dev-testing git rebase -i << EOF
  {not valid json
  EOF
  ```
* Then -
  * No branch is touched
  * Exit code 2
