# Task MAG-101 — GitDataStore: Basic Entity Read/Write/List

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:** GitDataStore (`/packages/gitdatastore`)
**Depends on:** none (foundational component, per HLD §1b)
**Related design docs:**
- High Level Design §5 (Storage Tier Isolation — the BranchingDataStore Contract)
- High Level Design §6 (Editing Modes, Commit Granularity & Conflict Resolution)
- Glossary — `BranchingDataStore`, `GitDataStore`

---

## 1. Summary

Implement the first working slice of `GitDataStore`, the concrete
implementation of the `BranchingDataStore` interface (HLD §5). This task
delivers only the **read/write/list** surface against a single, local
per-user workspace — enough for Data Entry Mode (HLD §6.1) to load and edit
an entity. It deliberately excludes commit/revert, multi-branch handling,
and any remote (push/PR) behaviour; those are separate, later tasks.

This is the first task against GitDataStore, so it also establishes the
package's basic scaffolding (module entry point, workspace-root
resolution) that later GitDataStore tasks will build on.

## 2. Why this task, why now

`GitDataStore` has no dependencies on other components (HLD §1b table) and
almost everything else in the system — MagpieEngine's context reads,
Weaver's state mutation writes, Data Entry Mode's PATCH deltas — ultimately
goes through it. Standing up the minimal read/write/list surface first,
without commit/branch complexity, lets those dependent components start
their own design and test work against a real (if partial) implementation
rather than a hand-rolled stub.

## 3. In scope

- Reading a single entity JSON file from a user's workspace directory,
  given its relative path.
- Writing a single entity JSON file to a user's workspace directory
  (create or overwrite).
- Listing the files present in a given directory within the workspace
  (e.g. `characters/`), returning relative paths.
- Basic input validation: rejecting paths that would resolve outside the
  configured workspace root (path traversal protection).

## 4. Explicitly out of scope (do not implement)

- `commit()` / `revert()` (a later task).
- Any Git CLI invocation at all — this task is pure filesystem I/O. Git
  operations are layered on top in a subsequent task.
- Checksum-validated PATCH / write-ahead delta durability (HLD §6.1) — that
  sits above this raw read/write surface, in a later task.
- Multi-user / multi-workspace routing, authentication, or authorization.
- The `MockDataStore` test double (already exists / tracked separately).

## 5. Acceptance criteria (human-readable; see spec doc for testable detail)

- A caller can write an entity's JSON content to a path and read the same
  content back.
- A caller can list the files in a directory and get back exactly the
  files present, as relative paths.
- Attempting to read, write, or list a path that escapes the workspace
  root fails safely (throws), rather than silently operating outside the
  workspace.
- Reading a path that does not exist fails with a clear, distinguishable
  error rather than an ambiguous one.

## 6. Notes for the agent

- Implement against the `BranchingDataStore` interface shape already drafted
  in HLD §5, but this task only needs to make `read`, `write`, and `list`
  real — `commit` and `revert` may be stubbed to throw "not implemented"
  for now so the interface compiles, without being tested or completed
  here.
- Keep this package dependency-free beyond Node's built-in `fs`/`path`
  modules; no Git library dependency should be introduced in this task.
