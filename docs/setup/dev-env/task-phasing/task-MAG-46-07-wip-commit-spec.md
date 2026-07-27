# Task MAG-46 - `task wip` packs away work in progress

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/wip/commit.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task wip [title] [message] [--json]`, against injected `git` test
doubles: `isDirty`, `commitAll`, `push`.

## 2. Deliverable
`wip` commits everything on the current branch with the `{ref}: {title} -
WIP` title convention (§3.12), pushes it, and fails cleanly when the
worktree is already clean rather than manufacturing an empty commit.

### 2.1 Deliverable Notes For Agent
- **Open interface gap, flag rather than silently resolve:** `WipCommandResult`
  needs `filesAdded`/`filesChanged`/`filesDeleted`, but `GitTool` (§4.8) has
  no method that reports which files changed — only `isDirty()` (boolean)
  and `commitAll()` (returns a SHA). This chunk needs a small addition to
  `GitTool`, e.g. `changedFiles(): Promise<{added: string[]; changed:
  string[]; deleted: string[]}>`, backed by `git status --porcelain`
  parsing. Raise this with the architect before implementing rather than
  inventing a shape unilaterally — §4.7.1's own preamble already flags
  these interfaces as first-pass, not settled.
- `wip` never switches branches — assert `git.checkout` is never called.
- The literal `{ref}: {title} - WIP` / `${message} | "work in progress"`
  format from §3.12 is exact; don't paraphrase it in the implementation.
  Confirmed bare-`wip` (no title given) format: `{ref}: - WIP` — see §3.3.

## 3. Required Behaviors
* A dirty worktree is staged, committed with the WIP-marked title, and
  pushed.
* A clean worktree fails outright — no empty commit is created.
* `wip` never changes which branch is checked out.

### 3.1 Commits and pushes real changes
* Given
  * `git.currentBranch()` returns `"task/AAA-123"`
  * `git.isDirty()` returns `true`
  * `git.changedFiles()` returns 2 added, 1 changed, 1 deleted
  * `git.commitAll(...)` resolves to a SHA
* When - `pnpm task wip "A proof of concept" "parked - depending on AAA-234"`
* Then -
  * `git.commitAll` was called with title `"AAA-123: A proof of concept -
    WIP"` and message containing `"parked - depending on AAA-234"`
  * `git.push("task/AAA-123")` was called
  * The reported `WipCommandResult.filesAdded` has length 2, `filesChanged`
    length 1, `filesDeleted` length 1
  * `WipCommandResult.commitSha` equals the SHA `commitAll` resolved to
  * Exit code 0

### 3.2 Clean worktree fails, no commit created
* Given
  * `git.isDirty()` returns `false`
* When - `pnpm task wip`
* Then -
  * `git.commitAll(...)` was **not** called
  * `git.push(...)` was **not** called
  * A message states there is nothing to pack away
  * Exit code 1

### 3.3 Title/message are both optional
* Given - as §3.1, current branch `"task/AAA-124"`
* When - `pnpm task wip`
* Then -
  * `git.commitAll` was called with title exactly `"AAA-124: - WIP"`
    (confirmed bare-`wip` format) and message `"work in progress"` (the
    documented fallback)
  * Exit code 0
