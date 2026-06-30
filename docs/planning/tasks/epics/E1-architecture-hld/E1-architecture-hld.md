# E1 — Architecture & HLD

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1`                               |
| Type         | epic                               |
| Planning task| [`PLAN-2`](../../planning/PLAN-2-plan-e1-architecture-hld.md) |
| Status       | Proposed                           |

## Objective

Establish the shape of the system before any code is written. Identify the
high-level components, decide the technology stack and implementation language,
create the required repositories, and agree how components will be documented.
Cross-repo branch naming is also confirmed here.

## End state

- HLD complete; top-level components identified and documented.
- All required repos created.
- Technology stack and language decided (TypeScript pnpm monorepo — per `RES-3`).
- Cross-repo branch naming confirmed.
- Component documentation approach agreed.

## Informed by

- [`RES-3` — HLD and Architectural Decision Records](../../../../research/hld-and-adrs.md)
- [`RES-4` — E1 Sub Plan](../../../../research/e1-sub-plan.md)

## Stories

| Ref     | Story                                  | Status   | File |
|---------|----------------------------------------|----------|------|
| `E1-S1` | Monorepo Scaffolding & Dependency Pinning | Proposed | [file](E1-S1-monorepo-scaffolding/E1-S1-monorepo-scaffolding.md) |
| `E1-S2` | FileStore Core Interface Contract      | Proposed | [file](E1-S2-filestore-contract/E1-S2-filestore-contract.md) |
| `E1-S3` | High-Speed Verification (In-Memory Mock) | Proposed | [file](E1-S3-in-memory-mock/E1-S3-in-memory-mock.md) |
| `E1-S4` | Client Shell Integration (Tauri & Web) | Proposed | [file](E1-S4-client-shell/E1-S4-client-shell.md) |
| `E1-S5` | Cloud Deployment Foundations           | Proposed | [file](E1-S5-cloud-deployment/E1-S5-cloud-deployment.md) |

## Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M1 — Monorepo setup | Unified workspace directory structure | `pnpm install` resolves cleanly across all workspaces |
| M2 — Contract definition | `FileStore` TypeScript interface | Global compilation via `pnpm run build` succeeds |
| M3 — Mock loop | Fully operational `InMemoryMockFileStore` | `pnpm --filter filestore test` returns 100% green |
| M4 — UI scaffold | Active Vite app running inside Tauri v2 | Local viewport opens and renders the application frame |
| M5 — Infra ready | Synthesised AWS CDK template | `pnpm --filter infra exec cdk synth` outputs a clean stack |
