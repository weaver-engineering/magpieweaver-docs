# Agent Instruction Tuning — Notes & Rationale

Companion to `agent-instruction-tuning-CLAUDE.md`. That file is the
operating instruction set; this one is the reasoning behind it, written
for you rather than for the assistant.

## What this workflow actually is

A session where the *subject* is the agent's standing instructions, not
the feature it happens to be building. The agent does real work — that
matters, synthetic exercises don't surface the same problems — but the
output we care about is the accumulated set of corrections to
`.opencode/agent/*.md`.

It emerged rather than being designed. Over MAG-46's chunks we kept
hitting the same shape of problem: the agent stalls, the cause turns out
to be something in its instructions or permissions, and the fix is
obvious once seen but was invisible beforehand. Eventually it was clear
this was a distinct activity with its own rhythm, worth naming.

## Why the hard rules are hard

**Only the agent edits in the agent's worktree.** This started as a
practical concern (two writers, one checkout) and turned out to be
load-bearing for a subtler reason: when the assistant live-patches the
agent's config to unblock a session, the fix exists only in a working
tree, gets clobbered by the next branch switch, and silently regresses.
We lost `external_directory` grants for the docs repo at least once
exactly this way, and spent a long time debugging a stuck `glob` call
whose fix had already been written and lost. Landing every fix through a
PR is slower per-fix and much faster overall.

**Never merge the agent's PRs.** Worth being blunt about why this is a
rule and not a preference: the whole gate model assumes a human decides
whether agent-authored work enters the codebase. CI checks the mechanical
minimum; the architect check is the one that catches "passes every test,
implements the wrong thing". If the assistant reviews *and* merges, that
check silently disappears while appearing to have happened. This was
violated once in this session and caught immediately.

**Only the standard prompts.** Ad-hoc prompts produce ad-hoc behaviour.
The clearest evidence: every Begin/Resume-driven handoff ended with the
proper JSON envelope; both ad-hoc review-comment prompts ended in prose
instead, because the agent's own instructions tie the envelope to "ending
the session", which an improvised mid-cycle prompt doesn't obviously
trigger. That gap is tracked (MAG-47) and deferred until the MAG-46
backlog is done, with the stopgap of explicitly demanding the envelope.

## The API is quirkier than it looks

Three things cost real time before being understood:

1. **Endpoint asymmetry.** `/session/{id}/message` and
   `/api/session/{id}/message` are different endpoints with different
   payloads — the `/api/` one returns only agent-switch events. Agent
   switching needs `/api/`; `prompt_async` must not have it.
2. **Permission replies can't be automated.** The request object expires
   in seconds. Every attempt to reply via the API 404'd. Your CLI can
   still answer it long after the API says it's gone.
3. **Interrupt doesn't actually interrupt an orphaned call.** It returns
   `204` and changes nothing; a follow-up prompt queues behind the stuck
   call. You confirmed this from your side ("that came over as queued. i
   think it needed an explicit halt first"). The only reliable stop is
   your CLI.

## The most valuable diagnostic habit

Distinguishing the three stall modes — orphaned call, live permission
ask, dropped turn — because the correct response differs completely and
they look identical from a distance ("the agent seems stuck"). The
cheapest discriminator is the last message's last part plus a timestamp
comparison. A tool `state: "running"` with an hour on the clock and no
pending permission is orphaned; a message that ends right after
`step-start` with no content is a dropped turn and just needs Resume.

## Failure patterns worth remembering

- **Permission gaps come in families.** `xargs` and `rg` were the same
  underlying gap — read-only research commands that compose with
  already-allowed ones (`find | xargs grep`, `rg` as a `grep` substitute).
  Fixing the instance without naming the family means meeting the next
  member of it a day later.
- **Instructions get skipped when ordering is implicit.** The agent read
  its spec docs before finishing its numbered start protocol, so it read
  them off `main` instead of the branch the protocol would have created,
  concluded the spec doc didn't exist, and went on a long investigative
  detour. Nothing was disobeyed — §2 and §3 are just adjacent sections,
  and nothing marked §2 as a gate.
- **We chose not to patch that one.** The whole start protocol is due to
  collapse into a single `task status --ref <ref>` call once the tool's
  derivation is trustworthy, at which point the skip-ahead problem stops
  existing. Fixing the seven-step git dance now would be work thrown away.

## Open threads

- **MAG-47** — standard prompt template for PR-review-comment rounds.
  Parked deliberately until MAG-46's specs are done.
- **Permission glob tightening** — bare `"cmd*"` patterns should become
  `"cmd *"` across the agent files; queued for a restart boundary rather
  than mid-session.
- **Worktree vs clone.** The three checkouts share one `.git` and one ref
  namespace. This surprised both of us mid-session and causes a recurring
  class of phantom ref-move bug. Separate clones would make each `main`
  genuinely independent and remove it, at the cost of losing shared refs
  between architect and agent.
