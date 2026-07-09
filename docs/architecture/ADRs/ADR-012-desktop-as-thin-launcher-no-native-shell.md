# ADR-012 — Desktop as Thin Launcher, No Native Shell (Approved)

**Decision:** Replace the originally proposed Tauri v2 native shell with a
thin launcher: the desktop app spawns a local Fastify backend (if not
already running) and hands off to the system default browser once the
backend is responsive. No native (Rust) IPC bridge is used.

**Key rationale:**
- Removes the Rust IPC bridge, the one component of the original stack (ADR-001)
  with low LLM training-token density, in a codebase that is 100%
  agent-authored — this was the highest agent-hallucination-risk surface in
  the original design.
- Desktop is a convenience surface, not the primary target (mobile is,
  see ADR-013 below), so the UX simplicity/binary-size benefits Tauri
  originally offered are no longer worth the added implementation risk.
- The backend, UI, and persistence layer are already designed to run
  together on a single machine; the launcher only needs to orchestrate
  process startup and browser handoff, not provide a full native shell.

**Consequence to note:** the desktop experience reads as "a local webpage,"
not a native app (browser chrome, no custom app window) unless further UX
work is done; requires an explicit answer for backend process lifecycle
(what stops the backend when the user is finished — see HLD §12.1, still
open) to avoid orphaned background processes, particularly on Windows.