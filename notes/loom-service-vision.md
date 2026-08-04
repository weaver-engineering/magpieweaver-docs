# The Loom As A Service — Long-Term Vision

**Status:** direction stated by Simon (2026-08-04), not started. No repo,
no scaffolding — captured here so it doesn't get reinvented from scratch
once "the loom" (see `design-workflow-findings.md`'s scope note) gets its
own repo.

## The shape

Formalising the sequenced-spec-supervision workflow
(`sequenced-spec-supervision-notes.md`) — currently run by the architect
by hand, one chunk at a time — into a real service:

- A **TS backend** running the task scheduler: watching agent outputs,
  monitoring progress, summarising agent logs into quick overviews. This
  is exactly what the architect currently does manually: curl-driving
  OpenCode's `serve` HTTP API, polling a session's message history,
  condensing tool-call noise into a status update, surfacing decision
  points.
- The backend uses the **Claude Agent SDK** to provide "chat heads" and
  1-click prompts back to the architect/user to take actions — i.e. the
  human-in-the-loop review/decision points (the merge-gate rule that only
  a human ever runs `gh pr merge`; `needs-architect-intervention`
  handoffs like the file-layout conflict MAG-46-11.01 hit) become UI
  affordances instead of a live chat session with an LLM driving tools by
  hand.
- A **simple TS/React UI**: chunks as cards on a kanban board (columns
  presumably tracking `PhaseState` — `not-started` / `work-in-progress` /
  `ready?` / `awaiting-pr` / etc., the same enum `task-phasing-lld.md`
  already defines). Clicking a card shows that task's agent log; from
  there you can jump into the agent's *live* session if one is running.

## A real asymmetry the design will need to account for

OpenCode has a genuine persistent `serve` HTTP server — confirmed this
session by driving it directly: `POST /session/{id}/prompt_async`,
`POST /api/session/{id}/agent` to switch agents, session listing via
`GET /session`, etc. (see `opencode-headless-permission-handling.md` for
the adjacent finding that OpenCode's *permission* system has no
equivalent headless story — this is about session/prompt driving
specifically, which does work today).

Claude Code has no equivalent. Confirmed via Claude's own
`claude-code-guide` research (2026-08-04): no `claude serve`, no
persistent listener you can `POST` a prompt to. The two real options are
(a) `claude -p "prompt" --resume <session-id>` — a new subprocess spawned
per prompt, no persistent process — or (b) the **Claude Agent SDK**
(`@anthropic-ai/claude-agent-sdk`), a library for *building* a long-lived
server yourself (`query()` + `resume`), not something that ships
pre-built.

**Consequence for this service's design:** the two integration points
aren't symmetric. Driving `test-writer`/`build-implementer`/
`quick-scaffolder` sessions (OpenCode-hosted) is "poll a real server that
already exists." Providing the architect's own "chat heads and 1-click
prompts" (Claude-hosted) means the *service itself* is the long-lived
Agent SDK server — there's nothing to poll, you're building the
persistent half from scratch. Half client, half server, and it's the
Claude-facing half that carries the actual hosting burden.

## Scope note

Same as every other note in this file: this is **the loom**
(weaver-engineering's agentic-dev tooling), not Magpie Weaver. Lives here
only because Magpie Weaver's MAG-46 backlog is where the workflow it
formalises is being dog-fooded.
