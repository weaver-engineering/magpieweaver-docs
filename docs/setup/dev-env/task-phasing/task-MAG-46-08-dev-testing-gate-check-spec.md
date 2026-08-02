# Task MAG-46 - real gate-check wrapper

**Companion to:** `task-MAG-46.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

**Test file:** `test/packages/task-phases/deps/gate-check.test.ts`. See
`task-MAG-46-test-file-layout-design.md`.

## 1. Interface Under Test
`GateChecksTool` (§2's `ExternalTools.gateChecks`, §4.7/§4.7.1 of
`task-phasing-lld.md`), exercised for real via `pnpm task --dev-testing
gate-check <method> [-i | --args-file <path>]` (grammar fixed in
`task-MAG-46-dev-testing-cli-design.md`): `run`, `gateFor`.

## 2. Deliverable
The `--dev-testing gate-check` dispatch branch, plus the real
`GateChecksTool` implementation wrapping the already-in-repo
`@magpieweaver/gate-check` package — proving the `Phase` → `GateName`
mapping and the real `run()` call against actual repository state.

### 2.1 Deliverable Notes For Agent
- `@magpieweaver/gate-check` already exists and is functioning in-repo
  (§4.2) — this chunk is ordinary integration work against a real
  dependency, not speculative interface design.
- `run(phase, args)` itself takes a nested `args` object — so this
  method's `--dev-testing` envelope has an `args` key whose value is
  *itself* the object gate-check receives, e.g.
  `{"phase": "test", "args": {"ref": "AAA-001"}}`. Don't flatten this by
  mistake; the nesting is real, not an artifact of the encoding.
- `run()`'s inner `args` **must** include `ref` explicitly (§4.7.1) —
  assert this is passed through, since gate-check is deliberately
  decoupled from `task-phases`'s own branch-naming scheme and must not
  infer it.
- `gateFor` is pure and needs no repository fixture at all — cover it with
  a plain table-driven check across all four `Phase` values.

## 3. Required Behaviors
* `gateFor` maps `spec → test-gate`, `test → build-gate`, `build → main-gate`,
  `quick → main-gate`.
* `run(phase, args)` invokes the real destination-gate check for `phase`
  against the current working tree and returns the raw `GateCheckResult`
  unmodified.

### 3.1 gateFor mapping
* When -
  ```bash
  pnpm task --dev-testing gate-check gateFor -i << EOF
  {"phase": "spec"}
  EOF
  ```
* Then - the reported value is `"test-gate"`
* When -
  ```bash
  pnpm task --dev-testing gate-check gateFor -i << EOF
  {"phase": "test"}
  EOF
  ```
* Then - the reported value is `"build-gate"`
* When -
  ```bash
  pnpm task --dev-testing gate-check gateFor -i << EOF
  {"phase": "build"}
  EOF
  ```
* Then - the reported value is `"main-gate"`
* When -
  ```bash
  pnpm task --dev-testing gate-check gateFor -i << EOF
  {"phase": "quick"}
  EOF
  ```
* Then - the reported value is `"main-gate"`

### 3.2 run() against a real passing test-gate

**Correction:** the `When` clause originally read `"phase": "test"` — a
typo. `gateFor` (§3.1) maps `test → build-gate`, not `test-gate`; the
`Given`/`Then` below describe checking a *completed spec phase's*
readiness to promote to test (`spec/AAA-001` and `test/AAA-101` both
existing, validated against `test-gate`'s rules), which is the
`spec → test-gate` mapping. Fixed to `"phase": "spec"`.

* Given
  * `spec/AAA-001` and `test/AAA-001` both exist, checked out at
    `test/AAA-001`
  * The repository state genuinely satisfies `test-gate`'s real rules
    (correct commit count, task doc present, etc. — per
    `gate-checks-lld.md`)
* When -
  ```bash
  pnpm task --dev-testing gate-check run -i << EOF
  {"phase": "spec", "args": {"ref": "AAA-001"}}
  EOF
  ```
* Then -
  * The reported `GateCheckResult.check` is `"test-gate"`
  * The reported `GateCheckResult.passed` is `true`
  * `GateCheckResult.args` includes `ref: "AAA-001"`

### 3.3 run() against a real failing gate relays real violations
* Given
  * The checked-out branch genuinely violates one of `build-gate`'s rules
    (e.g. the commit title doesn't start with `{ref}`, per §3.7)
* When -
  ```bash
  pnpm task --dev-testing gate-check run -i << EOF
  {"phase": "test", "args": {"ref": "AAA-002"}}
  EOF
  ```
* Then -
  * The reported `GateCheckResult.passed` is `false`
  * `GateCheckResult.violations` is non-empty and contains the real
    violation message `@magpieweaver/gate-check` itself produced — not a
    message invented by this wrapper

### 3.4 Error Handling
#### 3.4.1 Unknown phase
* When -
  ```bash
  pnpm task --dev-testing gate-check run -i << EOF
  {"phase": "notaphase", "args": {"ref": "AAA-001"}}
  EOF
  ```
* Then -
  * Exit code 2 (invalid argument)

#### 3.4.2 Malformed JSON args is rejected before any gate-check call
* When -
  ```bash
  pnpm task --dev-testing gate-check run -i << EOF
  {not valid json
  EOF
  ```
* Then -
  * No call into `@magpieweaver/gate-check` was made
  * Exit code 2
