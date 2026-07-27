# Task MAG-46 - `--dev-testing` CLI: argument encoding & execution semantics

**Companion to:** `task-MAG-46.md`
**Status:** design note, not a TDD spec — referenced by MAG-46-01, 02, 03,
08, 13, and by MAG-46-00's scaffolding. No Given/When/Then here; this pins
down a convention those specs assume.

## 1. Why this exists
`--dev-testing` doesn't appear in `task-phasing-lld.md` at all — it's a
mechanism introduced specifically to make `deps/*.ts`'s real wrappers
system-testable, since they have no behavior observable through any
ordinary command. Five chunks depend on this CLI surface having exactly
one, consistent grammar rather than each inventing its own ad hoc
argument-passing convention.

## 2. Grammar
```
pnpm task --dev-testing <tool> <method> [--args-file <path>] [--json]
pnpm task --dev-testing <tool> <method> -i [--json]
```

- **`<tool>`** — one of `git` | `gh` | `fs` | `gate-check`, mapping onto
  `ExternalTools.git` / `.github` / `.fileSystem` / `.gateChecks`
  respectively.
- **`<method>`** — the exact method name from that tool's interface
  (§4.7.1/§4.8/§4.9/§4.10 of `task-phasing-lld.md`), e.g. `branchExists`,
  `createPR`, `loadConfig`, `run`.
- **Arguments are always a single JSON object** — `map<string, any>` —
  whose keys are exactly the target method's named parameters, in the
  order documented in its TypeScript signature. Optional parameters are
  simply omitted. E.g. `GitTool.branchExists(branch, opts?)` takes:
  ```json
  {"branch": "spec/AAA-001", "opts": {"remote": true}}
  ```
- Zero-argument methods (`fetch`, `currentBranch`) need no args source at
  all — its absence is treated as `{}`.

## 3. Supplying the arguments object
Two equivalent sources, either always works:

- **`--args-file <path>`** — path to a file containing the JSON object.
- **`-i`** — reads the JSON object from stdin, terminated by EOF. Useful
  for one-off shell invocations without a scratch file:
  ```bash
  pnpm task --dev-testing git branchExists -i << EOF
  {
    "branch": "spec/AAA-001",
    "opts": {"remote": true}
  }
  EOF
  ```

Both feed the same parse/validate step — there is exactly one JSON-parsing
code path regardless of which source supplied it.

## 4. Output
Reuses the existing `--json` serialization already built for ordinary
commands (§4.1) — a successful call's return value is wrapped the same
way a normal `TaskPhasingResult` wraps a command's result; a thrown error
is wrapped the same way a normal command's failure is. Without `--json`,
the same value is pretty-printed for a human instead.

## 5. Exit codes
Consistent with §4.1's existing contract, no new rule needed:

- **`2`** — invalid argument: unknown `<tool>`, unknown `<method>` on a
  known tool, or malformed/unparseable JSON from `--args-file`/`-i`.
- **`1`** — the real method call threw (a real git/gh/fs/gate-check
  error).
- **`0`** — the real method call resolved, regardless of what it resolved
  *to* — a `false`/`null` return is still a successful CLI exit; that
  distinction lives in the reported value, not the exit code.

## 6. Working-directory semantics
Every real tool implementation — not just `--dev-testing`'s, every
command's — must resolve the repository relative to **`process.cwd()`**,
never relative to wherever the `task-phases` package itself is installed
on disk. This is what makes it possible to `cd` into an entirely separate
sandbox repo and run `pnpm task ...` there, with every `git`/`gh` call
underneath operating on the sandbox's own `.git` and remotes rather than
`task-phases`'s own.

In practice:
- Git-backed methods should rely on git's own discovery from cwd (e.g.
  `git rev-parse --show-toplevel`), never a path baked in at build time.
- `fs`-backed methods (`loadConfig`'s walk-up in particular, §4.10) already
  work this way by construction — no change needed there, just confirming
  the same rule applies.
- `gh`-backed methods rely on the `gh` CLI's own cwd-relative repo
  detection, same principle.

This is a real constraint discovered from setting up sandbox testing, not
a hypothetical — get it wrong and every `--dev-testing`/system-level spec
that assumes "run from inside the sandbox repo" silently operates on the
wrong repository instead of failing loudly.

## 7. Test-harness vs. real execution — two different things, one surface
Worth stating explicitly, since it's easy to conflate:

- **Real-world execution** (MAG-46-01/02/03/08/13's actual behaviors): a
  genuine `pnpm task --dev-testing ...` process, against real tools, real
  git, a real sandbox repo — no mocks anywhere.
- **Automated system tests** (MAG-46-04 onward's command specs): the same
  CLI entry surface, but with a mocked `ExternalTools` instance injected
  in-process rather than the real one `cli.ts` would otherwise construct.
  Concretely: `cli.ts` exposes a testable entry point — e.g.
  `run(argv, tools)` — that does all the real argv-parsing/dispatch/exit-
  code work; the actual `bin` script calls `run(argv, buildRealTools())`;
  the test harness calls `run(argv, mockTools)` directly. As long as both
  paths go through the *same* `run()`, a system test genuinely exercises
  the real parsing/dispatch/exit-code logic, with only the tool
  implementations swapped — nothing about "system-level" requires
  spawning a subprocess.

## 8. Status
MAG-46-01, 02, 03, 08, and 13 have all been written (and, where already
drafted, rewritten) directly against this grammar — there is no remaining
informal shorthand standing in for it anywhere in the backlog.
