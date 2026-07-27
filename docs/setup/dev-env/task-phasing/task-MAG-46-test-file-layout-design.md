# Task MAG-46 - Test file layout

**Companion to:** `task-MAG-46.md`
**Status:** design note, not a TDD spec — referenced by every spec doc in
the backlog (00 through 18, plus 10.01 and 11.01). No Given/When/Then
here; this pins down where each spec's tests actually live, so "which spec
covers which behavior" (the system-behaviors doc) and "which test file
implements which spec" are reconcilable in both directions.

## 1. Root path
`test/packages/task-phases/`, matching how `gate-checks`'s own tests are
already organized in the real codebase (confirmed against the actual
repo, not assumed).

## 2. One directory per source file, not per spec chunk
Directories mirror `commands/*.ts`'s actual filenames — **not** the
`Command` string union's values, and **not** spec-doc numbering:

```
test/packages/task-phases/
  init/
  status/
  list/
  promote/
  wip/
  task/       # NOTE: commands/task.ts implements the `ref` command
              # (`pnpm task <ref>`) — the directory follows the source
              # filename, not the CLI command name. Easy to get this one
              # wrong; called out explicitly for that reason.
  deps/       # git/gh/fs/gate-check — the --dev-testing-exercised wrappers
```

`lib/repo-state.ts` and `lib/task-doc.ts` get **no directory of their
own** — they have no system-level behavior reachable on their own (this
was the whole reason `repo-state.ts` isn't independently spec-able, back
at the start of this phasing exercise); they're exercised entirely as an
implementation detail behind the command-level test files above.

Every command directory exists from the start, even `list`/`wip` which
currently have only one chunk each — so a future addition (e.g. the
parked `list --check`) adds a file, not a restructure.

## 3. One file per spec-doc-authored behavior group
A spec chunk that only ever touches one command gets one file, named
after the chunk's own subject with the command name dropped (it's already
the directory):

| Spec doc | Test file |
|---|---|
| MAG-46-01 (dev-testing git basics) | `deps/git-basics.test.ts` |
| MAG-46-02 (dev-testing fs) | `deps/fs.test.ts` |
| MAG-46-03 (dev-testing gh basics) | `deps/gh.test.ts` |
| MAG-46-04 (status not-initialised) | `status/not-initialised.test.ts` |
| MAG-46-05 (init creates branches) | `init/create.test.ts` |
| MAG-46-06 (status not-started/wip) | `status/not-started-and-work-in-progress.test.ts` |
| MAG-46-07 (wip commit) | `wip/commit.test.ts` |
| MAG-46-08 (dev-testing gate-check) | `deps/gate-check.test.ts` |
| MAG-46-09 (status check ready/blocked) | `status/check-ready-or-blocked.test.ts` |
| MAG-46-10 (promote forked) | `promote/forked.test.ts` |
| MAG-46-10.01 (promote rebased-forward) | `promote/rebased-forward.test.ts` |
| MAG-46-12 (status merged-pending-pull) | `status/merged-pending-pull.test.ts` |
| MAG-46-13 (dev-testing git rebase) | `deps/git-rebase-forward.test.ts` |
| MAG-46-14 (promote pulled-and-rebased) | `promote/pulled-and-rebased.test.ts` |
| MAG-46-16 (list) | `list/active-tasks.test.ts` |
| MAG-46-17 (ref switch) | `task/switch.test.ts` |

MAG-46-00 (scaffolding) has **no test file** — it's a `quick` task, no
test-gate applies; its completion checklist is what's verified instead.

## 4. When one spec chunk names more than one command: split by which
command is actually invoked
Three chunks (MAG-46-11, MAG-46-11.01, MAG-46-15, MAG-46-18) each name
more than one command in their own title. Rather than picking one
directory arbitrarily, **split by the command literally invoked in each
Given/When/Then block's `When -` line**:

| Spec doc | Section(s) | Test file |
|---|---|---|
| MAG-46-11 | §3.1, §3.3 (`promote` raises/re-reports the PR) | `promote/pr-raised.test.ts` |
| MAG-46-11 | §3.2, §3.4 (`status` reports `awaiting-pr`) | `status/awaiting-pr.test.ts` |
| MAG-46-11.01 | §3.1–3.3 (`promote` on the quick route) | `promote/quick-route-pr-raised.test.ts` |
| MAG-46-11.01 | §3.4 (`status` on the quick route) | *adds a case to* `status/awaiting-pr.test.ts` |
| MAG-46-15 | §3.1, §3.2 (`status` derives the state) | `status/merged-pending-cleanup.test.ts` |
| MAG-46-15 | §3.3–3.6 (`promote` performs cleanup) | `promote/cleaned-up.test.ts` |
| MAG-46-18 | §3.1–3.5 (`init` flag variants) | `init/flag-variants.test.ts` |
| MAG-46-18 | §3.6–3.7 (`status --fix`) | `status/fix.test.ts` |

**One exception to the split-by-command rule:** a trailing Given/When/Then
that only re-checks state via `status` to confirm another command's side
effect — rather than independently exercising `status`'s own derivation
logic — stays with the command actually under test. MAG-46-15 §3.5 ("ref
reports `not-initialised` after cleanup") is exactly this: it's verifying
`promote`'s cleanup actually happened, not testing `status` in its own
right, so it stays in `promote/cleaned-up.test.ts` rather than being
pulled into the `status` file.

## 5. When a later gap-closing patch adds sections to an existing spec doc
The section goes in the **same test file** as the rest of that spec doc,
following whichever command its own `When -` line invokes per §4 above.
This already happened several times in this backlog — e.g. MAG-46-06
gained §3.5/§3.6/§3.7 (ancestry-staleness fallback, `branchMismatch`,
WIP-marked head commit) when gaps were closed, and all three stay in
`status/not-started-and-work-in-progress.test.ts` alongside the original
four cases, not a new file. The spec doc and its test file grow together
as the same unit — a patch to one is a patch to the other, never a
reason to fork a second file.

## 6. Required file header
Every test file opens with a comment citing what it implements, so the
system-behaviors coverage matrix is `grep`-able directly out of the test
tree instead of only living in a hand-maintained doc:

```ts
// Implements: task-MAG-46-06-status-not-started-and-work-in-progress-spec.md
// System behaviors: 1.5.2, 1.5.3, 1.5.10, 1.6, 1.10

describe('status: not-started / work-in-progress', () => {
  it('reports not-started for spec/{ref} with no commits beyond main (§3.1)', () => { ... });
  it('falls back to phase=spec when the ancestry check fails (§3.5)', () => { ... });
  // ...
});
```

Each `it()` description should reference the spec section it implements
(`§3.x`) — cheap to add, and it's what lets a reviewer jump from the
system-behaviors doc's spec reference straight to the matching test
without re-deriving which `it()` block is which.

When a test file draws from more than one spec doc (per §5's growth rule,
or a §4 split that later gains its own patches), list every spec doc it
implements, one per line, and the full set of system-behavior IDs across
all of them — not just the ones added most recently.

## 7. Full current mapping (Appendix)
See `task-MAG-46-system-behaviors.md` Appendix C for the same information
presented the other direction — spec doc → test file — kept alongside the
behavior-ID matrix so the two documents stay reconcilable without either
one needing to duplicate the other's full content.
