---
created: 2026-07-04T13:44:32+01:00
modified: 2026-07-04T18:40:54+01:00
---

# Initial draft - Magpie Weaver — High-Level Design (HLD)

> **Status:** agreed research (statement of fact once merged via `RES-3`).
> **Captured:** 2026-06-30.
> **Source:** author-provided research (HLD + five ADRs, prepared using Gemini).
>
> This document summarizes the architecture only. The five ADRs are tracked
> separately and are referenced, not repeated, here.

---

## 1. Overview

Magpie Weaver is architected as a single TypeScript pnpm monorepo powering two
deployment modes — **Local Desktop** and **Enterprise Cloud** — that share
core data models, validation schemas, and UI components through a decoupled
storage abstraction.

## 2. Codebase Layout

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

## 3. Component Architecture & Data Flow

The UI is strictly separated from the state mutation engine and physical
storage via a decoupled **FileStore interface**:

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

## 4. Core Engine Loop

Four sequential stages per scene:

1. **Context assembly** — fetch character state, lore documents, and scene
   notes via the abstract FileStore interface.
2. **Generation pipeline** — bundle assembled state and the author's scene
   direction, dispatch to the LLM orchestration layer.
3. **Continuity linting** — pass raw output through a runtime validation
   filter checking lore and state rule compliance.
4. **State mutation gate** — derive state updates (inventory, character
   knowledge maps, etc.), present as a proposed structural diff; on author
   approval, dispatch a `FileStore.commit()` transaction.

## 5. Deployment Modes

### 5.1 Local Desktop Mode (offline-first)

- Native desktop binary built with **Tauri v2**.
- Embeds the shared React frontend in the host OS native WebView (no Chromium
  overhead; binary under 20 MB).
- Connects directly to the local filesystem and invokes native Git CLI
  commands via a Rust-to-TypeScript IPC command bridge.

### 5.2 Enterprise Cloud Mode (multi-device)

- Shared React UI deployed as a progressive web app served from a CDN.
- Connects to a persistent **Fastify/Node.js** API server, containerized via
  Docker on **AWS ECS Fargate** behind an **Application Load Balancer (ALB)**.
- Infrastructure provisioned in `/packages/infra` using **AWS CDK v2**.
- ECS Fargate provides a persistent runtime for long-running agent loops; ALB
  natively supports WebSocket/SSE streaming.

## 6. Storage Tier Isolation — the FileStore Contract

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

Three runtime implementations:

| Implementation | Used for |
|----------------|----------|
| `NativeGitFileStore` | Local Desktop — Tauri filesystem/Rust bridge + native Git CLI |
| `CloudGitFileStore` | Enterprise Cloud — container routing to remote Git |
| `InMemoryMockFileStore` | CI/testing — zero-dependency in-memory simulation |

## 7. Related Decision Records

Architectural rationale and consequences for the decisions above are tracked
in the separate ADR set (ADR-001 through ADR-005), covering: technology stack
selection, repository layout strategy, operational task-mode gating, storage
tier isolation, and cloud hosting topology.

---

## 8. Sections Requiring Further Detail

The source material does not cover the following areas. Each is a placeholder
so the HLD reflects the full shape of the system — fill in as decisions are
made.

### 8.1 Security & Authentication
**TODO:** Document auth strategy for Enterprise Cloud Mode (user identity
provider, session/token model, how the desktop client authenticates against
the cloud API if at all), authorization model for multi-user/shared projects,
and secrets management for the Fastify server and CDK-provisioned infra.

### 8.2 Data Model & Schema Design
**TODO:** Define the concrete shape of character state, lore documents, scene
notes, and inventory/knowledge maps referenced in the Core Engine Loop —
schema definitions, versioning strategy, and how schema changes propagate
across `NativeGitFileStore` and `CloudGitFileStore` implementations.

### 8.3 LLM Orchestration Layer
**TODO:** Specify which model(s)/providers the Generation Pipeline calls,
prompt construction and context-window management, retry/fallback behavior,
rate limiting, and cost controls.

### 8.4 Continuity Linting Rules
**TODO:** Detail the actual rule set and implementation for the runtime
validation filter (step 3 of the Core Engine Loop) — what "lore and state
rule compliance" checks for, how rules are authored/updated, and failure
handling when linting rejects generated output.

### 8.5 Observability & Monitoring
**TODO:** Define logging, metrics, and tracing for the Fastify API on ECS
Fargate (e.g. CloudWatch integration), error tracking for both deployment
modes, and alerting thresholds for the always-on Fargate task.

### 8.6 CI/CD Pipeline
**TODO:** Describe build/release pipelines for the monorepo — how Desktop
binaries are built/signed/distributed per OS, how the Cloud API and CDK infra
are deployed, and how the Three-Phase Task Execution Gate (Spec/Test/Act,
per ADR-003) maps onto CI checks.

### 8.7 Data Migration & Backup
**TODO:** Define backup/restore strategy for remote Git storage in Enterprise
Cloud Mode, and any migration path for existing Local Desktop projects moving
to Cloud Mode (or vice versa).

### 8.8 Performance & Scalability Targets
**TODO:** Set concrete targets — concurrent users per Fargate task, expected
scene-generation latency budget, ECS task sizing/auto-scaling thresholds, and
load-testing plan.

### 8.9 Compliance & Data Privacy
**TODO:** Determine data residency, retention, and privacy requirements for
user-authored content stored in Enterprise Cloud Mode, and any regulatory
considerations (e.g. GDPR) if applicable to the target user base.

---

## Our Stance (not part of the research)

*Reserved for author observations and open questions on the above. Not yet
populated.*
