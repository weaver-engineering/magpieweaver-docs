## OpenCode has no native path for headless permission handling — a forkability assessment

**Context:** driving live OpenCode agent sessions for MAG-46 surfaced a
question that matters beyond this one project — the architect currently
has to personally watch live sessions and click "allow" on permission
prompts, because nothing else reliably can. This note captures what
research turned up when we asked how hard it would be to fix that
ourselves, since a real answer requires understanding OpenCode's own
codebase, not just its docs.

Scope note (see `notes/design-workflow-findings.md` for the fuller
version of this point): this is loom research, not Magpie Weaver work.
It lives here only because MAG-46 is where the need surfaced.

### The problem, precisely

Two independent paths exist for a permission decision to be made without
a human watching, and both are confirmed dead ends in OpenCode as it
ships today:

1. **A clean process boundary.** The expectation was that `opencode run`
   in headless/non-interactive mode would abort and exit when it hit a
   permission requiring approval, giving an external supervisor a natural
   place to decide (grant, restart with a relaxed rule, escalate). It
   does not. Confirmed via a cluster of open upstream issues, all
   describing the same root cause: a rule resolving to `"ask"` creates a
   Promise waiting on human input and publishes a UI event; in a headless
   context with nobody attached, the Promise never resolves and the
   process hangs forever. There is an open feature request for a proper
   non-interactive mode that would abort cleanly instead — not
   implemented. Sources: anomalyco/opencode issues #14473, #16367,
   #17516, #11899, #10411, #13851.

2. **A plugin deciding in-process.** `@opencode-ai/plugin`'s `Hooks` type
   declares a `permission.ask` hook — exactly the mechanism that would
   let a trained/rules-based process intercept a decision without the
   network-round-trip-expiry problem the REST API has (see below).
   Confirmed broken: **issue #7006**, open, no maintainer response — the
   permission evaluator (`packages/opencode/src/permission/next.ts`)
   publishes straight to the UI without ever calling
   `Plugin.trigger('permission.ask', ...)`. The hook is real in the type
   system and never invoked at runtime.

**Also confirmed, separately, from direct API testing this session:**
`POST /api/session/{id}/permission/{requestID}/reply` — the closest thing
to a "reply from outside" primitive — is unreliable in practice. The
request object expires server-side within seconds, faster than any
external process (including the architect, reacting as fast as possible
via the API) has ever managed to respond. Every attempt 404'd
(`PermissionNotFoundError`). Only the user's own local CLI/TUI has ever
reliably answered a live prompt. This is very likely the same root cause
as #7006 in a different guise, and probably explains at least one
multi-hour "stuck with no visible pending permission" session we hit
earlier in this project, before this was understood.

**Net effect:** there is currently no reliable native mechanism —
process boundary or plugin hook — for headless permission handling.
"Shrink the permission surface until asks are rare" isn't the cheap
option among several; it's the only one that currently works at all.

### If we forked and patched it ourselves

**Patching `permission.ask` is more tractable than "write a fix" implies.**
Someone already built one: **PR #39442** (open, unmerged as of this
writing) rebases an earlier attempt onto OpenCode's current
Effect/service architecture, adds the plugin-decides-before-prompting
path, and includes tests (plugin allow, plugin deny, failure fallback,
request-mutation isolation). It isn't merged because two reviewers
flagged specific, narrow correctness concerns:

- **Cancellation handling** — `Effect.catchCause` also catches
  interruption, so a permission hook pending when the session/tool fiber
  is cancelled can reset the result to `"ask"` instead of respecting the
  cancellation.
- **Shallow-copy mutation isolation** — the defensive copy of request
  data passed to the hook doesn't deep-copy nested `metadata`, so a
  plugin could mutate retained state in a pending request.

Both matter a great deal for a public tool serving arbitrary third-party
plugins under arbitrary interruption timing. Both matter much less for
one internal fork running plugins we write ourselves, in sessions we
drive ourselves. That's a real, favorable asymmetry: what's blocking
*upstream* merge is largely orthogonal to *our* risk profile. Applying
this PR's diff to our own fork — accepting the two edge cases as known,
low-probability debt, or fixing them if we want the belt-and-braces
version — looks like a modest effort, not a from-scratch build.

**"Cutting back to only what we need" is closer to "confirm a boundary
that already exists" than "strip code."** The monorepo
(`anomalyco/opencode`, MIT licensed, TypeScript on **Bun** — `bun.lock`/
`bunfig.toml`, not npm/Node's usual lockfile) splits into ~28 packages.
The ones that matter to us:

```
packages/opencode   — core: agent loop, tool execution, permission system
packages/server      — the HTTP API this whole project drives (opencode serve)
packages/plugin      — the hook system (permission.ask, tool.execute.before, ...)
packages/sdk, sdk-next, protocol, schema — shared types/client
```

versus packages we've never touched and don't need: `tui`, `web`,
`desktop`, `console`, `enterprise`, `identity`, `slack`, `stats`,
`session-ui`, `storybook`. In practice we're already running the
stripped-down shape — headless `opencode serve`, driven purely by HTTP
API, with the TUI only ever present as the architect's own local client
for watching and clicking allow.

**Not yet verified — the actual open question if this gets picked up:**
whether `packages/server` has a hard *build-time* dependency on
`tui`/`web` even without a *runtime* one. Turborepo can pull the whole
graph into a build even when only one package's output actually runs.
Confirming this needs a real clone-and-inspect pass (`package.json`
dependency graphs, an isolated `turbo build --filter=server...` or
equivalent), not something answerable from docs or issue threads.

### Where this stands

**Not being pursued now** — "we'll keep on as we are" was the explicit
call, this is forward-looking research for if/when headless operation
becomes a real requirement (e.g. once the loom has its own repo and a
scheduler needing unattended agent runs). If it is picked up:

1. Clone the repo, confirm the build-boundary question above.
2. Decide whether to apply PR #39442 as-is, fix the two flagged edge
   cases first, or take a different approach to the same problem
   informed by having read the real code rather than issue summaries.
3. Design the actual policy the `permission.ask` hook would enforce —
   this note only establishes that the mechanism *could* exist, not what
   it should decide. That's a separate, larger design question (rules
   engine? trained classifier? something closer to the standing
   instructions this project already writes for its subagents?).
