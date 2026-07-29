# Standard Chat Requests

Agreed in the `opencode-configuration` chat. Pairs with
`standard-chat-handover-responses.md` — a prompt in, a payload out.
Feeds directly into the `-instructions.md` files (Objective 4), since a
short standard prompt only works if the agent's own standing instructions
carry the actual procedure.

## 1. Full List Of Theoretically Possible Standard Chats (Phase × State)

Crossing the three agent-owned phases against `task-phasing-lld.md`'s
full `PhaseState` enum:

| `PhaseState` | test-writer | build-implementer | quick-scaffolder |
|---|---|---|---|
| `not-started` | **Begin** | — (build never starts here; see `merged-pending-pull`) | **Begin** |
| `work-in-progress` | **Resume** — incl. self-handling a spec-amended rebase-forward (`task-phasing-lld.md` §1.7.1) if pending | **Resume** — incl. self-handling a `main`-drift or cascading build-reorder rebase-forward (§1.7.2/§1.7.3) if pending | **Resume** — incl. self-handling a `main`-drift rebase-forward (§1.7.2) if pending |
| `ready?` (unresolved) | **Resume** — notably the re-entry point after returning from an interactive `needs-architect-intervention` session back to headless mode | **Resume** (same) | **Resume** (same) |
| `ready` | no chat — handled within the current session; the agent itself raises the PR once its own `gate-check` call confirms `ready` | same | same |
| `blocked` | **Usually no chat.** Most `blocked` results reported by `gate-check` are ordinary, agent-resolvable mid-session information — too many commits → squash; failing tests → debug and fix, etc. Only the rare case where the violation is genuinely outside the agent's own authority to fix (`standard-chat-handover-responses.md` §3) ends the chat. | same | same |
| `awaiting-pr` | no chat — interim status while a human reviews; next chat only starts once merged | same | same |
| `merged-pending-pull` | n/a (test phase doesn't merge into itself) | **Begin** (pull + possible rebase-reorder, then start) | n/a |
| `merged-pending-cleanup` | no chat — task closed, no agent involved | same | same |

## 2. Agreement: Which Are Fully Defined Now

**Six**, not twenty-plus: `Begin` and `Resume`, once per sub-agent.
`ready?` doesn't get its own template — it reuses the generic `Resume`
prompt, since re-deriving state is exactly what `Resume` is for, whether
the reason for resuming is an ordinary WIP continuation, a cleared
rebase, or an architect having just resolved a
`needs-architect-intervention` case (e.g. installed a missing dependency)
and handing the session back to headless mode. There's no separate
"return to headless" prompt needed beyond `Resume` itself.

`build-implementer`'s `Begin` starts from `merged-pending-pull`, not
`not-started` — `build/{ref}` doesn't exist until the Build Gate PR
merges, so its kickoff always includes the pull (and, on the cascading
route, a rebase-reorder) as its first action, not a separate chat.

`blocked` is **not** generally a chat-ending state — most gate-check
violations are things the agent fixes and re-runs the gate against, same
session. It only reaches `standard-chat-handover-responses.md`'s
`blocked` outcome in the narrow case already agreed there.

## 3. Shared Template Variables

Every prompt below is filled from: `{ref}`, `{taskDocPath}`
(`docs/tasks/{ref}/task-{ref}.md`), `{specDocPaths}` (one or more
`task-{ref}[-NN]-spec.md`). The agent's full procedure lives in its own
`-instructions.md`, loaded via `--agent <name>` — these prompts are
deliberately short triggers, not a restatement of standing instructions.

## 4. The Six Standard Prompts

### `test-writer` — Begin
```
Begin the test phase for {ref}.
Task doc: {taskDocPath}
Spec doc(s): {specDocPaths}
Confirm the derived state genuinely matches a test-phase start before making any edits.
```

### `test-writer` — Resume
```
Resume work on {ref} in the test phase.
Re-derive the current state before continuing — do not assume the state you left off in still holds.
If spec/{ref} has been amended since test/{ref} forked from it, self-handle the rebase-forward before continuing any other work.
```

### `build-implementer` — Begin
```
Begin the build phase for {ref}.
Task doc: {taskDocPath}
Spec doc(s): {specDocPaths}
The Build Gate PR has merged; pull build/{ref} (resolving any pending rebase-reorder first) before making any edits.
```

### `build-implementer` — Resume
```
Resume work on {ref} in the build phase.
Re-derive the current state before continuing — do not assume the state you left off in still holds.
If a superseded Build Gate PR requires build/{ref} to be pulled and reordered, self-handle that before continuing any other work.
```

### `quick-scaffolder` — Begin
```
Begin the quick task for {ref}.
Task doc: {taskDocPath}
Confirm the derived state genuinely matches a quick-task start before making any edits.
```

### `quick-scaffolder` — Resume
```
Resume work on {ref} on the quick route.
Re-derive the current state before continuing — do not assume the state you left off in still holds.
If main has drifted ahead of task/{ref}, self-handle the rebase-forward before continuing any other work.
```

## 5. Consequence For `-instructions.md`

Because every `Resume` prompt is identical in shape (re-derive state,
self-handle any pending rebase, don't trust prior assumptions), each
sub-agent's standing instructions must open with **"always re-check
derived state at the start of a session, before any edit, and self-handle
any pending rebase-forward for your own canonical branch before doing
anything else"** as a first-line rule — not just as a reaction to a
specific handover outcome. The same instructions must also make clear
that a failing `gate-check` is routine, expected, working information —
squash, debug, fix, and retry within the same session — and only the
narrow `standard-chat-handover-responses.md` §3 case is ever a reason to
end the chat over it.
