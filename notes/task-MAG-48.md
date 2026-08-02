# MAG-48 — extend gate-checks with a real linting check

## The gap

`gate-checks`' `build-gate`/`main-gate` checks run `pnpm -r build` (real
`tsc` compilation) but never run `pnpm -w lint` (eslint). A PR can merge
with real, live lint errors and nothing in the gate pipeline notices.

**Concrete evidence:** [PR #71](https://github.com/weaver-engineering/magpie-weaver/pull/71)
(MAG-46 spec 07, `task wip` implementation) merged with a genuine lint
error — `'ChangedFiles' is defined but never used`
(`test/packages/task-phases/wip/commit.test.ts:47`,
`@typescript-eslint/no-unused-vars`) — and `MainGate` reported green
regardless, since it never ran eslint at all. Found only incidentally,
while verifying an unrelated `task/MAG-40` permission-fix commit against
`pnpm -w lint` locally.

There's also a standing baseline of ~13 pre-existing lint errors already
in the codebase tonight (`packages/task-phases/src/deps/gh.ts`'s missing
`cause` on rethrown errors, several `test/packages/task-phases/deps/*`
files' unused vars / doublequote violations) that every local
verification this session has had to manually eyeball and confirm as
"pre-existing, unrelated" before treating a gate-check run as clean.
That manual step is exactly what a real gate-check should be doing.

## What the task should cover

- A new `lint-check` (or folded into the existing `build`/`build-gate`
  check — needs a design decision) that runs `pnpm -w lint` and reports
  violations the same way `build`/`coverage` already do (messages,
  violations array, `passed` boolean).
- **Almost certainly needs to be scoped to *new* lint errors introduced
  by the commit(s) under test, not every lint error in the whole
  repository** — the existing ~13-error baseline means a check that
  blocks on *any* lint error would immediately block every future PR on
  unrelated pre-existing debt, the same problem `coverage.ts`'s
  new-line-coverage metric was already built to solve for test coverage
  (see `packages/gate-checks/src/coverage-inspector.ts`'s
  `getNewLineCoverage()` for the established pattern: diff the changed
  lines against `git diff`, only count violations on lines actually
  touched by this change). A "new-lint-violations" check that reuses the
  same diff-scoping approach is the natural fit, not a fresh design.
- Needs wiring into both `build-gate.ts` and `main-gate.ts` (and their
  quick-route path in `main-gate.ts`), matching how `build`/`coverage`
  are already wired into both.
- Should probably also close the ~13-error pre-existing baseline at some
  point (either as part of this task or a fast-follow), since a
  new-violations-only check will otherwise let that baseline sit
  unaddressed indefinitely — worth a decision on scope before starting,
  not an assumption either way.

## Context this was found in

Discovered during MAG-46's `task-phases` build-out (specs 07/08, `wip`
and the real `gate-check` wrapper) — a session that also surfaced and
fixed several other real `gate-checks` gaps the same way (the
`deps/*.ts` coverage-measurement blind spot, the `getNewLineCoverage()`
comment/blank-line miscounting bug — both `task/MAG-30` work in the
`magpie-weaver` repo). This is the same class of finding: gate-checks
tooling gaps that only surface once the tooling is actually being
exercised for real, not designed for up front.
