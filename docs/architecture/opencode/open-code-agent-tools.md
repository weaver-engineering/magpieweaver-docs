# OpenCode Agent Tools

Agreed in the `opencode-configuration` chat. Companion document:
`open-code-sub-agents.md` (which sub-agent gets which tool/permission).

## 1. Tool Mechanism

OpenCode custom tools are plain TypeScript/JavaScript modules under
`.opencode/tool/*.ts` (project-local) or `~/.config/opencode/tool/*.ts`
(global), using the `tool()` helper from `@opencode-ai/plugin`. They run
in-process — no separate server to build, run, or maintain. The tool
definition can shell out to any real CLI; TypeScript is only the
definition layer.

```typescript
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "...",
  args: { /* zod-style schema via tool.schema */ },
  async execute(args, context) {
    // shells out to the real CLI, parses --json output, returns structured data
  },
})
```

## 2. Tool: `gate-check`

**Status: real today** — wraps the already-in-repo `pnpm gate-check`
CLI (`gate-checks-lld.md`).

**File:** `.opencode/tool/gate-check.ts`

**Requirements:**
- Exposes at minimum `run(checkName, args)` → returns the parsed
  `GateCheckResult` (per `gate-checks-lld.md` §2) directly to the model,
  not raw CLI text.
- `args` **must** include `ref` — never inferred from branch name inside
  the tool; passed straight through to `pnpm gate-check <checkName> --json
  --ref <ref> ...`.
- Surfaces a failed/violating check as a normal structured result
  (`passed: false`, `violations: [...]`), not a thrown error — a gate
  failure is an expected, common outcome, not exceptional.
- A genuinely malformed invocation (unknown check name, bad args) surfaces
  as a tool error the agent can see and react to.

**Example configuration:**

```typescript
// .opencode/tool/gate-check.ts
import { tool } from "@opencode-ai/plugin"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

export default tool({
  description: "Runs a named gate-check (test-gate, build-gate, main-gate) against the current working tree",
  args: {
    checkName: tool.schema.string().describe("e.g. test-gate, build-gate, main-gate"),
    ref: tool.schema.string().describe("Task ref, e.g. AAA-001"),
  },
  async execute(args, context) {
    const { stdout } = await run("pnpm", [
      "gate-check", args.checkName, "--json", "--ref", args.ref,
    ], { cwd: context.directory })
    return JSON.parse(stdout) // GateCheckResult
  },
})
```

**Correction (found live, MAG-40 §3bn):** the real implementation
originally omitted `context` from `execute` entirely and called `execFile`
with no `cwd`, so every call ran against the OpenCode *server* process's
own working directory — wherever `opencode serve` was launched from —
regardless of which session/worktree actually invoked the tool. Every
agent session was silently affected from this tool's very first
deployment; nobody noticed because each agent worked around the
"detached main checkout" result as an apparent environment quirk rather
than a bug. `context.directory` (the plugin SDK's own documented field
for exactly this) is required, not optional, for any custom tool that
shells out — the example above now reflects that.

## 3. Tool: `task`

**Status: real today, complete** — `task-phases` shipped all 18
`task-MAG-46-*` chunks; `status`, `init`, `list`, `promote`, `wip`, and
the `<ref>`-switch command are all real, fully-flagged implementations.
The "one method at a time, only once its backing CLI command is real"
build-out this section originally described is finished — this is now a
single tool exposing the whole command surface, not an incrementally
growing one. The `task-phases-tool-readiness-mapping` chat-spec this
section pointed to as a follow-up is superseded; there's no remaining
mapping to track.

**File:** `.opencode/tool/task.ts` (named after the `pnpm task` command
it wraps, not `task-phases.ts` — corrected from this section's original
naming).

**Requirements:**
- A single `command` argument selects the real CLI command 1:1
  (`status`, `promote`, `init`, `list`, `wip`, or a bare ref for the
  `<ref>`-switch command), wraps `pnpm task <command> [...args] --json`,
  and returns the parsed `TaskPhasingCommandResult` (per
  `task-phasing-lld.md` §2) directly.
- A tool existing doesn't guarantee every behavior behind it covers
  every real-world shape — an agent can still hit a genuine limitation
  (see the note below on `ready/{ref}`). That's expected, not an error
  contract to design around here; the agent falls back to its own
  standing-instructions procedure for that specific case.

**Known, permanent limitation — not a gap awaiting a future chunk:** the
derivation pipeline behind `status`/`promote` models exactly four
phases — `spec`/`test`/`build`/`quick` — and has no concept of
`ready/{ref}` at all. That branch is a manual convention
`build-implementer` uses to work around `build/{ref}` being
branch-protected (see `open-code-sub-agents.md` §3's `build-implementer`
entry), introduced after this tool's phase model was fixed, and never
folded into it. `build-implementer`'s standing instructions keep the
`ready/{ref}`-specific mechanics (creation, base-still-current check,
transplant) in raw `git` for exactly this reason. Teaching the
derivation pipeline about a `ready` phase would be new `task-phases`
product work, not a tool-definition update — out of scope here.

**Example configuration:**

```typescript
// .opencode/tool/task.ts
import { tool } from "@opencode-ai/plugin"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

export default tool({
  description: "Runs a pnpm task-phases command (init, status, list, promote, wip, or a bare task ref for the ref-switch command) and returns its structured JSON result.",
  args: {
    command: tool.schema.string().describe("status, init, list, promote, wip, or a bare ref e.g. AAA-001"),
    args: tool.schema.array(tool.schema.string()).optional(),
  },
  async execute(args, context) {
    const { stdout } = await run(
      "pnpm",
      ["task", args.command, ...(args.args ?? []), "--json"],
      { cwd: context.directory },
    )
    return JSON.parse(stdout) // TaskPhasingCommandResult
  },
})
```

**Correction (found live, MAG-40 §3bn):** same `context.directory`/`cwd`
requirement as `gate-check` (§2) — the real implementation omitted it
entirely until then, silently running every `task` call against the
OpenCode server's own working directory rather than the calling
session's.

## 4. Permission Scoping (edit / bash)

Not custom tools — OpenCode's built-in `edit`/`bash` permission system,
configured per sub-agent. Full matrix and rationale live in
`open-code-sub-agents.md` §3; recorded here only as the shared convention
both docs depend on:

- **Test package:** `test/packages/**`
- **Public interfaces (build-immutable):** `packages/**/*.interface.ts` —
  suffix used only for interfaces meant to be immutable across the
  test/build boundary, not applied to every interface in the codebase.
- **Implementation:** `packages/**` minus `*.interface.ts`

Mechanical enforcement of the interfaces glob's immutability (mirroring
the existing test-package rule in `build-gate`/`main-gate`) is **not yet
built** — tracked as the `interface-glob-gate-extension` follow-up
chat-spec. Until that lands, the OpenCode `edit` permission is the only
guard in place for that boundary, which is weaker than the mechanical
CI-side check this project's own guardrail philosophy calls for
(Architecture Definition Document, Guard Rails §4) — worth not losing
sight of as a real, temporary gap rather than treating the IDE-level
convention as sufficient on its own.

## 5. Tool Additions Pair With Permission Removals And Supervision Review

Git/GitHub write actions (`commit`, `push`, `gh pr create`) are each
sub-agent's own responsibility throughout — performed via scoped `bash`
permissions until the corresponding `task-phases` method ships, at which
point that raw `bash` pattern is removed and the tool call takes over.
This isn't just a permission swap: it's a trust/railroading shift — the
agent goes from exercising its own judgement (higher oversight, likely
still interactive) to being offered a dictated correct action (safe to
supervise less closely, eventually headless). Full rationale in
`open-code-sub-agents.md` §5 and `orchestrating-sub-agent-flows.md` §2.

Consequence for this document's own maintenance: as the
`task-phases-tool-readiness-mapping` follow-up chat lands each method,
updating this file means **adding** the new tool method, **narrowing**
the relevant sub-agent's `bash` permissions, **and** reassessing whether
that phase is ready to move from interactive to headless operation — all
in the same change, not separate updates made at different times.

**Correction (MAG-40 §3bo):** in practice this didn't happen
incrementally, method by method, as originally envisioned above —
`task`'s methods all landed together at the end of MAG-46 (specs 16–18
shipped `list`, the remaining `promote` actions, and `status --fix`/
`init`'s flag variants in close succession), so the standing-instruction
side of this pairing happened as one blanket change (§3bo: all three
agents' Session Start Protocols rewritten to call `task` instead of raw
`git`) rather than per-method. **The other two-thirds of this section's
pairing — narrowing `bash` permissions and reassessing headless-readiness
— has *not* happened yet.** Every `git switch*`/`merge-base*`/`rebase*`
permission still stands exactly as before in all three agents'
frontmatter, and all three still run interactively. That's a real,
open follow-up this correction surfaces rather than silently leaves
inconsistent with what this section says should have happened —
tracked as new, separate work, not assumed done because the tool call
migration is.
