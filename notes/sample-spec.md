# Task MAG-101 — Specification

**Companion to:** `task-MAG-101.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

---

## 1. Interface under test

```typescript
// packages/gitdatastore/src/index.ts
interface BranchingDataStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(directory: string): Promise<string[]>;
  commit(message: string): Promise<string>;
  revert(commitHash: string): Promise<void>;
}

interface GitDataStoreOptions {
  workspaceRoot: string; // absolute path to the per-user workspace root
}

class GitDataStore implements BranchingDataStore {
  constructor(options: GitDataStoreOptions);
  // ...
}
```

`commit` and `revert` are out of scope for this task (see task doc §4) and
may throw a `NotImplementedError` unconditionally. Tests for `commit` and
`revert` are explicitly **not** required by this spec — do not write tests
asserting their behaviour beyond confirming they exist on the class shape,
if at all.

## 2. Required behaviours (system-level, testable)

### 2.1 `write` then `read` round-trip
- **Given** a `GitDataStore` instance rooted at an empty temp workspace,
  **when** `write('characters/hero.json', '{"name":"Hero"}')` is called and
  then `read('characters/hero.json')` is called,
  **then** the read resolves to exactly `'{"name":"Hero"}'`.

### 2.2 `write` creates intermediate directories
- **Given** a workspace with no `characters/` directory yet,
  **when** `write('characters/hero.json', '...')` is called,
  **then** the call succeeds and the directory is created as needed (no
  requirement for the caller to pre-create subdirectories).

### 2.3 `write` overwrites existing content
- **Given** an entity file already written once,
  **when** `write` is called again on the same path with different
  content,
  **then** a subsequent `read` returns the new content, not the old.

### 2.4 `read` on a missing file fails distinguishably
- **Given** a path that has never been written,
  **when** `read` is called on it,
  **then** the returned promise rejects with an error whose type or code
  distinctly identifies "file not found" (e.g. a dedicated error class or a
  `code` property), distinguishable in a test assertion from a generic
  thrown error.

### 2.5 `list` returns exactly the files present
- **Given** a directory containing three entity files and one
  subdirectory,
  **when** `list('characters')` is called,
  **then** the resolved array contains exactly the three file paths
  (relative to the workspace root, e.g. `characters/hero.json`), and its
  behaviour with respect to the subdirectory (included as an entry,
  recursed into, or excluded) is **implementer's choice — pick one and
  assert it explicitly in the test**, since this spec does not mandate a
  specific recursion behaviour.

### 2.6 `list` on an empty or missing directory
- **Given** a directory that exists but is empty,
  **when** `list` is called on it,
  **then** it resolves to an empty array (not an error).
- **Given** a directory that does not exist at all,
  **then** `list` either resolves to an empty array or rejects with a
  "not found" error — **implementer's choice, pick one and assert it
  explicitly.**

### 2.7 Path traversal is rejected
- **Given** a `GitDataStore` rooted at workspace `W`,
  **when** `read`, `write`, or `list` is called with a path containing
  `../` segments (or an absolute path) that would resolve outside `W`,
  **then** the call rejects with a distinguishable "invalid path" error
  **before** any filesystem access outside `W` is attempted.
- This must be tested for at least: `read('../../etc/passwd')`,
  `write('../outside.json', 'x')`, and `list('..')`.

## 3. Non-functional / test-design requirements

- Tests are **system-level** (Guard Rails §"Why mechanical, not
  judgment-based"): they exercise `GitDataStore` through its public
  `BranchingDataStore`-shaped surface only. Do not add tests that reach
  into private/internal methods.
- Each test must use an isolated temp directory per test (or per suite,
  with cleanup), so tests do not share state or leak into the repo
  working tree.
- No mocking of the filesystem is required or expected — this is a real,
  local filesystem operation; using a real temp directory is the correct
  approach, not a mock.
- Diff coverage target for the Build phase: 95%+ on new/changed lines
  (Guard Rails §2), ~80–85% overall for the package.

## 4. Explicit non-requirements (do not test or implement)

- No Git CLI invocation, no `.git` directory interaction of any kind.
- No `commit`/`revert` behavioural tests (§1 above).
- No multi-user, multi-workspace, or authentication/authorization logic —
  `workspaceRoot` is provided directly to the constructor by the caller.
- No performance/benchmark assertions.

## 5. Definition of done for this task

- All behaviours in §2 have corresponding, passing tests.
- `commit`/`revert` exist on the class (compile-time shape only) and throw
  `NotImplementedError` if called, with no test requirement beyond that.
- No test added in the Test phase was modified during the Build phase.
- Coverage thresholds in §3 are met.
