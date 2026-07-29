# Standard Chat Handover Responses

Agreed in the `opencode-configuration` chat. Builds directly on
`orchestrating-sub-agent-flows.md` §4–5 (the four cooperative outcomes +
external Halt). This document is the full catalogue those sections
referred to without duplicating.

## 1. Full List Of Possible Chat End States

| End state | Cooperative? | Fully defined now? |
|---|---|---|
| `ready-for-next-phase` | Yes | ✅ |
| `blocked` | Yes | ✅ |
| `rebase-required` | Yes | ✅ |
| `phase-changed` | Yes | ✅ |
| `needs-architect-intervention` | Yes | ✅ |
| External Halt (session force-stopped) | **No** — imposed, not reported | Deliberately **not** given an agent-emitted schema (see §6) |

All five cooperative outcomes are defined now, not deferred, because
headless operation depends on the full vocabulary existing from the
outset (`orchestrating-sub-agent-flows.md` §2) — there's no safe
"headless-lite" mode that only handles the easy cases.

## 2. Shared Envelope

Every cooperative outcome uses this envelope; per-outcome fields extend it
(§4).

```json
{
  "outcome": "ready-for-next-phase | blocked | rebase-required | phase-changed | needs-architect-intervention",
  "ref": "AAA-001",
  "phase": "test",
  "state": "...",
  "sessionId": "<the session just used>",
  "reason": "human-readable summary"
}
```

Which sub-agent runs next is not this document's concern and not the
agent's to suggest — it's a fixed mapping from phase/state that the
orchestrator (architect today, scheduler later) derives on its own
(`orchestrating-sub-agent-flows.md` §4).

## 3. `blocked` vs. Ordinary Retry — Confirmed

A failing `gate-check` result, on its own, is normal mid-session
information — the agent fixes the issue and re-runs the gate, same
session, no chat end. Ending the chat with `blocked` only happens in the
**narrower** case where the gate is failing for a reason **outside the
agent's own authority to fix** — the clearest example being the "no
built-in exception path" rule (Architecture Definition Document, Guard
Rails §2): an existing test would need to change, which mechanically
**always** fails the gate and can only be resolved by the architect's
manual override preceded by its own spec-revision task. That's a known,
well-understood category `gate-check` itself can name — not a vague "I'm
stuck," which is what `needs-architect-intervention` is for.

**Confirmed rule:** `blocked` fires only when the agent has already
attempted a fix and the gate's own violation message indicates the
failure isn't something further agent effort can resolve — never on the
first failing run of a gate-check.

## 4. Per-Outcome Schema & Example

### `ready-for-next-phase`
Gate passed. If the agent itself raises the PR (current model, per
`open-code-sub-agents.md` §5, until `task-phases`/`promote` exists), the
PR is already open — the *actual* next agent invocation only happens
**after the architect merges it**, not immediately, and which agent that
is is derived from phase/state by the orchestrator, not named here.

```json
{
  "outcome": "ready-for-next-phase",
  "ref": "AAA-001",
  "phase": "test",
  "state": "awaiting-pr",
  "sessionId": "sess_abc123",
  "reason": "test-gate passed; Build Gate PR raised, awaiting architect review/merge",
  "prUrl": "https://github.com/.../pull/42"
}
```

### `blocked`
Gate's own violations relayed verbatim — never reworded into the agent's
own diagnostic text (`task-phasing-lld.md` §3.11's existing convention,
applied here too).

```json
{
  "outcome": "blocked",
  "ref": "AAA-001",
  "phase": "build",
  "state": "blocked",
  "sessionId": "sess_abc123",
  "reason": "build-gate failing on a rule outside this agent's authority to resolve",
  "gateCheckResult": {
    "check": "build-gate",
    "passed": false,
    "violations": ["..."],
    "messages": ["..."]
  }
}
```

### `rebase-required` / `phase-changed`
Only fires when self-handling the rebase-forward itself failed (conflict,
or `unexpected-commit-count` — `task-phasing-lld.md` §4.8) or when the
derived phase/state has moved to something the agent's current mandate
no longer covers at all (e.g. discovers the task is actually
`merged-pending-pull`). A clean, successful self-handled rebase does
**not** end the chat — the agent just continues working.

```json
{
  "outcome": "rebase-required",
  "ref": "AAA-001",
  "phase": "test",
  "state": "work-in-progress",
  "sessionId": "sess_abc123",
  "reason": "spec/{ref} amended after test/{ref} forked; rebase-forward hit a conflict this agent can't safely resolve alone",
  "previousPhase": "test",
  "rebaseOutcome": "conflict"
}
```

### `needs-architect-intervention`
Covers anything outside the agent's authority or capability that
`gate-check` itself has no vocabulary for — a missing permission, a
package that needs installing, a spec inconsistency noticed before ever
reaching a gate. MVP handling: restart the session interactively
(`orchestrating-sub-agent-flows.md` §4).

```json
{
  "outcome": "needs-architect-intervention",
  "ref": "AAA-001",
  "phase": "build",
  "state": "work-in-progress",
  "sessionId": "sess_abc123",
  "reason": "task-<REF>-spec.md references an endpoint that doesn't exist anywhere in the design docs",
  "interventionCategory": "permission | dependency | spec-inconsistency | other",
  "details": "free-text explanation for the architect"
}
```

## 5. Not Yet Defined / Deferred

Nothing is deferred or open — all five cooperative outcomes (§1) are
fully defined, including the `blocked` boundary (§3).

## 6. External Halt Has No Agent-Emitted Schema

By definition (`orchestrating-sub-agent-flows.md` §5), a Halt is imposed
externally on a session that isn't cooperating — there is no "final
message" to standardise, because the agent doesn't get one. If an audit
trail is wanted later, that's a **watchdog-emitted** record, not an
addition to this catalogue — out of scope here per the same exclusion
that keeps scheduler design out of this chat.
