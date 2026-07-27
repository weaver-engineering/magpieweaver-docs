# Task MAG-46 - real filesystem wrapper

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/deps/fs.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`FileSystemTool` (§2's `ExternalTools.fileSystem`, §4.10 of
`task-phasing-lld.md`), exercised for real via
`pnpm task --dev-testing fs <method> [-i | --args-file <path>]`, per the
grammar fixed in `task-MAG-46-dev-testing-cli-design.md`: `loadConfig`,
`exists`, `readFile`, `writeFile`, `copyFile`, `mkdir`, `readDir`.

## 2. Deliverable
The `--dev-testing` dispatch path (established in MAG-46-01) extended to
route to `fileSystem`, plus the real `FileSystemTool` implementation itself.

### 2.1 Deliverable Notes For Agent
- Reuse the `--dev-testing` parsing/dispatch built in MAG-46-01 — this
  chunk only adds the `fs` branch and the real implementation behind it.
- `loadConfig`'s "walk up from cwd to repo root" behavior needs a fixture
  with a `.task-phases.json` at a known ancestor directory and the command
  invoked from a descendant — assert it finds the right file, not just that
  it doesn't throw.
- Example invocations below use the `-i` stdin form; `--args-file <path>`
  is equivalent per the design doc.

## 3. Required Behaviors
* Reads, writes, copies, and lists real files on disk.
* `loadConfig` walks up from cwd to find `.task-phases.json`.
* Each method surfaces real filesystem errors (missing file, permission
  denied) as a failed result, not an uncaught exception.

### 3.1 exists / readFile / writeFile
#### 3.1.1 exists — present and absent
* Given - `docs/tasks/AAA-001/task-AAA-001.md` exists on disk
* When -
  ```bash
  pnpm task --dev-testing fs exists -i << EOF
  {"path": "docs/tasks/AAA-001/task-AAA-001.md"}
  EOF
  ```
* Then - the reported value is `true`
* When -
  ```bash
  pnpm task --dev-testing fs exists -i << EOF
  {"path": "docs/tasks/AAA-999/task-AAA-999.md"}
  EOF
  ```
* Then - the reported value is `false`

#### 3.1.2 writeFile then readFile round-trips real content
* Given - `docs/tasks/AAA-001/` exists and is empty
* When -
  ```bash
  pnpm task --dev-testing fs writeFile -i << EOF
  {"path": "docs/tasks/AAA-001/note.md", "content": "hello"}
  EOF
  ```
* Then - the file exists on disk with content `hello`
* When -
  ```bash
  pnpm task --dev-testing fs readFile -i << EOF
  {"path": "docs/tasks/AAA-001/note.md"}
  EOF
  ```
* Then - the reported value is exactly `hello`

### 3.2 copyFile / mkdir / readDir
#### 3.2.1 mkdir creates parent directories as needed
* Given - `docs/tasks/AAA-002/` does not exist
* When -
  ```bash
  pnpm task --dev-testing fs mkdir -i << EOF
  {"path": "docs/tasks/AAA-002/nested"}
  EOF
  ```
* Then - both `docs/tasks/AAA-002/` and `docs/tasks/AAA-002/nested/` exist

#### 3.2.2 copyFile creates parent directories as needed
* Given
  * `templates/task-template.md` exists
  * `docs/tasks/AAA-003/` does not exist
* When -
  ```bash
  pnpm task --dev-testing fs copyFile -i << EOF
  {"src": "templates/task-template.md", "dest": "docs/tasks/AAA-003/task-AAA-003.md"}
  EOF
  ```
* Then
  * `docs/tasks/AAA-003/` is created
  * `docs/tasks/AAA-003/task-AAA-003.md` exists with the template's content

#### 3.2.3 readDir lists direct entries only
* Given
  * `docs/tasks/` contains `AAA-001/` and `AAA-002/`
  * `docs/tasks/AAA-001/` contains a nested file
* When -
  ```bash
  pnpm task --dev-testing fs readDir -i << EOF
  {"path": "docs/tasks"}
  EOF
  ```
* Then - the reported list is exactly `["AAA-001", "AAA-002"]` — the nested
  file is not included

### 3.3 loadConfig
#### 3.3.1 Finds config in the repo root from a nested cwd
* Given
  * `.task-phases.json` exists at the repo root with a custom
    `tasks.docs` value
  * The command is invoked from a subdirectory several levels deep
* When - `pnpm task --dev-testing fs loadConfig` (no args — `loadConfig()`
  takes none; it discovers its own path by walking up from cwd)
* Then - the reported config's `tasks.docs` matches the repo-root file's
  value, not any default

#### 3.3.2 Missing config is reported, not thrown as a hard crash
* Given - no `.task-phases.json` exists anywhere from cwd to repo root
* When - `pnpm task --dev-testing fs loadConfig`
* Then - the command reports that no config file was found (this is a raw
  wrapper result; graceful-degradation-to-defaults is `init`'s concern,
  covered in MAG-46-18, not this wrapper's)

### 3.4 Error Handling
#### 3.4.1 readFile on a missing path
* Given - `docs/tasks/AAA-999/missing.md` does not exist
* When -
  ```bash
  pnpm task --dev-testing fs readFile -i << EOF
  {"path": "docs/tasks/AAA-999/missing.md"}
  EOF
  ```
* Then -
  * Exit code 1
  * The real filesystem error is surfaced in the output

#### 3.4.2 Malformed JSON args is rejected before any fs call
* When -
  ```bash
  pnpm task --dev-testing fs readFile -i << EOF
  {not valid json
  EOF
  ```
* Then -
  * No filesystem call was made
  * Exit code 2
