# Task MAG-46 - real gate-check wrapper

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/deps/gate-check.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

**Correction (test approach):** `@magpieweaver/gate-checks` is an
existing, already-thoroughly-tested dependency in this monorepo — it is
not an untested OS primitive like git/fs/gh, so this chunk is *not* one
of the "prove it for real" dev-testing chunks (contrast specs
01/02/03/05.01/13, which genuinely do need real fixtures because they
wrap raw, previously-unproven primitives). The automated test suite
for this chunk must **not** spin up real git repositories and must
**not** exercise the real `pnpm task --dev-testing gate-check <method>`
CLI subprocess — doing so re-tests behavior gate-checks' own package
already exhaustively covers. Instead, call `GateChecksTool.run()` /
`gateFor()` directly at the TypeScript level, with
`@magpieweaver/gate-checks`'s exported `runCheck` function mocked
(`vi.mock("@magpieweaver/gate-checks", ...)`), and assert only that
`GateChecksTool` makes the correct pass-through call (right gate name,
right args, right result shape) — not that gate-checks' own internal
rules produce a particular verdict. The `--dev-testing gate-check` CLI
dispatch branch itself is still a real deliverable (§2) and should still
work end-to-end when exercised manually via `pnpm task --dev-testing
gate-check ...` — that pathway just isn't what the *automated* test
suite drives.

Concretely: `RealGateChecksTool.run(phase, args)` must import and call
`runCheck` from `@magpieweaver/gate-checks`'s public entry point (its
`index.ts`/`package.json` `main`) — **not** reach into
`catalog[gateName].fn(inspectors, args)` and construct the inspectors
bundle itself. That inspector-construction path exists only to support
gate-checks' *own* unit-test mocking; it is not the public contract for
external consumers. `runCheck(gateName, args)` is.

## 1. Interface Under Test
`GateChecksTool` (§2's `ExternalTools.gateChecks`, §4.7/§4.7.1 of
`task-phasing-lld.md`): `run`, `gateFor`. Unit-tested directly against
a mocked `@magpieweaver/gate-checks`, per the Correction above.

## 2. Deliverable
The `--dev-testing gate-check` dispatch branch, plus the real
`GateChecksTool` implementation wrapping `@magpieweaver/gate-checks`'s
public `runCheck` export — proving the `Phase` → `GateName` mapping and
that `run()` calls through to `runCheck` correctly.

### 2.1 Deliverable Notes For Agent
- `@magpieweaver/gate-checks` now exports a real library entry point:
  `runCheck(checkName, args, options?): Promise<GateCheckResult>` (see
  `packages/gate-checks/src/run-check.ts` and `src/index.ts`). Add
  `@magpieweaver/gate-checks` as a real dependency of
  `packages/task-phases/package.json` and import `runCheck` from it —
  do not construct `GitInspectorImpl`/`CoverageInspectorImpl` or index
  into `catalog` yourself.
- `run(phase, args)` itself takes a nested `args` object — so this
  method's `--dev-testing` envelope has an `args` key whose value is
  *itself* the object gate-check receives, e.g.
  `{"phase": "test", "args": {"ref": "AAA-001"}}`. Don't flatten this by
  mistake; the nesting is real, not an artifact of the encoding.
- `run()`'s inner `args` **must** include `ref` explicitly (§4.7.1) —
  assert this is passed through to `runCheck`, since gate-check is
  deliberately decoupled from `task-phases`'s own branch-naming scheme
  and must not infer it.
- `gateFor` is pure and needs no fixture or mock at all — cover it with
  a plain table-driven check across all four `Phase` values.

## 3. Required Behaviors
* `gateFor` maps `spec → test-gate`, `test → build-gate`, `build → main-gate`,
  `quick → main-gate`.
* `run(phase, args)` calls `runCheck` with the gate name `gateFor(phase)`
  maps to, passes `args` through unchanged, and returns whatever
  `GateCheckResult` `runCheck` resolves with, unmodified.

### 3.1 gateFor mapping
Plain table-driven unit test, no mock needed — `gateFor` is pure.
* `gateFor("spec")` → `"test-gate"`
* `gateFor("test")` → `"build-gate"`
* `gateFor("build")` → `"main-gate"`
* `gateFor("quick")` → `"main-gate"`

### 3.2 run() calls runCheck with the mapped gate and passes args through
* Given - `runCheck` is mocked to resolve with a fixed `GateCheckResult`
  (e.g. `{ check: "test-gate", passed: true, args: {}, messages: [],
  violations: [], summary: "ok", values: {} }`)
* When - `gateChecksTool.run("spec", { ref: "AAA-001" })` is called
* Then -
  * The mock `runCheck` was called exactly once with
    `("test-gate", { ref: "AAA-001" })` (i.e. `gateFor("spec")`'s result
    as the check name, and `args` passed through unchanged — including
    `ref`, since gate-check is deliberately decoupled from
    `task-phases`'s own branch-naming scheme and must not infer it)
  * `run()`'s return value is exactly the mocked `GateCheckResult`
    (unmodified pass-through)

### 3.3 run() relays a failing GateCheckResult unmodified
* Given - `runCheck` is mocked to resolve with
  `{ passed: false, violations: ["some real violation message"], ... }`
* When - `gateChecksTool.run("test", { ref: "AAA-002" })` is called
* Then -
  * `run()`'s return value is exactly the mocked (failing)
    `GateCheckResult` — `GateChecksTool` must not alter, swallow, or
    re-summarize `passed`/`violations`, only relay what `runCheck`
    returned

### 3.4 Error Handling
#### 3.4.1 Unknown phase
* When - `gateChecksTool.run("notaphase" as Phase, { ref: "AAA-001" })`
  is called
* Then -
  * Rejects/throws before `runCheck` is called at all (the mock is
    asserted not to have been called)

#### 3.4.2 runCheck rejecting is not swallowed
* Given - the mocked `runCheck` rejects (e.g.
  `mockRejectedValue(new Error("boom"))`)
* When - `gateChecksTool.run(...)` is called
* Then -
  * The rejection propagates out of `run()` unchanged — `GateChecksTool`
    does not catch and reinterpret errors from its dependency

The `--dev-testing gate-check` CLI dispatch branch itself should still
be exercised manually at least once (`pnpm task --dev-testing gate-check
run -i` / `gateFor -i`, per the grammar in
`task-MAG-46-dev-testing-cli-design.md`) to confirm the real wiring
works end-to-end — this is validation, not part of the automated test
suite (see the Correction at the top of this doc).
