# OpenCode Sub-Agents

Agreed in the `opencode-configuration` chat. Companion document:
`open-code-agent-tools.md` (tool definitions and requirements referenced
below).

## 1. Sub-Agent List

Three sub-agents. Deliberately **no** agent for the `spec` phase — see §2.

| Formal name | Phase owned |
|---|---|
| `test-writer` | `test` |
| `build-implementer` | `build` |
| `quick-scaffolder` | `quick` (`task/{ref}` route) |

## 2. Why No `spec` Sub-Agent

The spec-writing workflow is a separate, preceding workflow (design work),
out of this system's scope — `task-phases`/OpenCode only begin caring once
a spec commit exists. The phase table (Architecture Definition Document,
Guard Rails §1) already states the agent has no editing role during
`spec`. The one mechanical action needed during this phase — rebasing
`spec/{ref}` forward when `main` drifts — is a plain fast-forward
(`task-phasing-lld.md` §4.8), performable directly by the architect
(`task-phases promote --confirm-rebase`, or the hand-cranked equivalent)
with no judgment or persona required. The one case needing real judgment —
two concurrent spec edits to the same `docs/tasks/task-<REF>` directory
producing a genuine conflict — needs the architect's own resolution
regardless, since only they know which change should win; there's no
agentic capability gap to fill there.

## 3. Responsibilities

### `test-writer`
- Reads `task-<REF>.md`/`task-<REF>[-NN]-spec.md` and whatever design
  documentation it needs.
- Writes failing system tests, and any public interfaces the tests need
  to compile against (`packages/**/*.interface.ts` — only interfaces
  meant to be immutable across the test/build boundary, not every
  interface).
- Invokes `build-gate` via the `gate-check` tool (`gateFor` maps
  `test → build-gate`, not `test-gate` — corrected from an earlier draft
  of this document).
- Self-handles the rebase-forward into its own canonical branch
  (`test/{ref}`) when `spec/{ref}` is amended after `test/{ref}` already
  forked from it (`task-phasing-lld.md` §1.7.1/§4.8) — this is a bounded,
  mechanical action scoped to its own branch, not a general capability.

### `build-implementer`
- Reads `task-<REF>.md`/`task-<REF>-spec.md` and whatever design
  documentation it needs.
- Implements code to make the failing tests pass, without touching the
  test package or the interfaces the test phase committed.
- Invokes `main-gate` via the `gate-check` tool (`gateFor` maps
  `build → main-gate`, not `build-gate`).
- Self-handles the rebase-forward into its own canonical branch
  (`build/{ref}`) for both the plain `main`-drift case and the cascading
  build-reorder case (`task-phasing-lld.md` §1.7.2/§1.7.3).

### `quick-scaffolder`
- Handles small changes that don't require altering existing tests
  (Architecture Definition Document: "changes that... still pass coverage
  checks can go straight to implementation, skipping the full three-gate
  cycle").
- Edits anywhere in the target package — no test/interface/implementation
  split, since there's no test-gate/build-gate boundary on this route.
- Invokes `main-gate` directly via the `gate-check` tool (`task/{ref}` →
  `main`, single commit).
- Self-handles the rebase-forward into its own canonical branch
  (`task/{ref}`) when `main` drifts ahead of it (`task-phasing-lld.md`
  §1.7.2) — the same self-handling principle as `test-writer` and
  `build-implementer`, just against a different upstream.

## 4. Tool & Permission Matrix

| | `test-writer` | `build-implementer` | `quick-scaffolder` |
|---|---|---|---|
| `edit`: `test/packages/**` | allow | deny | allow |
| `edit`: `packages/**/*.interface.ts` | allow | deny (read only) | allow |
| `edit`: `packages/**` (impl, minus `*.interface.ts`) | deny | allow | allow |
| `gate-check` tool | `build-gate` only | `main-gate` only | `main-gate` only |
| `task-phases` tool (incremental — see `open-code-agent-tools.md` §3) | `status` + whatever's real | `status` + whatever's real | `status` + whatever's real |
| `bash`: git commit/push, `gh pr create` | scoped allow (see §5) | scoped allow (see §5) | scoped allow (see §5) |

## 5. Git/GitHub Write Actions — Trust Now, Railroading Later

**Correction from an earlier draft:** this section previously framed
pre-`task-phases` operation as the agent performing a "hand-cranked
manual equivalent" of each not-yet-built `promote` action. That's the
wrong axis. `task-phases` doesn't automate manual labour the agent would
otherwise plod through by hand — it **replaces the agent's own judgement**
(deciding when a rebase is needed, when a PR is genuinely ready to raise,
how to resolve an ambiguous state) with a prescribed, tool-dictated
instruction. The thing that actually changes over time is **trust vs.
railroading**, not **manual vs. automated**. See
`orchestrating-sub-agent-flows.md` §2 for the full rationale, which this
section applies specifically to git/GitHub write actions.

Each sub-agent performs its own `git commit`/`push`/`gh pr create` (the
actions `promote` will eventually own) using its own scoped `bash`
permissions — **the agent's own responsibility throughout**, never the
architect's, and never something that shifts to the architect once
`task-phases`/`promote` exists.

What changes over time is *how much the agent is trusted to decide for
itself*, and correspondingly *how closely it's supervised* — not *who
performs the action*:

- **Before a given `task-phases`/`promote` action is real:** the agent is
  treated as broadly **capable and trusted** to use its own judgement via
  scoped `bash` permission patterns (e.g. `"git commit *": "allow"`,
  `"git push *": "allow"`, `"gh pr create *": "allow"`, scoped to its own
  canonical branch) — at the cost of **higher oversight**. Concretely,
  this phase of operation runs **interactively** (architect present in
  the session), not headlessly — headless execution is only adopted for
  a given phase once the agent's capability and the standing
  instructions' stability have been assessed under interactive
  supervision in the real environment (`orchestrating-sub-agent-flows.md`
  §2).
- **Once that action ships in `task-phases`:** the corresponding raw
  `bash` permission is **removed** (set to `deny`) and replaced by the
  `task-phases` tool call — the agent is now more railroaded (offered a
  specific dictated action instead of relying on judgement), which is
  precisely what makes reducing supervision safe, and what eventually
  allows that phase to move to headless operation per
  `orchestrating-sub-agent-flows.md` §3–6.

This means `open-code-agent-tools.md`'s `task-phases-tool-readiness-mapping`
follow-up chat also determines a **permission removal and supervision
reduction schedule**, not just a tool-addition schedule — each tool
method landing should trigger the tool addition, the raw `bash` pattern
removal, and a reassessment of whether that phase is ready to run
headlessly, recorded together rather than as separate changes.
