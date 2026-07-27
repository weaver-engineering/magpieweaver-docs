# Task MAG-46 - `task status` reports `not-initialised`

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/status/not-initialised.test.ts`.
See `task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`pnpm task status [--ref <ref>] [--json]`, the first real path through
`cli.ts` → `registry.ts` → `commands/status.ts`, against an injected
`ExternalTools` whose `git`/`github` members are test doubles (per §2's
`TaskPhasingFn(tools, args)` signature) — no real git/gh/fs calls in this
chunk.

## 2. Deliverable
`status` derives and reports `TaskState = "not-initialised"` for a ref that
has no branch of any kind — the base case of §3.2's derivation pipeline,
with every other branch of that pipeline still unimplemented.

### 2.1 Deliverable Notes For Agent
- This is the first system-level behavior with any observable output at
  all, so it's also where the minimal shape of `TaskStatus`, `cli.ts`'s
  exit-code contract (§4.1), and `--json` serialization get proven for
  real, not just this one state.
- Given blocks describe exactly what each mocked tool method returns —
  every interaction with `ExternalTools` needs an explicit assertion, per
  the Architecture Definition Document's Guard Rails.
- `git.fetch()` is called unconditionally before any derivation, per §1.1
  — assert it's called even though this chunk's fixtures don't depend on
  its result.

## 3. Required Behaviors
* Reports `not-initialised` when no `spec/{ref}`, `test/{ref}`,
  `build/{ref}`, or `task/{ref}` branch exists, locally or on `origin`.
* Always fetches before deriving.
* Exits 0 for a successful (even if `not-initialised`) status read.
* `--ref <ref>` derives status for a different ref without switching
  branches.
* Exit code is a strict, mechanical function of `success`: `0` when true,
  `2` for invalid-argument/usage errors caught before any command logic
  runs, `1` for every other unsuccessful result.

### 3.1 No branches exist anywhere
* Given
  * `git.fetch()` resolves normally
  * `git.branchExists("spec/AAA-001", ...)`,
    `("test/AAA-001", ...)`, `("build/AAA-001", ...)`,
    `("task/AAA-001", ...)` all return `false`, local and remote
  * `github.findMergedPR(...)` and `github.findOpenPR(...)` are not
    expected to be called (nothing to check a PR for)
  * `git.currentBranch()` returns `"main"`
* When - `pnpm task status --ref AAA-001`
* Then -
  * `git.fetch()` was called exactly once
  * The reported `TaskStatus.phase` is `null`
  * The reported `TaskStatus.state` is `"not-initialised"`
  * Exit code 0

### 3.2 Current checked-out branch, no --ref
* Given
  * `git.currentBranch()` returns `"main"`
  * No phase branch exists for any ref derivable from `"main"`
* When - `pnpm task status`
* Then -
  * The reported `TaskStatus.state` is `"not-initialised"`
  * The reported `TaskStatus.ref` reflects that no ref could be derived
    from the current branch (no attempt is made to derive a ref from
    `main` itself)

### 3.3 --json output shape
* Given - the fixture from §3.1
* When - `pnpm task status --ref AAA-001 --json`
* Then -
  * Standard out contains only a single JSON document (no human-readable
    prose interleaved)
  * That document's `result.taskStatus.state` is `"not-initialised"`
  * That document's top-level `success` is `true`

### 3.4 Exit code is a strict, mechanical function of `success` (general rule)
Every other spec in this backlog asserts exit codes correctly *within its
own scenarios*, but no chunk independently proves the mapping rule itself
(LLD §4.1) as a cross-cutting property, decoupled from any one command's
logic. This section closes that gap here, since `status`'s dispatch path
is the first (and simplest) one available to prove it against.
* Given
  * A test double command result is fabricated with `success: true`
    (reusing this chunk's §3.1 fixture is sufficient — its own logic
    happens to produce one)
* When - the CLI's `run(argv, tools)` entry point processes that result
* Then - the process exits `0`
* Given
  * A test double command result is fabricated with `success: false` and
    no invalid-argument condition (e.g. a hypothetical blocked/refused
    outcome, reusing MAG-46-09 §3.4's `checkRefused` fixture is a
    convenient real example already available by the time this section is
    implemented)
* When - the CLI's `run(argv, tools)` entry point processes that result
* Then - the process exits `1`
* Given - a malformed/unrecognised command or flag, caught before any
  command's own logic runs (e.g. MAG-46-00's "unrecognised command"
  case, or MAG-46-17 §3.4's invalid-ref case)
* When - the CLI parses it
* Then - the process exits `2`, distinctly from the `1` case above — the
  distinction between "ran but didn't deliver" (`1`) and "never validly
  ran at all" (`2`) is the property under test here, not just that both
  are nonzero
