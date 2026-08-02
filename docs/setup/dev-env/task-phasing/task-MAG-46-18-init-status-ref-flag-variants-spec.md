# Task MAG-46 - remaining `init`/`status`/`ref` flag variants

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** split by which command each section invokes (per
`task-MAG-46-test-file-layout-design.md` §4) —
§3.1–3.5 (`init` flag variants) → `test/packages/task-phases/init/flag-variants.test.ts`;
§3.6/§3.7 (`status --fix`) → `test/packages/task-phases/status/fix.test.ts`.

## 1. Interface Under Test
The remaining documented flags across `init`, `status`, and `<ref>` that
earlier chunks deliberately deferred: `init --doc`/`--specs`/`--wip`
(carry-forward), `status --fix`, and graceful degradation on a missing
`.task-phases.json` — against injected `git`/`fileSystem` test doubles.

## 2. Deliverable
- `init --doc <path>` copies the given path in as the task doc instead of
  scaffolding from the template.
- `init --specs <path>...` copies each given path in as a spec doc.
- `init --wip [title] [message]` commits pre-existing WIP before creating
  the new branch, rather than blocking (contrast with MAG-46-05 §3.3's
  hard block).
- Every `--doc`/`--specs` deviation from the happy path (path doesn't
  exist, name collision, etc.) warns and continues rather than aborting
  `init` (§3.8).
- A missing `.task-phases.json` warns and falls back to every documented
  default in `TaskPhasesConfig` (§2), rather than failing `init`.
- `status --fix [branch]` checks out the canonical branch when there's a
  mismatch, optionally committing WIP first.

### 2.1 Deliverable Notes For Agent
- **`--doc`/`--specs`/`--wip` extend `lib/task-doc.ts`'s
  `scaffoldTaskDoc()`** (LLD §4.6) — add the copy-instead-of-template path
  and multi-spec import there, not as `init.ts`-local branching around the
  existing call. **`status --fix` reads its target branch from
  `lib/repo-state.ts`'s `deriveRepoState()`** (already used by `status`'s
  existing derivation) — it doesn't re-derive the canonical branch itself.
- These are "helper conveniences, not core requirements" (§3.8) — the
  required behavior in every failure sub-case is "warn and continue," not
  any specific recovery logic; don't over-engineer past that.
- `--wip` carried forward on `init` must commit **before** branch creation
  (§3.8's example: `Handling WIP...` happens before `Check main is up to
  date`) — assert the ordering, not just that both happened.

## 3. Required Behaviors
* `--doc <path>` copies the given doc in place of the template.
* `--specs <path>...` copies each given spec doc in.
* `--wip` on `init` commits pre-existing WIP before branching, rather than
  blocking.
* A bad `--doc`/`--specs` path warns and continues, doesn't fail `init`.
* A missing config file warns and falls back to documented defaults.
* `status --fix` switches to the canonical branch on a mismatch.

### 3.1 --doc copies a given path as the task doc
* Given
  * `fileSystem.exists("path/to/custom-note.md")` returns `true`
  * No task doc yet exists for `AAA-003`
* When - `pnpm task init AAA-003 --doc path/to/custom-note.md`
* Then -
  * `fileSystem.copyFile("path/to/custom-note.md",
    "docs/tasks/AAA-003/task-AAA-003.md")` was called
  * The template-scaffolding path from MAG-46-05 was **not** used

### 3.2 --specs copies each given spec doc in
* Given - two valid spec doc paths are given
* When - `pnpm task init AAA-003 --title "x" --specs a-spec.md b-spec.md`
* Then -
  * `fileSystem.copyFile` was called once per given path, into
    `docs/tasks/AAA-003/` with the `task-AAA-003-NN-spec.md` naming
    convention
  * `InitCommandResult.specDocPaths` has length 2

### 3.3 --wip carries forward pre-existing work, doesn't block
* Given
  * `git.currentBranch()` returns `"build/ABC-123"`, `git.isDirty()`
    returns `true`
* When - `pnpm task init AAA-003 --wip "A PoC" "No longer required" --title "x"`
* Then -
  * `git.commitAll(...)` was called **before** `git.createBranch(...)`
  * `InitCommandResult.wipCarriedForward` is `true`
  * Exit code 0 (contrast with MAG-46-05 §3.3, where the identical dirty
    state with **no** `--wip` fails outright)

### 3.4 A bad --doc path warns and continues
* Given - `fileSystem.exists("missing.md")` returns `false`
* When - `pnpm task init AAA-004 --doc missing.md --title "x"`
* Then -
  * `init` still creates the branch and completes successfully
  * A warning message names the missing path
  * The template-scaffolding fallback runs instead, since `--title` is
    also given
  * Exit code 0

### 3.5 Missing config falls back to documented defaults
* Given - `fileSystem.loadConfig()` rejects / reports no config found
* When - `pnpm task init AAA-005 --title "x"`
* Then -
  * A warning states no `.task-phases.json` was found
  * The task dir is created at the default `docs/tasks/` location, named
    `task-AAA-005` per the default `dirName` pattern
  * Exit code 0

### 3.6 status --fix switches on mismatch
* Given
  * Canonical branch for the current task is `"build/AAA-123"`
  * `git.currentBranch()` returns `"test/AAA-123"`
  * `git.isDirty()` returns `false`
* When - `pnpm task status --fix`
* Then -
  * `git.checkout("build/AAA-123")` was called
  * `StatusCommandResult.fixed` is `true`

### 3.7 status --fix is a no-op when already canonical
* Given - `git.currentBranch()` already equals the canonical branch
* When - `pnpm task status --fix`
* Then -
  * `git.checkout(...)` was **not** called
  * `StatusCommandResult.fixed` is `false`
