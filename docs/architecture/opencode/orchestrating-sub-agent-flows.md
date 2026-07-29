# Orchestrating Sub-Agent Flows

Agreed in the `opencode-configuration` chat. Companion documents:
`open-code-sub-agents.md` (who the agents are), `open-code-agent-tools.md`
(what they can call). This document does **not** design the future task
scheduler/orchestrator itself (explicitly excluded from this chat) — it
defines the contract a session honours regardless of whether the thing
invoking it is a human today or a scheduler later.

## 1. Workflow Overview — Who Does What, When

| Phase | Owner | Agent involved? | Ends by |
|---|---|---|---|
| `spec` | Architect (+ its own preceding design workflow) | **No** — no sub-agent exists for this phase | Spec commit exists on `spec/{ref}`; architect handles any `main`-drift fast-forward directly |
| `test` | `test-writer` | Yes | Failing tests (+ any `*.interface.ts`) committed, `build-gate` passes |
| `build` | `build-implementer` | Yes | Implementation committed, `main-gate` passes |
| `quick`/`task/{ref}` | `quick-scaffolder` | Yes (in place of the whole spec/test/build cycle) | Single commit, `main-gate` passes |
| `deploy-test` / `deploy-prod` | CI/CD + architect (UAT/sanity) | No | Deployed and verified |
| `done` | — | No | Task closed |

**Gate naming note, corrected from an earlier draft:** `gateFor` maps
`spec → test-gate`, `test → build-gate`, `build → main-gate`, `quick →
main-gate` (`task-MAG-46-08-dev-testing-gate-check-spec.md` §3.1). So
`test-gate` is the gate opened at the `spec`→`test` transition — checked
before `test/{ref}` is even created, with no sub-agent involved — not
something `test-writer` itself invokes. `test-writer` invokes
`build-gate`; `build-implementer` and `quick-scaffolder` both invoke
`main-gate`.

## 2. The Trust/Railroading Axis — Correcting An Earlier Framing

**Correction from an earlier draft of this document:** it previously
described "hand-cranking `task-phases`" as the agent performing a manual
equivalent of each not-yet-built command. That's not really what's
happening. Much of what `task-phases` delivers has no real manual
equivalent — rather, `task-phases` **replaces judgement the agent would
otherwise exercise itself** (deciding when to rebase, when a PR is ready
to raise, how to resolve an ambiguous state) with a prescribed,
tool-dictated instruction: *this is the state you're in → this is the
next thing to do.* The axis that actually moves over time is **trust vs.
railroading**, not **manual vs. automated**.

Consequently:

- **Initial standing instructions treat the agent as broadly capable and
  trusted** to use its normal tools (`edit`, scoped `bash` git/gh
  primitives, `gate-check`) with its own good judgement to accomplish the
  phase's goal — at the cost of **higher oversight** (interactive
  sessions, architect present, more frequent check-ins), not at the cost
  of a constrained, mechanical procedure.
- **As `task-phases` methods ship, the agent becomes more railroaded** —
  offered a specific tool call that dictates the correct next action
  instead of relying on its own judgement — and, because the tool itself
  now enforces correctness, **supervision can be reduced** correspondingly.
  Railroading and reduced supervision move together; one is what buys the
  other.

**This also fixes the headless-invocation sequencing.** Sections 3–5 below
describe the headless contract, but **headless execution is not the
starting mode**. In the beginning, agents run **interactively** (architect
present in the chat) while their capability and the standing instructions'
stability are assessed in the real environment. Only once that track
record exists does a phase move to running headlessly by default — the
mechanism below is what that later mode uses, not what day one uses.

## 3. Headless Invocation (once adopted for a given phase)

A phase task is started with `opencode run`, specifying the owning
sub-agent and a model/effort:

```bash
opencode run --agent test-writer --model <provider/model> --format json "<standard prompt — see standard-chat-requests.md>"
```

The run returns a **session id** — this is the unit of continuity, not
the agent or model. Agent and model are per-invocation flags, not part of
the session's identity, which is what makes everything below possible
without any custom state store.

## 4. Ending A Session — Four Outcomes, Not Three

Every phase-owning agent's standing instructions require it to check the
task's derived state at the start of its work and before any irreversible
action. A session ends in one of four ways — the fourth is a correction
from an earlier draft, which only allowed for cooperative, well-understood
outcomes:

1. **`ready-for-next-phase`** — gate passed, work committed, safe to hand
   forward.
2. **`blocked`** — a gate-check failure, relayed directly (mechanical,
   well-understood).
3. **`rebase-required` / `phase-changed`** — the state changed underneath
   the agent (spec amended, `main` drifted); agent WIPs and reports.
4. **`needs-architect-intervention`** — the agent is genuinely stuck in a
   way the other three don't cover: a permission it doesn't have, a
   package that needs installing, an inconsistency in the spec itself, or
   anything else outside its authority or capability to resolve on its
   own. This path **must exist from the outset**, however it's
   implemented. MVP behaviour: the session simply gets restarted in
   **interactive mode** (architect attaches to the same session id)
   instead of attempting any headless-only remedy. Over time, more of
   these cases can be narrowed away by better tooling — but the path
   itself is never removed, only used less often.

Every outcome, including `needs-architect-intervention`, is reported via
the same standardised payload shape (full catalogue in
`standard-chat-handover-responses.md`):

```json
{
  "outcome": "ready-for-next-phase | blocked | rebase-required | phase-changed | needs-architect-intervention",
  "ref": "AAA-001",
  "phase": "test",
  "state": "ready",
  "sessionId": "<the session just used>",
  "reason": "human-readable summary"
}
```

The agent reports its own outcome and reason only — it doesn't name which
sub-agent should run next. That mapping is a fixed function of
phase/state (per the Workflow Overview in §1), for the orchestrator
(architect today, scheduler later) to derive on its own, not something
requiring the agent's judgement.

## 5. External Halt — A Separate, Non-Cooperative Mechanism

The four outcomes above are all **cooperative** — the agent recognises
its own situation and reports it. That's not sufficient on its own: an
agent can thrash (endless cycling, runaway token burn, repeated failed
attempts) without itself recognising anything is wrong, in which case
there is nothing to cooperatively report. This needs a **separate,
externally-imposed Halt mechanism** that does not depend on the agent's
own cooperation, and it must exist from the very first headless
invocation, not be added later as an afterthought.

- **MVP implementation:** the architect (or whoever is supervising)
  simply terminates the running `opencode run`/session directly — no
  tooling required, just the ability to stop it.
- **Later:** a lightweight watchdog wrapping invocations, enforcing a
  turn-count/token/wall-clock budget and force-stopping anything that
  exceeds it.
- **Either way:** the session id is preserved, so a halted session can be
  resumed **interactively** afterwards to diagnose what actually went
  wrong — the same interactive-fallback pattern as
  `needs-architect-intervention`, just triggered externally instead of by
  the agent's own report.

## 6. Restarting / Handing Over

Because agent/model are per-invocation and session id is the continuity
anchor, restarting for a different phase/state is **the same shape**
whether performed by hand today or by a future scheduler:

```bash
# Restart headless, same context, different sub-agent/model
# (<next-agent> derived by the orchestrator from phase/state, not supplied by the agent)
opencode run --session <same-id> --agent <next-agent> --model <model> --format json "<standard resume prompt>"

# Hand over to an interactive chat instead (used for both
# needs-architect-intervention and post-Halt diagnosis)
opencode --session <same-id>
# or, against a running headless server:
opencode run --attach http://localhost:4096 --session <same-id>
```

This is the property that makes today's manual cycling (the architect
reading the payload and typing the next `opencode run` command)
**structurally identical** to the future orchestrator's automated version
— automating it later is a scheduling loop around this same contract, not
a redesign of it.

## 7. What This Document Deliberately Does Not Define

- The scheduler/orchestrator's own polling, retry, or scheduling logic —
  excluded from this chat by design; this document only fixes the
  contract it would consume.
- The full set of `outcome` values and their exact payload shape per
  case, and the full catalogue of `needs-architect-intervention` triggers
  — `standard-chat-handover-responses.md`.
- The exact standard prompts used to invoke each phase task —
  `standard-chat-requests.md`.
- The watchdog's actual budget thresholds (turn count, token limits,
  wall-clock) — an operational tuning question, not an architecture one,
  and out of scope here.
