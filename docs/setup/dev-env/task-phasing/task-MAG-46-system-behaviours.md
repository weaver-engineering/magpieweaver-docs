# Task MAG-46 - System Behaviors

**Purpose:** a single catalogue of every required system-level behavior of
`task-phases`, derived directly from `task-phasing-lld.md`, organized for
human review rather than for driving TDD. Each behavior carries an ID, its
LLD source reference, and which spec doc(s) cover it. Appendix A is the
matrix view of the same information, for a fast complete-coverage scan;
Appendix B records this doc's own review history — the gaps a first pass
surfaced, and where each was closed.

**Coverage legend:** ✅ covered · ⚠️ partially covered · ❌ not covered ·
🔧 N/A (quick/scaffolding, no test-gate applies)

---

## 1. Core Behaviors

### 1.1 `--json` output mode
Every command supports `--json`; causes only a single JSON document
(`TaskPhasingResult`) on stdout, no interleaved human prose. (LLD §CLI
surface, §4.1) — ✅ MAG-46-04 §3.3

### 1.2 Exit-code contract
Exit code is a strict, mechanical function of
`TaskPhasingCommandResult.success`: `0` iff `success === true`; `2` for
invalid-argument/usage errors thrown before a command's own logic runs;
`1` for every other unsuccessful result. (LLD §4.1) — ✅ Exercised
correctly in every individual spec's own scenarios throughout the
backlog, **and** now independently proven as a general, cross-cutting
property — MAG-46-04 §3.4

### 1.3 Argument validation / usage errors (exit 2)
Unrecognised command, unknown `--dev-testing` tool/method, malformed
`--dev-testing` JSON args, invalid `TaskRef` format, `init` missing both
`--title`/`--doc` all exit `2` before any command logic runs. (LLD §4.1,
§2's `TaskRef` regex, §3.8) — ✅ MAG-46-00 (checklist), 01 §3.3, 02
§3.4.2, 03 §3.4.2, 05 §3.5, 08 §3.4, 13 §3.6, 17 §3.4

### 1.4 Fetch-before-derive
`git fetch origin` runs unconditionally before any phase/state
derivation. (LLD §3.2 pseudocode, line 1) — ✅ MAG-46-04 §3.1

### 1.5 Phase/state derivation pipeline
The core state machine (LLD §3.2). Split by resulting state:

- **1.5.1 `not-initialised`** — no branch of any kind exists for `{ref}`.
  ✅ MAG-46-04 §3.1/3.2
- **1.5.2 `not-started`** — phase branch exists, no commits beyond its
  parent. Covered for both `spec/{ref}` and `task/{ref}`. ✅ MAG-46-06
  §3.1/3.3
- **1.5.3 `work-in-progress`** — commits exist, head commit not
  WIP-marked. Covered for both routes. ✅ MAG-46-06 §3.2/3.4
- **1.5.4 `ready?` (unresolved)** — commits exist, no PR raised, plain
  `status`/`list` leave it unresolved. ✅ MAG-46-09 §3.1
- **1.5.5 `ready` / `blocked` resolution** — via `gateChecks.run`, only on
  `--check` or `promote`. Covered for both the regular (`test`-phase) and
  quick (`task/{ref}`) routes. ✅ MAG-46-09 §3.2/3.3 (regular), §3.5
  (quick)
- **1.5.6 `awaiting-pr`** — open destination-gate PR, attached to the
  *source* phase. Covered for the regular and quick routes. ✅ MAG-46-11
  §3.2, MAG-46-11.01 §3.4
- **1.5.7 `merged-pending-pull`** — Build Gate PR merged, local
  `build/{ref}` not yet caught up (both the "doesn't exist" and "exists
  but behind" sub-cases). ✅ MAG-46-12 §3.1/3.2/3.3
- **1.5.8 `merged-pending-cleanup`** — Main Gate PR merged, local `main`
  not yet caught up, including the interrupted-cleanup ancestry retrigger.
  ✅ MAG-46-15 §3.1/3.2
- **1.5.9 Merge detection always via `gh`, never SHA/ancestry** — the
  mechanism itself proven for real in MAG-46-03; consistently used as the
  mocked trigger across every status/promote spec. ✅ (MAG-46-03 +
  implicit across 04/06/09/11/11.01/12/15)
- **1.5.10 Ancestry staleness check** (an earlier phase amended after a
  later one forked — derivation falls back to the earlier phase, LLD
  §3.2's closing paragraph) — ✅ `status`'s own reporting of the fallback
  is now proven directly, not just `promote`'s reaction to it — MAG-46-06
  §3.5 (status), MAG-46-10.01 §3.1/§3.2 (promote's reaction)

### 1.6 Canonical branch & `branchMismatch` guard
Every derived `(phase, state)` has a canonical branch; `branchMismatch`
is `currentBranch !== canonicalBranch`. (LLD §3.4) — ✅ the field itself
is now directly asserted (MAG-46-06 §3.6), in addition to `promote`'s
refusal-to-act reaction (MAG-46-10 §3.3) and `status --fix`'s reaction
(MAG-46-18 §3.6/3.7)

### 1.7 Amend-and-roll-forward / rebase-forward mechanism
- **1.7.1 Spec amended under existing test/{ref}** — ✅ MAG-46-10.01 §3.1,
  MAG-46-13 §3.1 (real primitive)
- **1.7.2 `main` drift ahead of `spec/{ref}`/`task/{ref}`** — ✅
  MAG-46-10.01 §3.2/§3.3, MAG-46-13 §3.2 (real primitive)
- **1.7.3 Build-reorder (cascading, `pulled-and-rebased`)** — ✅
  MAG-46-14 §3.2, MAG-46-13 §3.3 (real primitive)
- **1.7.4 `--confirm-rebase` / interactive prompt gate** — ✅ the
  `--json`-mode missing-confirmation refusal is covered (MAG-46-10.01
  §3.4, MAG-46-14 §3.3), and the interactive (`y/N`, no `--json`) path is
  now covered too — MAG-46-14 §3.6 (flagged there as depending on the
  test harness's ability to simulate a TTY/stdin answer — a harness
  capability to confirm, not a spec-content gap anymore)
- **1.7.5 Conflict / unexpected-commit-count reporting** — ✅ both
  outcomes covered at the primitive level (MAG-46-13 §3.4/3.5), at the
  plain-rebase promote level (MAG-46-10.01 §3.5/3.6), and now at the
  combined `pulled-and-rebased` level too — MAG-46-14 §3.4 (conflict),
  §3.5 (unexpected-commit-count)

### 1.8 Final cleanup (branch deletion at Main Gate merge)
Fetch, update local `main`, delete every surviving phase branch, no
confirmation required, tolerant of partial prior deletion. (LLD §3.6) —
✅ covered for the regular route (MAG-46-15 §3.3/3.4/3.5) and the quick
route (MAG-46-15 §3.6 — deletes only `task/{ref}`)

### 1.9 Gate naming & enforcement model
`test-gate` unenforced by GitHub, so `promote` must enforce it itself
identically to `build-gate`/`main-gate`. (LLD §3.7) — ✅ MAG-46-10 §3.2
(regular route), MAG-46-11.01 §3.2 (quick route's `main-gate` blocking)

### 1.10 WIP marker convention & detection
`{ref}: {title} - WIP` commit title convention; `status`/`repo-state`
must detect a WIP-marked head commit and keep state at
`work-in-progress` rather than progressing to `ready?`. (LLD §2 `PhaseState`
note, §3.9.1 output examples) — ✅ the commit-title format (MAG-46-07),
the "not WIP" case (MAG-46-06 §3.2/3.4), and the WIP-marked case holding
derivation at `work-in-progress` (MAG-46-06 §3.7) are all covered

### 1.11 Config loading (`.task-phases.json` + documented defaults)
Walk up from cwd to repo root; graceful fallback to every documented
default if missing. (LLD §2 `TaskPhasesConfig`, §3.8) — ✅ MAG-46-02
§3.3, MAG-46-18 §3.5

### 1.12 `--dev-testing` entry point
Grammar, JSON-object argument encoding via `--args-file`/`-i`, output/exit
rules — this mechanism doesn't appear in the LLD itself; it's introduced
specifically to make `deps/*.ts` system-testable. — ✅
`task-MAG-46-dev-testing-cli-design.md` (design doc), implemented per
MAG-46-00, exercised by 01/02/03/08/13

### 1.13 Working-directory / repo-resolution semantics
Every real tool implementation resolves the repository relative to
`process.cwd()`, never relative to where `task-phases` itself is
installed — what lets `pnpm task ...` run correctly from inside an
unrelated sandbox repo. (Design doc §6, surfaced as a real setup
"gotcha," not in the LLD) — ✅ now directly asserted, not just documented
— MAG-46-01 §3.2.5

### 1.14 Testable entrypoint (`run(argv, tools)`)
`cli.ts` exposes argv-parsing/dispatch/exit-code logic as a function both
the `bin` script and the test harness call, with only the tool
implementations differing between them. (Not in the LLD; established in
MAG-46-00's Deliverable Notes to resolve how system tests inject mocks.)
— 🔧 Checklist item in MAG-46-00 (a `quick` task, no test-gate applies);
its correctness is now also implicitly exercised by MAG-46-04 §3.4's
general exit-code proof, which calls `run(argv, tools)` directly.

---

## 2. `init`

### 2.1 Create new task (normal route)
`init <ref> --title <title>` creates `spec/{ref}` off `main`, scaffolds
the task doc from the template. (LLD §3.8, §3.8.1 first example) — ✅
MAG-46-05 §3.1

### 2.2 Create new task (`--quick` route)
`init <ref> --quick --title <title>` creates `task/{ref}` instead. (LLD
§3.8) — ✅ MAG-46-05 §3.2

### 2.3 `--doc <path>` copies a given doc as the task doc
(LLD §3.8) — ✅ MAG-46-18 §3.1

### 2.4 `--specs <path>...` copies given spec docs in
(LLD §3.8) — ✅ MAG-46-18 §3.2

### 2.5 Existing unmerged branch blocks outright, no `--wip`
Hard, unconditional block, no override flag (parked concurrency item,
LLD §3.14, §3.8.1 third example) — ✅ MAG-46-05 §3.3

### 2.6 `--wip` carries pre-existing WIP forward instead of blocking
(LLD §3.8, §3.8.1 fourth example) — ✅ MAG-46-18 §3.3

### 2.7 `main` must be up to date with `origin` before branching
(LLD §3.8.1 examples' "Check `main` is up to date" step) — ✅ MAG-46-05
§3.4

### 2.8 Graceful degradation: bad `--doc`/`--specs` path
Warn and continue rather than aborting `init`. (LLD §3.8, "helper
conveniences, not core requirements") — ✅ MAG-46-18 §3.4

### 2.9 Graceful degradation: missing `.task-phases.json`
Warn and fall back to documented defaults. (LLD §3.8) — ✅ MAG-46-18 §3.5

### 2.10 One of `--title`/`--doc` is required
(LLD §3.8: "one of `title` or `doc` is required") — ✅ MAG-46-05 §3.5

---

## 3. `status`

### 3.1 Report `not-initialised`
✅ MAG-46-04 (full section)

### 3.2 Report `not-started` / `work-in-progress`
✅ MAG-46-06 (full section)

### 3.3 Plain `status` leaves `ready?` unresolved
(LLD §3.9) — ✅ MAG-46-09 §3.1

### 3.4 `--check` resolves `ready?` into `ready`/`blocked`
Covered for both the regular and quick routes. (LLD §3.9, §3.9.1 first
two examples) — ✅ MAG-46-09 §3.2/3.3 (regular), §3.5 (quick)

### 3.5 `--ref <ref>` inspects another task without switching
(LLD §3.9, §3.9.1 "another task" example) — ✅ MAG-46-04 §3.2 (implicitly,
via `--ref` on a not-initialised ref), MAG-46-11 §3.2 (awaiting-pr on a
`--ref`-named task, matching the LLD's own worked example)

### 3.6 `--ref` + `--check` refusal rule
Fails (exit 1) unless `<ref>` is the checked-out task. (LLD §3.9,
§3.9.1's refusal example) — ✅ MAG-46-09 §3.4

### 3.7 `--fix [branch]` switches to canonical branch
Optionally committing WIP first via `--wip`; no-op if already canonical.
(LLD §3.9) — ✅ MAG-46-18 §3.6/3.7

### 3.8 Report `awaiting-pr`
Covered for both the regular and quick routes. ✅ MAG-46-11 §3.2,
MAG-46-11.01 §3.4

### 3.9 Report `merged-pending-pull` (read-only — no action taken)
✅ MAG-46-12 (full section, and its §3.3 explicitly asserts no action)

### 3.10 Report `merged-pending-cleanup`, incl. interrupted-cleanup
retrigger (read-only)
✅ MAG-46-15 §3.1/3.2

### 3.11 Report `branchMismatch`
(LLD §3.4, §3.9.1's mismatch example) — ✅ MAG-46-06 §3.6

---

## 4. `list`

### 4.1 Enumerate every active ref, grouped, with derived phase/state
(LLD §3.10) — ✅ MAG-46-16 §3.1

### 4.2 Mark the currently checked-out task
(LLD §3.10.1's `<== Current Task` marker) — ✅ MAG-46-16 §3.1

### 4.3 Mark `branchMismatch` per entry
(LLD §3.10) — ✅ MAG-46-16 §3.2

### 4.4 Never resolves `ready?` (no `--check` equivalent)
(LLD §3.10, parked open question §3.14) — ✅ MAG-46-16 §3.1 (explicit
assertion `gateChecks.run` never called)

### 4.5 No-active-tasks case
(implied by §3.10's "list all branches... group by ref") — ✅ MAG-46-16
§3.3

---

## 5. `promote`

### 5.1 `branchMismatch` → refuse, no action
(LLD §3.11) — ✅ MAG-46-10 §3.3

### 5.2 `awaiting-pr` → idempotent no-op, re-reports the PR
Covered for both the regular and quick routes. (LLD §3.4, §3.11) — ✅
MAG-46-11 §3.3, MAG-46-11.01 §3.3

### 5.3 `ready` (spec phase) → fork to `test/{ref}`
(LLD §3.11, §3.7 table) — ✅ MAG-46-10 §3.1

### 5.4 `ready` (test phase) → raise Build Gate PR
(LLD §3.11, §3.7 table) — ✅ MAG-46-11 §3.1

### 5.5 `ready` (quick phase) → raise Main Gate PR directly
(LLD §3.7 table's `task/{ref}` → `main` row) — ✅ MAG-46-11.01 §3.1 (new
chunk, added specifically to close this gap)

### 5.6 `blocked` → no action, relays gate's own violations
Covered for both the regular and quick routes. (LLD §3.11) — ✅ MAG-46-10
§3.2, MAG-46-11.01 §3.2

### 5.7 `rebased`: spec amended under existing test/{ref}
✅ MAG-46-10.01 §3.1

### 5.8 `rebased`: `main` drift (spec or quick route)
✅ MAG-46-10.01 §3.2/3.3

### 5.9 `merged-pending-pull` → `pulled` (plain, no reorder needed)
(LLD §3.3, §3.11) — ✅ MAG-46-14 §3.1

### 5.10 `merged-pending-pull` → `pulled-and-rebased` (cascading reorder)
(LLD §3.5 step 4, §3.11) — ✅ MAG-46-14 §3.2

### 5.11 `merged-pending-cleanup` → `cleaned-up`
Including the interrupted-cleanup retrigger case, and both routes. (LLD
§3.6, §3.11) — ✅ MAG-46-15 §3.3/3.4/3.5 (regular route), §3.6 (quick
route)

### 5.12 Always resolves `ready?` via `gate-check` (never left unresolved)
(LLD §3.2's closing rule, §3.11's opening line) — ✅ implicit across
MAG-46-10/11/11.01 (every `ready`/`blocked` fixture already resolves via a
mocked `gateChecks.run`)

### 5.13 Missing `--confirm-rebase` in `--json` mode refuses cleanly
✅ MAG-46-10.01 §3.4, MAG-46-14 §3.3

---

## 6. `wip`

### 6.1 Commits and pushes a dirty worktree with the WIP-marked title
(LLD §3.12) — ✅ MAG-46-07 §3.1

### 6.2 Clean worktree fails outright, no empty commit created
(LLD §3.12, implied by "work in progress" framing) — ✅ MAG-46-07 §3.2

### 6.3 `title`/`message` optional; confirmed bare-`wip` format
`{ref}: - WIP` (LLD §3.12, §2's `AAA-000 WIP` example, format confirmed
by architect) — ✅ MAG-46-07 §3.3

### 6.4 Never switches branches
(LLD §3.12 — `wip` acts only on the current branch) — ✅ MAG-46-07 §2.1
(asserted via `git.checkout` never called)

---

## 7. `<ref>` switch (`pnpm task <ref>`)

### 7.1 Switches to the derived canonical branch of the given ref
(LLD §3.13) — ✅ MAG-46-17 §3.1

### 7.2 `--wip [title] [message]` commits before switching
(LLD §CLI surface, §3.13) — ✅ MAG-46-17 §3.2

### 7.3 No `--wip`: switch proceeds, can fail on a real merge conflict
(LLD §CLI surface: "switching branches... without `--wip` fails on merge
conflicts") — ✅ MAG-46-17 §3.5

### 7.4 Subcommand names never misrouted as a ref, and vice versa
(LLD §2's `TaskRef` regex vs. `Command` union) — ✅ MAG-46-17 §3.3

### 7.5 Invalid ref format rejected before dispatch
✅ MAG-46-17 §3.4

---

## 8. `--dev-testing` real tool wrappers

(These prove the four `deps/*.ts` wrappers against real git/GitHub/
filesystem/gate-check behavior — see Core 1.12 for the shared grammar.)

### 8.1 `git`: read-only primitives (`fetch`, `currentBranch`,
`branchExists`, `headSha`)
✅ MAG-46-01 §3.1

### 8.2 `git`: mutating primitives (`createBranch`, `checkout`,
`commitAll`, `push`)
✅ MAG-46-01 §3.2

### 8.3 `git`: `rebase`/`mergeBase`/`isAncestor` (the rebase-forward
primitive, all three named scenarios + preconditions)
✅ MAG-46-13 (full section) — flagged throughout as the single
highest-risk chunk in the backlog

### 8.4 `fs`: `exists`/`readFile`/`writeFile`/`copyFile`/`mkdir`/`readDir`
✅ MAG-46-02 §3.1/3.2

### 8.5 `fs`: `loadConfig` walk-up behavior
✅ MAG-46-02 §3.3

### 8.6 `gh`: `createPR`
✅ MAG-46-03 §3.1

### 8.7 `gh`: `findOpenPR`
✅ MAG-46-03 §3.2

### 8.8 `gh`: `findMergedPR` / `findMergedPRs` (incl. superseded-merge
full history)
✅ MAG-46-03 §3.3

### 8.9 `gate-check`: `gateFor` phase→gate mapping
✅ MAG-46-08 §3.1

### 8.10 `gate-check`: `run()` against real gate rules (pass and fail
cases)
✅ MAG-46-08 §3.2/3.3 — dependent on `gate-checks-lld.md`'s actual rule
set (now in project knowledge) for the fixture to be constructible

---

## 9. Scaffolding (quick task — no test-gate, checklist not TDD)

### 9.1 Component layout & `types.ts` frozen against §2/§4.7–§4.10
🔧 MAG-46-00 checklist

### 9.2 `registry.ts`/`cli.ts` dispatch skeleton, unimplemented handlers
🔧 MAG-46-00 checklist

### 9.3 `--dev-testing` parsing stub, per the design doc
🔧 MAG-46-00 checklist

---

## Appendix A — Behavior / Spec Coverage Matrix

| ID | Behavior | LLD § | Spec(s) | Coverage |
|----|----------|-------|---------|----------|
| 1.1 | `--json` output mode | CLI surface, §4.1 | 04 | ✅ |
| 1.2 | Exit-code contract (general rule) | §4.1 | 04 | ✅ |
| 1.3 | Argument validation (exit 2) | §4.1, §2, §3.8 | 00, 01, 02, 03, 05, 08, 13, 17 | ✅ |
| 1.4 | Fetch-before-derive | §3.2 | 04 | ✅ |
| 1.5.1 | `not-initialised` | §3.2 | 04 | ✅ |
| 1.5.2 | `not-started` | §3.2 | 06 | ✅ |
| 1.5.3 | `work-in-progress` | §3.2 | 06 | ✅ |
| 1.5.4 | `ready?` unresolved | §3.2 | 09 | ✅ |
| 1.5.5 | `ready`/`blocked` resolution (both routes) | §3.2 | 09 | ✅ |
| 1.5.6 | `awaiting-pr` (both routes) | §3.2/3.4 | 11, 11.01 | ✅ |
| 1.5.7 | `merged-pending-pull` | §3.2/3.3 | 12 | ✅ |
| 1.5.8 | `merged-pending-cleanup` (+ interrupted) | §3.2/3.6 | 15 | ✅ |
| 1.5.9 | Merge detection via `gh` only | §3.3 | 03 + implicit | ✅ |
| 1.5.10 | Ancestry staleness fallback | §3.2 | 06 (status), 10.01 (promote) | ✅ |
| 1.6 | `branchMismatch` field itself | §3.4 | 06, 10, 18 | ✅ |
| 1.7.1 | Rebase-forward: spec-amended-under-test | §3.5 | 10.01, 13 | ✅ |
| 1.7.2 | Rebase-forward: main-drift | §3.5 | 10.01, 13 | ✅ |
| 1.7.3 | Rebase-forward: build-reorder (cascading) | §3.5 | 14, 13 | ✅ |
| 1.7.4 | `--confirm-rebase`/prompt gate (incl. interactive) | §3.5 | 10.01, 14 | ✅ |
| 1.7.5 | Conflict / unexpected-commit-count (all paths) | §3.5 | 13, 10.01, 14 | ✅ |
| 1.8 | Final cleanup (both routes) | §3.6 | 15 | ✅ |
| 1.9 | Gate enforcement (test-gate self-enforced, both routes) | §3.7 | 10, 11.01 | ✅ |
| 1.10 | WIP marker convention & detection (incl. WIP-marked case) | §2, §3.9.1 | 07, 06 | ✅ |
| 1.11 | Config loading + defaults | §2, §3.8 | 02, 18 | ✅ |
| 1.12 | `--dev-testing` entry point | *(new)* | design doc, 00, 01–03, 08, 13 | ✅ |
| 1.13 | Working-directory / cwd resolution | *(new)* | 01 | ✅ |
| 1.14 | Testable entrypoint `run(argv, tools)` | *(new)* | 00, 04 | ✅ |
| 2.1 | init: create new task (normal) | §3.8 | 05 | ✅ |
| 2.2 | init: create new task (`--quick`) | §3.8 | 05 | ✅ |
| 2.3 | init: `--doc` | §3.8 | 18 | ✅ |
| 2.4 | init: `--specs` | §3.8 | 18 | ✅ |
| 2.5 | init: unmerged branch blocks, no override | §3.8, §3.14 | 05 | ✅ |
| 2.6 | init: `--wip` carries forward | §3.8 | 18 | ✅ |
| 2.7 | init: `main` up to date precondition | §3.8.1 | 05 | ✅ |
| 2.8 | init: bad `--doc`/`--specs` path degrades gracefully | §3.8 | 18 | ✅ |
| 2.9 | init: missing config degrades gracefully | §3.8 | 18 | ✅ |
| 2.10 | init: one of `--title`/`--doc` required | §3.8 | 05 | ✅ |
| 3.1–3.11 | status: (see §3 above) | §3.9, §3.4 | 04, 06, 09, 11, 11.01, 12, 15, 18 | ✅ |
| 4.1–4.5 | list: (see §4 above) | §3.10 | 16 | ✅ |
| 5.1–5.4, 5.6–5.13 | promote: (see §5 above) | §3.11 | 10, 10.01, 11, 11.01, 14 | ✅ |
| 5.5 | promote: quick-route PR-raise | §3.7 table | 11.01 | ✅ |
| 6.1–6.4 | wip: (see §6 above) | §3.12 | 07 | ✅ |
| 7.1–7.5 | ref: (see §7 above) | §3.13, CLI surface | 17 | ✅ |
| 8.1–8.10 | dev-testing wrappers: (see §8 above) | §4.7–§4.10 | 01, 02, 03, 08, 13 | ✅ |
| 9.1–9.3 | scaffolding | §1.2, §2 | 00 | 🔧 |

Every behavior in the catalogue is now ✅ or 🔧 (scaffolding, which
deliberately has no test-gate). See Appendix B for what changed to get
here.

---

## Appendix B — Review History

A first pass cross-checking every LLD behavior against the backlog (built
before MAG-46-11.01 existed and before the patches below were applied)
surfaced twelve gaps. All twelve are now closed:

1. **General exit-code mapping rule** — was asserted only incidentally
   per-scenario. Closed: MAG-46-04 §3.4 (new section).
2. **`status`'s own reporting of the ancestry-staleness fallback** — only
   `promote`'s reaction was covered. Closed: MAG-46-06 §3.5 (new section).
3. **`TaskStatus.branchMismatch` field itself** — only commands *acting*
   on a mismatch were covered. Closed: MAG-46-06 §3.6 (new section).
4. **Interactive (`y/N`, non-`--json`) rebase confirmation prompt** — was
   entirely untested. Closed: MAG-46-14 §3.6 (new section; flagged there
   as depending on a test-harness TTY/stdin-simulation capability — a
   capability to confirm, not a remaining spec-content gap).
5. **`unexpected-commit-count` for the combined `pulled-and-rebased`
   action** — only `conflict` was covered for that path. Closed:
   MAG-46-14 §3.5 (new section).
6. **`ready?`→`ready`/`blocked` resolution on the quick route** — only the
   `test`-phase case was covered. Closed: MAG-46-09 §3.5 (new section).
7. **A WIP-marked head commit's effect on derivation** — only the
   "not WIP-marked" case was covered. Closed: MAG-46-06 §3.7 (new
   section).
8. **Quick-route final cleanup** — only the regular route's branch set was
   covered. Closed: MAG-46-15 §3.6 (new section).
9. **Working-directory/cwd-resolution semantics** — documented as a
   constraint but never asserted. Closed: MAG-46-01 §3.2.5 (new section).
10. **`init`'s "one of `--title`/`--doc` required" validation** —
    untested. Closed: MAG-46-05 §3.5 (new section).
11. **The quick route's own `promote`-to-PR action** (`task/{ref}` →
    `main`) — entirely unspec'd; the single most significant gap found.
    Closed with a new chunk: MAG-46-11.01.
12. **`<ref>` switching without `--wip` into a real merge conflict** —
    described in prose but never driven by a fixture. Closed: MAG-46-17
    §3.5 (new section).

None of these were contradictions in what was already written — they were
places where a required LLD behavior didn't yet have a corresponding spec
assertion, surfaced by cross-checking every LLD behavior against the
backlog rather than checking each spec only for internal consistency.
This appendix is kept as a record of that review rather than deleted, so
a future pass has a sense of what "done" already covers.

---

## Appendix C — Spec → Test File Mapping

Full layout rules and rationale in `task-MAG-46-test-file-layout-design.md`;
this table is the quick-reference companion to Appendix A, in the other
direction (spec doc → test file rather than behavior ID → spec doc).

| Spec doc | Test file(s) |
|---|---|
| MAG-46-00 | *(no test file — quick task, no test-gate)* |
| MAG-46-01 | `deps/git-basics.test.ts` |
| MAG-46-02 | `deps/fs.test.ts` |
| MAG-46-03 | `deps/gh.test.ts` |
| MAG-46-04 | `status/not-initialised.test.ts` |
| MAG-46-05 | `init/create.test.ts` |
| MAG-46-06 | `status/not-started-and-work-in-progress.test.ts` |
| MAG-46-07 | `wip/commit.test.ts` |
| MAG-46-08 | `deps/gate-check.test.ts` |
| MAG-46-09 | `status/check-ready-or-blocked.test.ts` |
| MAG-46-10 | `promote/forked.test.ts` |
| MAG-46-10.01 | `promote/rebased-forward.test.ts` |
| MAG-46-11 | `promote/pr-raised.test.ts` (§3.1/3.3), `status/awaiting-pr.test.ts` (§3.2/3.4) |
| MAG-46-11.01 | `promote/quick-route-pr-raised.test.ts` (§3.1–3.3), adds to `status/awaiting-pr.test.ts` (§3.4) |
| MAG-46-12 | `status/merged-pending-pull.test.ts` |
| MAG-46-13 | `deps/git-rebase-forward.test.ts` |
| MAG-46-14 | `promote/pulled-and-rebased.test.ts` |
| MAG-46-15 | `status/merged-pending-cleanup.test.ts` (§3.1/3.2), `promote/cleaned-up.test.ts` (§3.3–3.6) |
| MAG-46-16 | `list/active-tasks.test.ts` |
| MAG-46-17 | `task/switch.test.ts` |
| MAG-46-18 | `init/flag-variants.test.ts` (§3.1–3.5), `status/fix.test.ts` (§3.6/3.7) |

All paths relative to `test/packages/task-phases/`.
