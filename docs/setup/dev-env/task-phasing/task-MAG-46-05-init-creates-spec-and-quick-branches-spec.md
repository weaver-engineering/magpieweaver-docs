# Task MAG-46 - `task init` creates the canonical branch and task doc

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/init/create.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task init <ref> [--quick] [--title <title>] [--json]`, against
injected `git`/`fileSystem` test doubles. `--doc`, `--specs`, and
`--wip`-carried-forward on `init` are explicitly out of scope for this
chunk (MAG-46-18).

## 2. Deliverable
`init`'s happy path for both routes: normal (creates `spec/{ref}` off
`main`) and `--quick` (creates `task/{ref}` off `main`), each scaffolding
`docs/tasks/{ref}/task-{ref}.md` from the template with `--title`
substituted in. Also the one hard, unconditional block from §3.14: an
existing branch for `{ref}` with genuinely unmerged commits refuses `init`
outright, with no override.

### 2.1 Deliverable Notes For Agent
- This is what MAG-46-06 (status against `spec/{ref}`/`task/{ref}`) needs
  to exist first — both branch-creation routes must land in this chunk,
  not just one, even though they're two flags on one command.
- `--specs`/`--doc` are convenience-only per §3.8 and are deliberately
  deferred; this chunk's template-scaffolding only needs `--title`.
- The existing-ref decision tree's other branches (doc already exists,
  branch exists but merged/reusable) are also deferred to MAG-46-18 — this
  chunk only needs "nothing exists yet" and "something unmerged exists."

## 3. Required Behaviors
* `init <ref> --title <title>` creates `spec/{ref}` off `main` and scaffolds
  the task doc from the template.
* `init <ref> --quick --title <title>` creates `task/{ref}` off `main`
  instead.
* `init` on a ref whose branch already exists with unmerged commits fails
  outright, unconditionally.
* `init` checks `main` is up to date with `origin` before branching.
* `init` requires at least one of `--title`/`--doc`; neither given fails
  with an invalid-argument exit before any branch/doc creation.

### 3.1 Normal route creates spec/{ref}
* Given
  * `git.currentBranch()` returns `"main"`
  * `git.isDirty()` returns `false`
  * `git.branchExists("spec/AAA-001", ...)` returns `false` (local and
    remote)
  * `fileSystem.exists("docs/tasks/AAA-001")` returns `false`
  * `fileSystem.loadConfig()` returns the documented defaults
* When - `pnpm task init AAA-001 --title "Do a thing"`
* Then -
  * `git.createBranch("spec/AAA-001", "main")` was called
  * `fileSystem.mkdir("docs/tasks/AAA-001")` was called
  * `fileSystem.writeFile(...)` was called for
    `docs/tasks/AAA-001/task-AAA-001.md` with the template content, `${ref}`
    replaced with `AAA-001` and `${title}` replaced with `"Do a thing"`
  * The reported `InitCommandResult.canonicalBranch` is `"spec/AAA-001"`
  * Exit code 0

### 3.2 --quick creates task/{ref} instead of spec/{ref}
* Given
  * As §3.1, but for ref `AAA-002`
* When - `pnpm task init AAA-002 --quick --title "Do a small thing"`
* Then -
  * `git.createBranch("task/AAA-002", "main")` was called
  * `git.createBranch("spec/AAA-002", ...)` was **not** called
  * The reported `InitCommandResult.canonicalBranch` is `"task/AAA-002"`
  * Exit code 0

### 3.3 Existing unmerged branch blocks outright
* Given
  * `git.currentBranch()` returns `"build/ABC-123"`
  * `git.isDirty()` returns `true` (uncommitted changes present)
  * No `--wip` flag is given
* When - `pnpm task init AAA-003 --title "Do a thing"`
* Then -
  * `git.createBranch(...)` was **not** called
  * A message states there is work in progress and no `--wip` instruction
    was given
  * Exit code 1
  * The pre-existing `build/ABC-123` state is untouched

### 3.4 main must be current before branching
* Given
  * `git.currentBranch()` returns `"main"`
  * `git.isDirty()` returns `false`
  * Local `main`'s HEAD differs from `origin/main`'s HEAD after `fetch()`
* When - `pnpm task init AAA-004 --title "Do a thing"`
* Then -
  * `git.createBranch(...)` was **not** called
  * A message states `main` is not up to date with `origin`
  * Exit code 1

### 3.5 One of --title/--doc is required
* Given
  * `git.currentBranch()` returns `"main"`, `git.isDirty()` returns `false`
  * Neither `--title` nor `--doc` is given
* When - `pnpm task init AAA-005`
* Then -
  * `git.createBranch(...)` was **not** called
  * A message states one of `--title`/`--doc` is required
  * Exit code 2 (invalid argument — caught before any branch/doc creation
    is attempted, not a mid-command failure)
