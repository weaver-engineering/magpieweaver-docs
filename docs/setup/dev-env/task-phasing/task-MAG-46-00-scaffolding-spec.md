# Task MAG-46 - scaffolding

**Companion to:** `task-MAG-46.md`
**Governs phases:** `quick` only — this chunk is deliberately run through
`task init --quick`, not `spec`/`test`/`build`. There is no `test-gate` to
satisfy, so this document is a **deliverable checklist**, not a
Given/When/Then TDD contract like MAG-46-01 onward. It exists mainly so
`00` isn't a silent gap in the task dir's numbering, and so the one thing
this chunk produces — the frozen `ExternalTools`/`FunctionCatalog` shape —
is written down somewhere before every later chunk starts depending on it.

**Test file:** none — this is a `quick` task with no test-gate, so
nothing here drives a failing-then-passing test. Verify against the
Completion Checklist in §3 instead. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
None, in the TDD sense. There's no observable system-level behavior yet —
`cli.ts` doesn't do anything meaningful until a real command exists behind
it (MAG-46-04 is the first one). This chunk is pure plumbing.

## 2. Deliverable
- `packages/task-phases/` scaffolded per §1.2's component layout: `cli.ts`,
  `registry.ts`, empty `commands/`, `lib/`, `deps/` directories.
- `types.ts` populated with the shapes from §2 of `task-phasing-lld.md`:
  `TaskRef`, `Phase`, `PhaseState`, `TaskState`, `TaskStatus`, `Command`,
  every per-command result extension, `ExternalTools`, `GateCheckResult`,
  `FunctionCatalog`.
- `registry.ts` exports an empty `commandRegistry` — no handlers yet, just
  the shape `cli.ts` will dispatch through.
- `cli.ts` parses argv into `{command, args}` and can exit with the
  documented codes (§4.1: `0`/`1`/`2`) even with no real command behind it
  yet — e.g. an unrecognised command name already exits `2`.
- **`cli.ts` exposes a testable entry point, not just a `bin` script** —
  e.g. `run(argv, tools: ExternalTools)` performs all real argv-parsing,
  dispatch, and exit-code logic; the actual `bin` script is a thin call
  `run(process.argv, buildRealTools())`. Automated system tests call
  `run(argv, mockTools)` directly, in-process — same parsing/dispatch/
  exit-code path as real execution, only the tool implementations differ.
  This is the seam every command-level spec from MAG-46-04 onward depends
  on; get the split between "real bin" and "testable run()" right here or
  every later chunk inherits the gap.
- The `--dev-testing <tool> <method> [--args-file <path> | -i] [--json]`
  parsing path itself (not any real tool behind it — that's MAG-46-01/02/
  03/08) is stubbed in here, since every one of those chunks needs it
  already wired. Its exact grammar/argument-encoding/exit-code rules are
  specified separately in `task-MAG-46-dev-testing-cli-design.md` — this
  chunk implements that design, not a fresh interpretation of it.

### 2.1 Deliverable Notes For Agent
- Resist the temptation to implement any actual git/gh/fs/gate-check logic
  here, even trivially — every method on every `ExternalTools` member
  should exist only as a type, not an implementation, until the chunk that
  owns it. Getting this wrong quietly erodes the whole point of the
  reordering: a "helpfully" pre-built stub is exactly the kind of
  untested-code accumulation this phasing is trying to avoid.
- Freeze the `ExternalTools`/`FunctionCatalog` shapes as accurately as
  possible against §2/§4.7.1/§4.8/§4.9/§4.10 of the LLD before moving on —
  every later chunk's Given/When/Then blocks assume these interfaces
  don't change shape out from under them. If a later chunk (as already
  happened with MAG-46-07's file-change-tracking gap) needs to add a
  method, that's a normal, expected revision — flag it there, don't try to
  anticipate every future need here.

## 3. Completion Checklist
(No Given/When/Then — nothing here is asserted against a failing test
first. This is what `init --quick`'s own gate-check, if any, or simply the
architect's review, confirms directly.)

* [ ] `packages/task-phases/` directory layout matches §1.2 exactly.
* [ ] `types.ts` compiles and exports every type named in §2.
* [ ] `registry.ts` exports `commandRegistry` with the correct `Command`
      keys, each currently unimplemented (e.g. throwing "not implemented").
* [ ] `cli.ts` parses argv, dispatches through `registry.ts`, and exits `2`
      on an unrecognised command or malformed flags.
* [ ] `cli.ts`'s argv-parsing/dispatch/exit-code logic lives in a testable
      `run(argv, tools)` function; the `bin` script is a thin wrapper
      around it with real tools constructed.
* [ ] `cli.ts`'s `--dev-testing` parsing follows
      `task-MAG-46-dev-testing-cli-design.md` exactly (grammar, JSON-object
      argument encoding via `--args-file`/`-i`, exit codes) and dispatches
      to a placeholder per tool (`git`/`gh`/`fs`/`gate-check`), each
      currently unimplemented.
* [ ] Nothing under `commands/`, `lib/`, or `deps/` contains real logic —
      directories exist, files (if any) are empty or throw.
