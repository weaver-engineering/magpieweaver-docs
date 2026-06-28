# Research: Magpie Weaver architecture

> **Status:** agreed research (statement of fact once merged via `RES-1`).
> **Captured:** 2026-06-28.
> **Source:** an AI-assisted research conversation (Google AI Mode share link)
> exploring how to build an AI agent that iteratively writes a book from lore
> books, character profiles, and plot direction. The link was behind a consent
> wall, so the content was provided by the author as pasted text.

This document is a **faithful summary of what the source says**. It records the
source's proposals and reasoning; it does **not** record our decisions. Our own
reservations and the open questions are collected at the end under
[Our stance](#our-stance-not-part-of-the-research) and are explicitly *not* part
of the research. Where the summary infers or interprets, it is flagged as such.

---

## 1. Guiding idea

The source's central thesis is to **apply the patterns of AI software
engineering (Specification-Driven Development + GitOps) to creative writing**:

- **Lore → database schemas** (world rules, geography, technology, canon).
- **Character profiles → state machines** (dynamic state: health, inventory,
  knowledge, psychological state, location).
- **Plot outlines → software specifications** (high-level goals + a queue of
  scenes to write).
- **Scenes → compiled source code** (the actual prose output).
- **A Git repository → the absolute source of truth** and the synchronisation
  layer across devices.

The author's own framing (from their question) matches this: an app that
maintains a data structure / file system / git repo and iteratively calls an AI
model with context drawn from characters, situation, and lore to generate the
next scene, then updates characters with new understanding and the world with
new truths.

## 2. Background: Specification-Driven Development (SDD) methodology

The source first describes a general SDD workflow for driving an AI coding agent
(in IntelliJ), which it then adapts to book-writing. Recorded here as context:

- **3-file setup:** `docs/spec.md` (single source of truth — inputs/outputs,
  rules, validation), `ai-instructions.md`/`.cursorrules` (how the agent must
  behave), `docs/progress.md` (a live checklist the agent updates).
- **Standard operating procedure:** draft the spec → lock a Git branch → prompt
  the agent to *plan only* (no code) → review/approve the plan → automated TDD
  loop (models, interfaces, tests, then implementation) → verify via CLI build
  (`mvn`/`gradle`) → auto-correct from the error output until the build passes.
- **A concrete spec template** (system context/endpoints, strict data models,
  business rules, test scenarios).
- **"Golden rules":** zero manual code edits (paste the stack trace to the agent
  instead, or it loses its state-machine context); enforce interface isolation
  (review interface signatures before implementation).

*(Note: this SDD section overlaps strongly with our own ways of working —
spec-first, plan/approve gates, TDD, no manual edits. That overlap is an
observation, not a research claim.)*

## 3. Repository structure

The source proposes a rigid directory layout so the agent can read/write
programmatically:

```
my-novel-repo/
├── .git/                  # tracks every iteration and scene draft
├── .agent/                # agent prompt templates and system state
├── lore/                  # the "database" / knowledge base
│   ├── world_rules.md     # magic systems, geography, technology constraints
│   └── timeline.json      # historical canon events
├── characters/            # the "state machines"
│   ├── protagonist.json   # dynamic state (inventory, health, wounds)
│   └── antagonist.json    # motivations, secret knowledge, location
├── plot/                  # the "software specification"
│   ├── act_1_outline.md   # high-level goals
│   └── scene_backlog.json # queue of upcoming scenes
└── manuscript/            # the "compiled code" (the book)
    ├── chapter_1/
    │   ├── scene_1_draft_1.md
    │   └── scene_1_final.md
    └── metadata.json      # word count, continuity validation flags
```

## 4. The agent execution loop

A stateful, four-stage loop run in a background thread for each scene:

```
[1. Context Assembler] -> [2. Scene Generator] -> [3. Continuity Linter] -> [4. State Committer]
  (reads lore/profiles)     (drafts the prose)      (validates rules/facts)    (updates JSON & Git)
```

1. **Context assembly.** Read the next item from `scene_backlog.json`; pull in
   *only* the relevant dependencies — the characters involved, the location/lore
   fragments, and the immediately preceding scene — acting like a compiler
   gathering dependencies.
2. **Generation.** Call a frontier LLM with a specific system prompt ("expert
   novelist engine"; honour character motivations, lore constraints, and the
   established prose style); receive raw markdown prose.
3. **Continuity linting.** Pass the draft to a **second, stricter LLM acting as
   a linter/compiler** whose only job is to catch continuity bugs (e.g. magic
   that violates `world_rules.md`; a character holding an item they lost
   earlier). On failure it rejects the output, feeds the error back, and demands
   a rewrite — the loop repeats until the draft passes.
4. **State mutation & commit.** Save the final scene; analyse it to mutate
   character JSON (e.g. `healthStatus: "injured"`) and record new
   `world_truths`; then `git add` + `git commit` (and, later, push). Git history
   gives an immutable record and the ability to `git revert` a plot path that
   goes off the rails.

## 5. Human-in-the-loop review

The source stresses not letting the agent run blind for hundreds of pages.
After each scene the app should pause and present a **pull-request-style view**:

- the drafted scene prose;
- the proposed **JSON diffs** for character/world files (e.g. *+1 secret
  learned*, *−1 sword*);
- an **Approve & Merge** action, or a **Request Changes** box for directing the
  agent ("make this scene darker; have the antagonist escape earlier").

## 6. How the architecture evolved (deployment analysis)

The source works through a sequence of deployment options and pivots. The
reasoning matters, so the progression is recorded:

1. **Local script / desktop app** — full filesystem + native Git access; works
   on desktop only. Mobile/tablet OS sandboxing blocks shell commands and native
   Git binaries.
2. **Isomorphic-Git in the browser** — a pure-JS Git running over a virtual
   filesystem (`lightning-fs` on IndexedDB), pushing to GitHub/GitLab over
   HTTPS; runs "anywhere" including mobile browsers.
3. **Supporting local + browser together** via the **Repository Pattern /
   dependency injection** — one `IBookRepository` interface, two implementations
   (`LocalBookRepo` with `simple-git`; `BrowserBookRepo` with `isomorphic-git`),
   injected by environment. Sensible **only if** the core language is
   TypeScript/JavaScript (Python can't run in a mobile browser without Pyodide).
4. **Pivot — drop Isomorphic-Git.** The author argued, and the source agreed,
   that **cloud enterprise is the only truly viable mobile architecture**, for
   three reasons: the mobile **background-execution wall** (iOS/Android kill
   background JS), the **context crunch** (tens of MB of lore/drafts crash mobile
   RAM), and the **developer-experience gap** (crypto-polyfills/FS-sync = fragile
   code). So target **Local Desktop execution + Enterprise Cloud** instead —
   both share the same foundation (standard filesystem + native Git binary).
5. **Unified REST abstraction.** Rather than two UIs, the UI **always talks to an
   API**; only the base URL changes (localhost vs cloud). One UI codebase across
   desktop/mobile/tablet.
6. **Single desktop app (no manual server).** Embed backend + UI in one app via
   **Tauri/Electron** using internal **IPC** (like VS Code/Obsidian/Slack), so
   double-clicking starts the engine and closing shuts it down — no terminal,
   no manually started local server.
7. **Git as the integration layer.** Desktop and cloud never talk directly; both
   **push/pull to a shared remote repo** which is the truth. This bridges the
   modes: write on mobile (cloud commits + pushes), then the desktop app silently
   `git pull`s on startup so local files (and IntelliJ) are current.

## 7. Final architecture

Two modes over a shared remote Git repo:

```
                 [ Private GitHub Repo ]   (shared source of truth)
                    ▲                 ▲
        git push/pull                 git push/pull
                    │                 │
      ┌─────────────────────┐   ┌─────────────────────────┐
      │  LOCAL DESKTOP MODE │   │  ENTERPRISE CLOUD MODE  │
      │  (single Tauri app) │   │  (API server + web UI)  │
      │  • offline          │   │  • long-running worker  │
      │  • edits local disk │   │  • background sync      │
      │  • native Git CLI   │   │  • mobile/tablet web UI │
      └─────────────────────┘   └─────────────────────────┘
```

- **Local Desktop Mode:** a single Tauri app; runs offline; edits local files;
  spawns the native Git CLI.
- **Enterprise Cloud Mode:** a lean API server (FastAPI/Express) on a cheap VPS,
  responsive web UI for mobile/tablet, long-running agent loop on a background
  thread (respond `202 Accepted`, stream via **WebSockets/SSE** so the mobile
  view doesn't time out).
- **Git-as-a-database** needs three automations: (1) **clone on first use** with
  a PAT + repo URL; (2) **auto-sync lifecycle hooks** — `git pull --rebase` on
  boot/focus, `git add/commit/push` on agent-action success; (3) **conflict
  isolation** — the agent works on a dedicated branch (e.g. `agent-writing`) and
  the human reviews/merges it into `main` via a UI button.

## 8. LLM hosting: two variants

The source presents two options and, in the final revision, leans toward the
proxy:

- **Self-hosted open-source models** (enterprise advantage): host models like
  DeepSeek-R1 or Llama 3.x on cloud GPUs via **vLLM/Ollama** — flat cost vs.
  per-token, valuable for huge lore-bible contexts. Requires GPU compute.
- **API-orchestrator / proxy (revised, preferred in the source):** the cloud
  backend hosts **no model**; it manages Git, background state, and **HTTPS calls
  to external commercial providers** (Anthropic, OpenAI, OpenRouter). This makes
  the server cheap (a "~$5/mo droplet / EC2 nano", minimal RAM/CPU), faster to
  deploy, and simpler. The continuity linter uses a **fast, cheap model**
  (a "7B-class" or "mini" model). API keys live in the server's `.env`.

## 9. Scaling note: RAG / vector search

For large projects (100k+ words, hundreds of lore entries), the source notes you
cannot pass everything in one prompt. It suggests a **vector database** (Qdrant,
Chroma, or pgvector) so the backend can **semantically retrieve** only the
relevant prior scenes/lore for continuity, instead of spending token budget on
irrelevant chapters. Presented as an enterprise-scale advantage.

## 10. Technology recommendations (as stated by the source)

- **Core language:** TypeScript/JavaScript favoured for dual desktop+mobile
  targeting; Python viable for a desktop/cloud-only split.
- **Desktop shell:** Tauri (preferred — lightweight, uses the system webview) or
  Electron.
- **Backend/API:** FastAPI (Python) or Express (Node.js).
- **Git libraries:** `simple-git` / `GitPython` (native); `isomorphic-git` +
  `lightning-fs` (browser — **dropped** in the final design).
- **Schema validation:** Zod (TS) or Pydantic (Python); `instructor` for
  schema-constrained LLM output.
- **Frontend:** React/Vue; `markdown-it` for prose; a diff view for JSON state;
  a Git commit-log viewer and a JSON editor for manual fixes.
- **Realtime:** WebSockets or SSE for streaming generation.
- **Vector DB (scale):** Qdrant / Chroma / pgvector.

## 11. Proposed development plan (the source's plan, revised variant)

An 8-week, four-phase plan (the variant **without** self-hosted models):

- **Phase 1 (Weeks 1–2) — Local foundation & state schemas.** TS/Python repo;
  Zod/Pydantic schemas for characters and plot; a filesystem/Git wrapper (clone,
  stage, commit, pull, push); a local script in IntelliJ that reads a file,
  calls the external AI SDK, and writes prose back.
- **Phase 2 (Weeks 3–4) — Agent loop & continuity linter.** The orchestrator
  loop; the linter prompt (tested by feeding a deliberately rule-breaking draft
  to confirm catch + self-correct); bind a passing lint to an auto-commit.
- **Phase 3 (Weeks 5–6) — Unified UI & Tauri desktop.** One web dashboard
  (commit-log viewer, JSON editor, diff view); wrap it in Tauri with IPC to the
  engine — a native desktop app with no separately started server.
- **Phase 4 (Weeks 7–8) — Cloud hosting & mobile.** Wrap the engine in
  FastAPI/Express; deploy to a cheap VPS; add WebSocket/SSE streaming; secure API
  keys in `.env`; frontend env switch points mobile browsers at the cloud URL.

---

## Our stance (NOT part of the research)

The following is **our** commentary, recorded separately so it does not
contaminate the research record. It is the input to the planning tasks that
follow.

- The author has twice stated reservations: *"I'm not sure what I think of this
  plan"* and *"I'm still not sure about this plan."* The plan is treated as **a
  starting point to evaluate, not an accepted design.**
- Points we will likely need to decide explicitly (candidates for planning /
  follow-up research, not conclusions): the choice of core language; whether to
  commit to the Tauri desktop + cloud-proxy shape; the LLM provider/hosting
  decision; whether Git-as-database is the right state model for Magpie Weaver
  vs. a database; how the metadata model (lore/characters/timeline/truths)
  should actually be structured; and how this relates to our own spec-driven
  ways of working.
- These are tracked onward via the existing planning ToDos and will be turned
  into SMART tasks under `PLAN-1`, informed by this research.
