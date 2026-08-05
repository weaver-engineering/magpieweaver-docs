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

## Another design requirement: the scheduler needs to know about prior-behavior retirements

The service's whole premise is replacing the architect's *mechanical*
operation of chunk sequencing and agent interaction with an automated
schedule — which means every mechanical step the architect currently
does by hand needs a home in the scheduler, not just the parts that were
easy to picture up front (watching sessions, raising PRs, summarising
logs). **Prior-behavior retirements** (`design-workflow-findings.md`
Finding 3; the operating recipe in
`sequenced-spec-supervision-CLAUDE.md`) are exactly this kind of step:
formulaic, recurring, and currently done by the architect reading a spec
doc against the current test suite by hand.

**What the scheduler needs to do, concretely:** before queuing a chunk
for `test-writer`, diff that chunk's required behaviors against every
currently-merged test file's specific assertions, the same check
described in Finding 3. Unlike a lot of the rest of the scheduling logic
(branch state, gate results, PR status — all mechanically queryable
today), this diff is semantic, not structural: it means comparing a
spec doc's prose Given/When/Then against a test file's actual assertions
to find direct contradictions, not a data-shape check. That's real work
for whatever LLM layer the service already needs for its chat-heads/
1-click-prompt UI (see "The shape" above) — this is a second, concrete
job for that same layer, not a new capability the design didn't already
require.

**Once a retirement is found, the four-step recipe itself is
mechanical** (locate the contradicted block, add a dated correction
note, delete just that block, land as its own quick-route commit ahead
of the chunk's `spec/{ref}`) — a strong candidate for full automation
rather than a 1-click human confirmation, *if* the service is confident
in what it found. Whether "confident" ever means "fully autonomous, no
human in the loop" for something that deletes test coverage, even
formulaically, is an open question worth deciding deliberately when this
gets designed for real — not defaulting to either extreme by accident.

## Scope note

Same as every other note in this file: this is **the loom**
(weaver-engineering's agentic-dev tooling), not Magpie Weaver. Lives here
only because Magpie Weaver's MAG-46 backlog is where the workflow it
formalises is being dog-fooded.
