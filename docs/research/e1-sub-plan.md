# Research: E1 Sub-Plan

> **Status:** agreed research (statement of fact once merged via `RES-4`);
> revised 2026-06-30 to reflect the author's updated plan (Google Drive,
> `RES-4-e1-sub-plan/` — `E1 plan - final.md`, `S1 tasks.md`–`S4 Tasks.md`,
> `Multi-Tenant Routing Lifecycle.md`). The original draft proposed five
> stories; the revised plan restructures to four stories with an HLD-first
> approach. Planning docs on `planning/PLAN-2` already reflect this revision.
> **Captured:** 2026-06-30.
> **Source:** author-provided Gemini research documents in Google Drive,
> `RES-4-e1-sub-plan/`.

This document is a **faithful summary of what the source says**. It records the
source's proposals and reasoning; it does **not** record our decisions. Our own
observations and open questions are collected at the end under
[Our stance](#our-stance-not-part-of-the-research). Where the summary infers
or interprets, it is flagged as such.

Related research: [HLD and ADRs](hld-and-adrs.md) (`RES-3`) — the architectural
decisions this sub-plan implements.

---

## 1. Epic objective

Establish the shape of the system before any code is written: define the
high-level design, lock in technology decisions, initialize the implementation
monorepo, establish Git governance, and set up the documentation-as-code
framework.

The source frames this as purely architectural scaffolding — establishing
blueprints and interfaces before jumping into product-feature implementation.

## 2. Story breakdown

The source proposes four stories:

| Ref   | Story | Objective |
|-------|-------|-----------|
| E1-S1 | System Architecture & Interface Design | Define the HLD, FileStore interface contract, and formally confirm the technology stack |
| E1-S2 | Monorepo Scaffolding & Tooling Initialization | Initialize the physical repository and configure the workspace package manager |
| E1-S3 | Git Governance & Branch Naming Strategy | Establish branching conventions, repository protection rules, and pre-commit hooks |
| E1-S4 | Documentation-as-Code Framework Setup | Implement the ADR system and per-package README templates |

Implementation sequence: E1-S1 → E1-S2 → E1-S3 and E1-S4 in parallel.

## 3. Tasks

---

### E1-S1 — System Architecture & Interface Design

**Acceptance criteria for the story:** HLD document and core interface
signatures are approved and signed off.

---

**E1-S1-T1: Draft High-Level Design (HLD) Document**
- Deliverable: `docs/high_level_design.md`
- Steps:
  1. Document the responsibilities of each runtime workspace component
     (`apps/desktop`, `apps/web`, `apps/server`, `packages/filestore`).
  2. Map the human-in-the-loop review architecture — how the React 19 UI
     intercepts the Continuity Linting stage to present JSON diffs before
     mutating state.
  3. Define the Local Desktop Mode runtime flow: React SPA → Tauri IPC Bridge
     → host filesystem / native Git CLI.
  4. Define the Enterprise Cloud Mode runtime flow: React SPA → AWS ALB →
     Fastify API on ECS Fargate → remote Git over HTTPS/SSH.
- Acceptance criteria:
  - The HLD explicitly details data serialisation and communication patterns
    across both Tauri IPC and Fastify WebSocket/SSE protocols.
  - The multi-tenant cloud container routing logic and isolated local filesystem
    storage boundaries are completely documented without ambiguity.

**Multi-Tenant Routing Lifecycle** (supplementary context for T1):

The source provides a detailed breakdown of how cloud requests are routed when
multiple tenants use the infrastructure concurrently. Key phases:

- **Phase A — Perimeter routing & SSL termination:** HTTPS/WebSocket requests
  hit the AWS ALB; TLS is decrypted and routing rules applied.
- **Phase B — Tenant identification & token validation:** Fastify pre-handler
  parses the JWT/session cookie to identify the Tenant ID and User ID, then
  applies scoping context to prevent cross-tenant data leaks.
- **Phase C — Contextual execution & cloud Git routing:** the
  `CloudGitFileStore` implementation dynamically injects tenant-specific Git
  repository credentials (from AWS Secrets Manager) and repository URI into the
  execution thread; the agent loop runs on an ephemeral scratch disk scoped to
  that user's repository.

The source notes two critical challenges the routing logic must solve:
- **Session stickiness vs. state distribution:** the ALB must support sticky
  sessions or native WebSocket upgrades so the frontend stays connected to the
  container holding the running agent loop.
- **Concurrency isolation:** horizontal auto-scaling rules in the CDK package
  must spin up additional Fargate tasks under aggregate load to prevent tenant
  starvation.

---

**E1-S1-T2: Design FileStore Interface Contract**
- Deliverable: interface contract design document
- Steps:
  1. Define formal TypeScript type signatures for the core methods: `read()`,
     `write()`, `list()`, `commit()`, and `revert()`.
  2. Define return structures for the Git execution layer — shape of a commit
     transaction payload (commit hash strings, author metadata, timestamps).
  3. Design error boundary structures (`FileStoreError`, `GitConflictError`) for
     scenarios where async Git mutations fail or the continuity linter rejects a
     commit.
  4. Ensure the interface relies on strict TypeScript compilation parameters
     (`strictNullChecks`, `noImplicitAny`).
- Acceptance criteria:
  - Interface signatures are fully declared with precise input/output parameters,
    zero `any` types.
  - Every state-mutation method returns a `Promise` wrapper.

---

**E1-S1-T3: Technical Stack Architecture Alignment**
- Deliverable: technology matrix in core design documents
- Steps:
  1. Review React 19 + Vite — how streaming/Suspense primitives interact with
     long-running LLM generation threads.
  2. Validate Tauri v2 — satisfies native host filesystem mutations and
     Rust-to-TypeScript IPC channels without heavy external subprocesses.
  3. Verify Fastify — efficient cloud orchestration engine with low-overhead
     JSON validation schemas and streaming text loops.
  4. Audit AWS CDK v2 — ALB configuration can maintain persistent stateful
     WebSocket/SSE connections back to ECS Fargate.
  5. Record a technology matrix (component → technology → rationale).
  6. Identify and document engineering bottlenecks with written mitigations
     (e.g. Tauri IPC payload limits, Fargate task execution timeouts).
- Acceptance criteria:
  - Complete architectural consensus; technology matrix permanently logged.
  - Potential engineering bottlenecks evaluated with written mitigation
    strategies.

---

### E1-S2 — Monorepo Scaffolding & Tooling Initialization

**Acceptance criteria for the story:** `pnpm install` exits `0` at the monorepo
root across a correctly mapped workspace directory tree.

---

**E1-S2-T1: Create Root Git Repository**
- Steps:
  1. Run `git init magpie-weaver`.
  2. Create a root `.gitignore` blocking `node_modules/`, `target/`,
     `dist/`, `build/`, `.env*`, `.DS_Store`.
  3. Create an initial commit to lock in the `main` default branch name.
- Acceptance criteria:
  - `git status` on a clean clone confirms tracking is active on `main`.
  - Test files in `node_modules/` or `target/` are correctly ignored.

**E1-S2-T2: Initialize pnpm Workspace Architecture**
- Steps:
  1. Create root `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`.
  2. Generate root `package.json` with `"private": true` to prevent registry
     publication.
  3. Configure root scripts for global linting, formatting, and recursive
     building across sub-packages.
- Acceptance criteria:
  - `pnpm-workspace.yaml` is structurally valid and targets `/apps` and
    `/packages`.
  - Root `package.json` contains an explicit blocker preventing `npm` or `yarn`
    execution.

**E1-S2-T3: Scaffold Monorepo Physical Directory Tree**
- Steps:
  1. Create `/apps/desktop`, `/apps/server`, `/apps/web`.
  2. Create `/packages/filestore`, `/packages/infra`.
  3. Create `/docs`.
  4. Place a stub `package.json` with a workspace-scoped name inside each
     sub-directory (e.g. `{"name": "@magpie-weaver/filestore", "version":
     "0.1.0"}`).
- Acceptance criteria:
  - Directory layout matches the HLD exactly.
  - All five internal workspace modules are listed cleanly from the root.

**E1-S2-T4: Establish Engine & Compiler Target Constraints**
- Steps:
  1. Append an `"engines"` block to root `package.json` (Node ≥22, pnpm ≥9).
  2. Create `tsconfig.base.json` at root with `strict`, `strictNullChecks`,
     `noImplicitAny`, `target: "ES2022"`.
  3. Configure root `.editorconfig` and `.prettierrc` for consistent file
     encoding, indentation, and trailing newlines across TypeScript and Rust.
- Acceptance criteria:
  - Installing with an unsupported Node or package manager version fails with
    an engine mismatch error.
  - Sub-packages can extend `tsconfig.base.json` without bypassing strictness.

---

### E1-S3 — Git Governance & Branch Naming Strategy

**Acceptance criteria for the story:** direct pushes to `main` are blocked;
pull requests default to squash merge; pre-commit hook fires on malformed
TypeScript or formatting errors.

---

**E1-S3-T1: Author Developer Workspace & Branching Guidelines**
- Deliverable: `CONTRIBUTING.md` at the repository root
- Steps:
  1. Create `CONTRIBUTING.md`.
  2. Document semantic branch prefix layout (`feat/`, `fix/`, `docs/`, `ops/`)
     linked to tracking issue IDs (e.g. `feat/MW-102_tauri-ipc-bridge`).
  3. Define commit message syntax using Conventional Commits (e.g.
     `feat(filestore): implement local native file system writer`).
- Acceptance criteria:
  - `CONTRIBUTING.md` is committed; contains concrete examples of passing vs.
    failing branch and commit names.

**E1-S3-T2: Configure Remote Branch Protection & Enforcement Rules**
- Steps:
  1. Enable branch protection on `main` in the upstream repository settings.
  2. Toggle "Require a pull request before merging" with at least one approval.
  3. Enable "Require squash merge" to enforce linear history.
- Acceptance criteria:
  - Direct terminal pushes to `main` are blocked.
  - Pull requests default to "Squash and Merge".

**E1-S3-T3: Implement Developer Pre-Commit Validation Hooks**
- Steps:
  1. Install `husky` and `lint-staged` as devDependencies at the workspace root.
  2. Configure a pre-commit Git hook for staged TypeScript and Rust source files.
  3. Program the hook to run the workspace linter and Prettier.
- Acceptance criteria:
  - Commits with broken TypeScript syntax or formatting errors are blocked with
    errors printed to the terminal.
  - Well-formed code passes through the hook cleanly.

---

### E1-S4 — Documentation-as-Code Framework Setup

**Acceptance criteria for the story:** `/docs/adr/` contains an ADR template
and the initial bootstrap ADR; all five sub-packages contain a targeted README.

---

**E1-S4-T1: Establish Architecture Decision Record (ADR) System**
- Deliverable: `/docs/adr/` directory with `TEMPLATE.md` and
  `0001-record-architecture-decisions.md`
- Steps:
  1. Create `/docs/adr/`.
  2. Author `TEMPLATE.md` with sections: Title, Status
     (Proposed/Accepted/Superseded), Context, Decision, Consequences.
  3. Draft and save `0001-record-architecture-decisions.md` to establish the
     ADR pattern.
- Acceptance criteria:
  - `/docs/adr/` contains both `TEMPLATE.md` and the approved `0001` record.
  - The `0001` ADR mandates that any structural deviation from the HLD requires
    a new sequential ADR.

**E1-S4-T2: Deploy Localized Component README Templates**
- Deliverable: `README.md` in each of the five sub-packages
- Steps:
  1. Create a boilerplate README template for internal workspace modules.
  2. Distribute to:
     - `apps/desktop/README.md` — Tauri setup and Rust prerequisites.
     - `apps/server/README.md` — Fastify routing notes and local Docker setup.
     - `apps/web/README.md` — React 19 / Vite build targets.
     - `packages/filestore/README.md` — FileStore interface signature.
     - `packages/infra/README.md` — AWS CDK deployment steps.
  3. Include placeholder sections: *Local Installation*, *Scripts*,
     *Architecture Overview*, *Exported API Boundaries*.
- Acceptance criteria:
  - All five sub-packages contain a unique, targeted `README.md`.
  - `packages/filestore/README.md` explicitly outlines the boundary between
    local native storage and cloud container persistence.

---

## 4. Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M1 — HLD approved | HLD doc + FileStore interface + stack confirmation | Spec PRs merged |
| M2 — Monorepo live | `magpie-weaver/` workspace initialized | `pnpm install` exits `0` across all workspaces |
| M3 — Governance active | Branch protection + pre-commit hooks | Direct push to `main` blocked; hook fires on bad commits |
| M4 — Docs-as-code ready | ADR system + per-package READMEs | All sub-packages have README; ADR template committed |

---

## Our stance (NOT part of the research)

The following is **our** commentary. It is the input to the planning tasks
that follow.

- **Revised from original draft.** The original RES-4 draft (merged via PR #10)
  proposed five stories aligned to the source's technical implementation
  sequence (Monorepo Scaffolding, FileStore Contract, In-Memory Mock, Client
  Shell, Cloud Deployment). The author revised the plan to a four-story
  structure that puts HLD and interface design first (E1-S1), before any
  scaffolding. This revision makes the dependency sequence explicit: no
  directory or configuration file is generated until the high-level boundaries
  and interface types are agreed. Planning docs on branch `planning/PLAN-2`
  reflect this revised structure.
- **Task reference scheme.** Our convention is `E1-S1-T1` / `E1-S2-T1`.
  The source's numbering (Task 1.1, 2.1, etc.) is mapped to our convention
  when tasks are registered.
- **Branch naming.** Our convention is `feature/E1-S1-T1`. Used in task files
  and the register accordingly.
- **E1-S3 contributing guidelines vs. magpieweaver-docs ways-of-working.**
  The source proposes `CONTRIBUTING.md` with semantic branch prefixes
  (`feat/`, `fix/`, `docs/`, `ops/`). Our `magpieweaver-docs` uses `feature/`,
  `setup/`, `planning/` etc. The `magpie-weaver` implementation repo will need
  its own conventions aligned to whatever the team agrees — this should be
  confirmed before E1-S3-T1 begins.
- **docs/specs/ location.** The source's spec deliverables (HLD, FileStore
  contract, tech stack) sit in the implementation monorepo
  (`magpie-weaver/docs/`). Our planning task files describe them as outputs in
  the docs repo (`magpieweaver-docs/docs/`). Where component specs ultimately
  live remains an open decision; for E1-S1 spec tasks the docs repo is used.
