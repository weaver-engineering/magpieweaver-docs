# Research: High-Level Design and Architectural Decision Records

> **Status:** agreed research (statement of fact once merged via `RES-3`).
> **Captured:** 2026-06-30.
> **Source:** author-provided research comprising one HLD document and five
> Architectural Decision Records (ADRs) prepared using Gemini, covering the
> full architecture of Magpie Weaver.

This document is a **faithful summary of what the source says**. It records the
proposals and reasoning in the source; it does **not** record our decisions.
Our own observations and open questions are collected at the end under
[Our stance](#our-stance-not-part-of-the-research). Where the summary infers
or interprets, it is flagged as such.

---

## 1. Architectural topology and codebase layout

The source proposes a **single TypeScript pnpm monorepo** (`magpie-weaver/`)
to power both deployment modes — Local Desktop and Enterprise Cloud — while
sharing core data models, validation schemas, and UI components.

```
magpie-weaver/
├── apps/
│   ├── desktop/     # Tauri v2 native runtime (Rust bindings & configuration)
│   ├── web/         # Shared frontend UI (React 19 + TypeScript + Vite SPA)
│   └── server/      # Cloud API server (Fastify + TypeScript)
├── packages/
│   ├── filestore/   # Data layer contracts & Git orchestration engine
│   └── infra/       # Cloud infrastructure-as-code (AWS CDK v2)
└── docs/            # System specifications and ADRs
```

## 2. Component architecture and data flow

The architecture strictly separates the UI from the state mutation engine and
physical storage via a decoupled **FileStore interface**:

```
┌─────────────────────────────────────────┐
│           APPS / WEB                    │
│  React 19 UI (Scene Editor, Lore Bible, │
│  Timelines, State Diff)                 │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│         PACKAGES / FILESTORE            │
│         FileStore Interface             │
│  (read, write, list, commit, revert)    │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
[ Local Desktop ]  [ Enterprise Cloud ]
  Tauri v2 IPC      Fastify API (HTTPS)
  Rust bridge       │
  │                 ▼
  ▼            Ephemeral FS
  Host FS +    + Remote Git
  Native Git
```

## 3. Core engine loop

Four sequential stages per scene:

1. **Context assembly.** Fetch character state, lore documents, and scene notes
   via the abstract FileStore interface.
2. **Generation pipeline.** Bundle assembled state and the author's scene
   direction and dispatch to the LLM orchestration layer.
3. **Continuity linting.** Pass raw output through a runtime validation filter
   checking for lore and state rule compliance.
4. **State mutation gate.** Derive state updates (inventory, character knowledge
   maps, etc.) and present them to the author as a proposed structural diff.
   On author approval, dispatch a `FileStore.commit()` transaction.

## 4. Deployment modes

### Local Desktop Mode (offline-first)

- Built as a native desktop binary using **Tauri v2**.
- Embeds the shared React frontend in the host OS native WebView (no Chromium
  overhead; binary under 20 MB).
- Connects directly to the local filesystem and invokes native Git CLI commands
  via a Rust-to-TypeScript IPC command bridge.

### Enterprise Cloud Mode (multi-device)

- Shared React UI deployed as a progressive web application served from a CDN.
- Connects to a persistent **Fastify/Node.js** API server containerised via
  Docker on **AWS ECS Fargate** behind an **Application Load Balancer (ALB)**.
- Infrastructure provisioned in `/packages/infra` using **AWS CDK v2**.
- ECS Fargate guarantees persistent runtime for long-running agent loops;
  ALB supports streaming via WebSockets/SSE natively.

## 5. Storage tier isolation — the FileStore contract

All persistence actions go through a strictly typed interface exported by
`/packages/filestore`:

```typescript
interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(directory: string): Promise<string[]>;
  commit(message: string): Promise<string>; // returns commit hash
  revert(commitHash: string): Promise<void>;
}
```

Three runtime implementations are proposed:

| Implementation | Used for |
|----------------|----------|
| `NativeGitFileStore` | Local Desktop — Tauri filesystem/Rust bridge + native Git CLI |
| `CloudGitFileStore` | Enterprise Cloud — container routing to remote Git |
| `InMemoryMockFileStore` | CI/testing — zero-dependency in-memory simulation |

## 6. Architectural Decision Records

### ADR-001 — Technology Stack Selection (Approved)

**Decision:** Standardise on React 19 + TypeScript + Tailwind CSS (Vite) for
the frontend; Tauri v2 for the desktop container; Node.js + Fastify for the
cloud API.

**Key rationale:**
- LLMs have the highest training-token density in the React/TypeScript
  ecosystem, reducing hallucinated APIs and improving agent throughput.
- TypeScript's type system acts as a validation rail, converting runtime bugs
  into compile-time errors the agent can autonomously diagnose.
- Tauri v2 uses the host OS native WebView rather than bundling Chromium,
  keeping the binary under 20 MB with a secure Rust IPC core.
- Fastify inside a persistent ECS Fargate container supports long-running LLM
  generation without serverless timeout limits, streaming via WebSockets/SSE.

**Consequence to note:** requires an explicit IPC abstraction layer to translate
Tauri `invoke()` actions into web-standard `fetch`/WebSocket messages depending
on platform.

---

### ADR-002 — Repository Layout Strategy (Approved)

**Decision:** House all application code, infrastructure-as-code, and markdown
specifications in a **single pnpm monorepo** under one Git tracking tree.

**Key rationale:**
- An AI agent's context window cannot span multiple repositories without
  thrashing; collocating specs in `/docs` alongside code keeps the agent's view
  of the blueprint un-degraded.
- A single branch contains the complete evolution of a feature: spec
  modification + failing tests + production code, reviewable as one atomic
  package.
- A single `.git` tree prevents concurrent file locks that can leave agents in
  a detached-HEAD state.
- Internal packages (e.g. `/packages/filestore`) link to app targets
  (`/apps/desktop`) via pnpm workspace protocols without publishing to private
  registries.

**Consequence to note:** code refactors and planning text modifications mingle
in the commit history.

---

### ADR-003 — Operational Separation via Task Modes (Approved)

**Decision:** Enforce a **Three-Phase Task Execution Gate** on every development
branch — Spec Mode → Test Mode → Act Mode — to prevent code-bleeding and scope
creep by the agent.

- **Spec Mode:** agent edits only `/docs/` to build a markdown blueprint.
  Gate: author reviews and merges the spec.
- **Test Mode:** agent edits only test files (`*.test.ts`) to write a
  comprehensive suite of *failing* tests that trap the approved spec's
  behaviours. Gate: author verifies tests fail for the correct reasons.
- **Act Mode:** agent edits `/apps/` or `/packages/` to write the minimal
  production code that makes the test suite green. Gate: author reviews and
  squash-merges.

**Key rationale:**
- Dividing work into modes prevents the agent from trying to fix a bug while
  simultaneously defining requirements for that fix (AI thrashing).
- Mandatory Test Mode forces tests to be written against the spec, not against
  a flawed implementation — the agent cannot shortcut the test suite in Act
  Mode.
- Three small review gates are less cognitively taxing for the author than one
  massive mixed PR.

**Consequence to note:** author participates in three review gates per task
rather than one.

---

### ADR-004 — Storage Tier Isolation (Approved)

**Decision:** Isolate all storage and persistence operations behind the
**FileStore abstraction interface** in `/packages/filestore`. All other layers
(UI, agent pipelines, linting) interact solely through this contract.

**Key rationale:**
- Decoupling the UI from filesystem mechanics future-proofs the platform;
  swapping the storage backend (e.g. from Git to S3 + database) requires no
  changes to frontend code.
- `InMemoryMockFileStore` eliminates physical disk I/O in tests, enabling
  thousands of read/write/revert cycles in milliseconds.
- The abstraction normalises environmental path variations (Windows local paths
  vs. ephemeral Linux container paths).

**Consequence to note:** requires CI linter rules to strictly block any rogue
direct filesystem reads or writes outside the interface contract.

---

### ADR-005 — Cloud Hosting Infrastructure Topology (Approved)

**Decision:** Deploy the Fastify API server as a Docker container on **AWS ECS
Fargate** behind an **AWS Application Load Balancer (ALB)**, with infrastructure
defined in TypeScript via **AWS CDK v2** in `/packages/infra`.

**Key rationale:**
- AWS Lambda's 15-minute execution limit and cold-start latency are incompatible
  with long-running LLM scene generation; ECS Fargate containers remain
  persistently alive.
- ALB natively supports persistent WebSocket/SSE connections without requiring
  external state management (unlike API Gateway WebSockets).
- AWS CDK v2 in TypeScript means infrastructure is declared in the same language
  as production logic, validated by the monorepo's type checker, and modifiable
  by the agent without console access.

**Consequence to note:** a persistent Fargate task incurs a continuous baseline
monthly cost (no scale-to-zero), requiring careful CPU/memory sizing.

---

## Our stance (NOT part of the research)

The following is **our** commentary. It is the input to the planning tasks that
follow.

- **ADR-003's three-phase model maps directly to our ways-of-working gates**
  (Spec → Tests → Implementation). The terminology differs (Spec Mode / Test
  Mode / Act Mode vs. our Spec / Tests / Implementation) but the intent is
  identical. This is strong independent validation of our process; no change
  to ways-of-working is needed.
- **ADR-002 establishes a single implementation monorepo** (`magpie-weaver/`)
  alongside this docs repo (`magpie-weaver-docs/`). The open ToDo about
  deciding the implementation repo(s) is answered: one monorepo. The
  cross-repo branch naming convention (branch names identical across repos)
  carries across.
- **The FileStore interface in ADR-004 is precisely what we scoped for E4**
  (Git-backed file store). The interface definition and three implementations
  are well-specified and can feed directly into E4 planning.
- **The tech stack is now decided** (TypeScript + React 19 + Tauri v2 +
  Fastify + AWS CDK v2). This closes the language/stack open ToDo and directly
  informs E1 (repository creation) and E2 (Hello World prototype).
- The "Export Option" footer present in each ADR is a Gemini UI artefact; it
  is not part of the research content.
- Open questions for planning: how `/docs` in the monorepo relates to this
  `magpie-weaver-docs` repo (are they the same, or does the monorepo `/docs`
  hold specs while this repo holds process/planning?); whether the `packages/infra`
  CDK code is in scope for E2 or deferred to later.
