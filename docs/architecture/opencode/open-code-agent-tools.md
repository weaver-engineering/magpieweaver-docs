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
  async execute(args) {
    const { stdout } = await run("pnpm", [
      "gate-check", args.checkName, "--json", "--ref", args.ref,
    ])
    return JSON.parse(stdout) // GateCheckResult
  },
})
```

## 3. Tool: `task-phases`

**Status: incremental** — `task-phases` itself is being built
(`task-MAG-46-*` specs) by hand-cranking the equivalent mechanical steps
manually in the meantime. This tool's methods are added **one at a time**,
only once a real, working `task-phases` command exists behind them — no
speculative stubs, no pre-declared "not implemented" methods.

**File:** `.opencode/tool/task-phases.ts`

**Requirements:**
- Each method mirrors the real CLI command 1:1 (`status`, `promote`,
  `init`, `list`, `wip`, the `<ref>`-switch command) and wraps `pnpm task
  <command> --json ...`, returning the parsed `TaskPhasingCommandResult`
  (per `task-phasing-lld.md` §2) directly.
- A method is **only added to this file once its backing CLI command is
  real** — an agent should never be offered a tool call that can't do
  anything. This keeps the tool list from being swamped with speculative,
  not-yet-working methods.
- A tool existing doesn't guarantee every behavior behind it is complete —
  an agent can still hit a real gap on an edge case whose spec hasn't
  landed. That's expected, not an error contract to design around here;
  the agent falls back to its own standing-instructions procedure for that
  case, same as before the tool existed.
- **Exact mapping of which `task-MAG-46-*` spec(s) unlock which method,
  and which are needed for a method to be considered fully complete, is
  tracked separately** — see the `task-phases-tool-readiness-mapping`
  chat-spec (follow-up, not yet run).

**Example configuration (once `status` is real):**

```typescript
// .opencode/tool/task-phases.ts
import { tool } from "@opencode-ai/plugin"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

export const status = tool({
  description: "Reports the derived phase/state of the current or named task",
  args: {
    ref: tool.schema.string().optional(),
    check: tool.schema.boolean().optional().describe("resolve ready? via gate-check"),
  },
  async execute(args) {
    const cliArgs = ["task", "status", "--json"]
    if (args.ref) cliArgs.push("--ref", args.ref)
    if (args.check) cliArgs.push("--check")
    const { stdout } = await run("pnpm", cliArgs)
    return JSON.parse(stdout) // TaskPhasingResult
  },
})

// promote, init, list, wip, <ref>-switch added the same way, one at a
// time, as each becomes real.
```

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
