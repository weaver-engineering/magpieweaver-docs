# E1 — Architecture & HLD

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1`                               |
| Type         | epic                               |
| Planning task| [`PLAN-2`](../../planning/PLAN-2-plan-e1-architecture-hld.md) |
| Status       | Proposed                           |

## Objective

Establish the shape of the system before any code is written. Define the
high-level design, lock in technology decisions, initialize the implementation
monorepo, establish Git governance, and set up the documentation-as-code
framework.

## End state

- HLD complete; component boundaries and interaction contracts documented.
- FileStore interface contract formally designed.
- Technology stack confirmed (TypeScript + React 19 + Tauri v2 + Fastify + AWS CDK v2).
- `magpie-weaver` monorepo initialized; all workspace directories present; `pnpm install` clean.
- Git governance in place: branch naming, protection rules, pre-commit hooks.
- ADR system and per-package README templates established.

## Informed by

- [`RES-3` — HLD and Architectural Decision Records](../../../../research/hld-and-adrs.md)
- [`RES-4` — E1 Sub Plan](../../../../research/e1-sub-plan.md)

## Stories

| Ref     | Story                                    | Status   | File |
|---------|------------------------------------------|----------|------|
| `E1-S1` | System Architecture & Interface Design   | Proposed | [file](E1-S1-hld-and-interface-design/E1-S1-hld-and-interface-design.md) |
| `E1-S2` | Monorepo Scaffolding & Tooling Init      | Proposed | [file](E1-S2-monorepo-scaffolding/E1-S2-monorepo-scaffolding.md) |
| `E1-S3` | Git Governance & Branch Naming Strategy  | Proposed | [file](E1-S3-git-governance/E1-S3-git-governance.md) |
| `E1-S4` | Documentation-as-Code Framework          | Proposed | [file](E1-S4-docs-as-code/E1-S4-docs-as-code.md) |

## Implementation sequence

```
[E1-S1: HLD & Interface Design]
               │
               ▼
[E1-S2: Monorepo Scaffolding] ──► [E1-S3: Git Governance]
               │
               ▼
       [E1-S4: Docs-as-Code]
```

E1-S3 and E1-S4 may run in parallel once E1-S2 is Done.

## Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M1 — HLD approved | HLD doc + FileStore interface + stack confirmation | Spec PRs merged |
| M2 — Monorepo live | `magpie-weaver/` workspace initialized | `pnpm install` exits 0 across all workspaces |
| M3 — Governance active | Branch protection + pre-commit hooks | Direct push to `main` blocked; hook fires on bad commits |
| M4 — Docs-as-code ready | ADR system + per-package READMEs | All sub-packages have README; ADR template committed |
