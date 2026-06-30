# Research: E1 Sub-Plan

> **Status:** agreed research (statement of fact once merged via `RES-4`).
> **Captured:** 2026-06-30.
> **Source:** two author-provided Gemini research drafts proposing the Epic 1
> sub-plan — stories, tasks, modes, deliverables, and acceptance criteria.
> Draft 2 is more detailed and supersedes draft 1 where they overlap; both
> are faithfully recorded.

This document is a **faithful summary of what the source says**. It records the
source's proposals and reasoning; it does **not** record our decisions. Our own
observations and open questions are collected at the end under
[Our stance](#our-stance-not-part-of-the-research). Where the summary infers
or interprets, it is flagged as such.

Related research: [HLD and ADRs](hld-and-adrs.md) (`RES-3`) — the architectural
decisions this sub-plan implements.

---

## 1. Epic objective

Establish a unified pnpm monorepo workspace that:
- compiles cleanly across all workspaces,
- isolates the data layer behind the FileStore contract,
- provisions the local desktop shell via Tauri v2, and
- sets up declarative infrastructure blueprints for AWS cloud deployment.

The source frames this as purely architectural scaffolding — establishing
blueprints and interfaces without jumping into product-feature implementation.

## 2. Story breakdown

The source (draft 2) proposes five stories:

| Ref   | Story | Objective |
|-------|-------|-----------|
| E1-S1 | Monorepo Scaffolding & Dependency Pinning | Build the physical repository layout; lock down cross-workspace dependency boundaries |
| E1-S2 | FileStore Core Interface Contract | Define the TypeScript boundary separating engine logic from Git/filesystem machinery |
| E1-S3 | High-Speed Verification (In-Memory Storage) | Implement a zero-dependency in-memory mock to enable fast agent test loops |
| E1-S4 | Client Shell Integration (Tauri & Web) | Spin up the foundational React 19 UI and wrap it in the Tauri v2 desktop shell |
| E1-S5 | Cloud Deployment Foundations | Define declarative AWS CDK v2 blueprints for the Fastify cloud container |

Draft 1 groups these into three stories (Monorepo Scaffold, FileStore Contract,
Infrastructure Topology) but the task content is equivalent; draft 2 is more
granular and is used here.

## 3. Tasks

The source applies ADR-003 Task Modes to each task. Where Test Mode is skipped,
the source explicitly notes the reason (purely structural or type-only work).

---

### E1-S1 — Monorepo Scaffolding & Dependency Pinning

**E1-T1.1: Environment & Layout Specification**
- Mode: **Spec Mode**
- Deliverable: `docs/specs/monorepo-layout.md`
- Execution boundary: confined to `/docs`
- Acceptance criteria:
  - Specifies Node engine `>=20.x`, pnpm `>=9.x`, and exact version targets for
    Tauri v2, React 19, and Fastify v4/v5.
  - Explicitly maps internal package dependency graph (e.g. `apps/desktop`
    depends on `packages/filestore`).
  - Defines strict import boundaries blocking forbidden cross-workspace imports
    (e.g. `packages/filestore` must not import from `apps/web`).

**E1-T1.2: Root Workspace Initialization**
- Mode: **Act Mode** *(Test Mode skipped — purely environment scaffolding)*
- Deliverable: root `pnpm-workspace.yaml`, root `package.json`, and empty
  target workspaces
- Acceptance criteria:
  - Root `pnpm-workspace.yaml` and `package.json` configured correctly.
  - Empty, compilation-valid placeholder directories created for:
    `apps/desktop`, `apps/web`, `apps/server`, `packages/filestore`,
    `packages/infra`.
  - `pnpm install` at root exits with `0`.

---

### E1-S2 — FileStore Core Interface Contract

**E1-T2.1: Storage Abstraction Definition**
- Mode: **Spec Mode**
- Deliverable: `docs/specs/filestore-contract.md`
- Acceptance criteria:
  - Documents exact TypeScript `FileStore` interface signatures for all
    asynchronous operations (`read`, `write`, `list`, `commit`, `revert`).
  - Explicitly maps how low-level errors (OS file-not-found, Git merge
    conflicts) are caught and normalised into type-safe application exceptions.

**E1-T2.2: Exporting the TypeScript Interface**
- Mode: **Act Mode** *(Test Mode skipped — uncompiled type contract only)*
- Deliverable: `packages/filestore/src/index.ts`
- Acceptance criteria:
  - Strict `FileStore` type definitions exported from the package root.
  - Other workspaces can resolve the types via pnpm workspace references.

---

### E1-S3 — High-Speed Verification (In-Memory Storage)

**E1-T3.1: Mock Strategy Specification**
- Mode: **Spec Mode**
- Deliverable: `docs/specs/in-memory-mock.md`
- Defines how the mock store will simulate filesystem behaviour and Git
  tracking histories inside volatile memory.

**E1-T3.2: Failing Test Suite**
- Mode: **Test Mode**
- Deliverable: `packages/filestore/__tests__/in-memory-mock.test.ts`
- Acceptance criteria (failing assertions to be written):
  - Writing to a path allows reading it back.
  - Listing an empty directory returns an empty array.
  - Committing generates a distinct, reproducible mock hash string.

**E1-T3.3: In-Memory Implementation**
- Mode: **Act Mode**
- Deliverable: `packages/filestore/src/InMemoryMockFileStore.ts`
- Acceptance criteria:
  - Lightweight object-backed implementation passes all test assertions.
  - `pnpm --filter filestore test` exits with `0`.

---

### E1-S4 — Client Shell Integration (Tauri & Web)

**E1-T4.1: Frontend Framework Specification**
- Mode: **Spec Mode**
- Deliverable: `docs/specs/frontend-architecture.md`
- Defines UI compilation settings, folder structures, and linting constraints.

**E1-T4.2: Client Scaffolding & Verification**
- Mode: **Act Mode** *(treated as structural framework generation)*
- Deliverable: `apps/web/src/` core directory structure and
  `apps/desktop/src-tauri/` native compilation manifests
- Acceptance criteria:
  - `pnpm --filter web dev` fires up the browser client.
  - `pnpm --filter desktop tauri dev` boots the native desktop viewport
    successfully.

---

### E1-S5 — Cloud Deployment Foundations

**E1-T5.1: Infrastructure Topology Specification**
- Mode: **Spec Mode**
- Deliverable: `docs/specs/cloud-infrastructure.md`
- Drafts the AWS deployment blueprint: network subnets, firewall rules, load
  balancer configuration, container resource dimensions.

**E1-T5.2: Infrastructure Blueprint Implementation**
- Mode: **Act Mode** *(infrastructure-as-code declared via templates; validated
  during CDK synthesis)*
- Deliverable: `packages/infra/lib/infra-stack.ts`
- Acceptance criteria:
  - CDK stack contains the ALB routing configuration, VPC layout, and ECS
    Fargate serverless cluster footprint.
  - `cdk synth` from the package emits a valid cloud assembly without error.

---

## 4. Milestones

| Milestone | Deliverable | Verification gate |
|-----------|-------------|-------------------|
| M1 — Monorepo setup | Unified workspace directory structure | `pnpm install` resolves cleanly across all workspaces |
| M2 — Contract definition | `FileStore` TypeScript interface | Global compilation via `pnpm run build` succeeds |
| M3 — Mock loop | Fully operational `InMemoryMockFileStore` | `pnpm --filter filestore test` returns 100% green |
| M4 — UI scaffold | Active Vite app running inside Tauri v2 | Local viewport opens and renders the application frame |
| M5 — Infra ready | Synthesised AWS CDK template | `pnpm --filter infra exec cdk synth` outputs a clean stack |

---

## Our stance (NOT part of the research)

The following is **our** commentary. It is the input to the planning tasks
that follow.

- **Task reference scheme differs from our ways-of-working.** The source uses
  `E1-T1.1` / `E1-T2.1` etc. (flat task numbering under each story). Our
  convention is `E1-S1-T1` / `E1-S2-T1`. The source's numbering should be
  re-mapped to our convention when the tasks are registered.
- **Branch naming also differs.** The source proposes `architecture/E1-T1.1-...`
  but our convention is `feature/E<n>-S<n>-T<n>`. Branch names must be updated
  when tasks are registered.
- **E1-S3 (InMemoryMockFileStore) and our roadmap E4.** Our roadmap places the
  Git-backed file store as a separate epic (E4). The source places the
  `InMemoryMockFileStore` inside E1. These are not the same thing — E1-S3
  implements only the in-memory mock (needed to make the workspace testable);
  the full `NativeGitFileStore` and `CloudGitFileStore` implementations remain
  E4 scope. This is consistent, not a conflict.
- **E1 scope is broader than our original description.** Our roadmap described
  E1 as design/HLD only. The source extends it to include actual workspace
  scaffolding (pnpm init, directory structure, TypeScript interface export,
  CDK initialisation). This is reasonable — "all required repos created" was
  always in E1's end state — but it means E1 includes Act Mode tasks
  (implementation work), not just Spec Mode.
- **Test Mode is legitimately skipped for structural/type-only tasks** (T1.2,
  T2.2, T4.2, T5.2). The source's reasoning aligns with our DoD convention
  that gates apply "as relevant to the task type."
- **The source's `docs/specs/` directory** sits inside the implementation
  monorepo (`magpie-weaver/docs/specs/`). The relationship between that
  directory and this docs repo (`magpie-weaver-docs/`) needs to be decided
  explicitly: are component specs maintained here and mirrored there, or does
  each repo own its own specs? This is an open question for PLAN-2.
