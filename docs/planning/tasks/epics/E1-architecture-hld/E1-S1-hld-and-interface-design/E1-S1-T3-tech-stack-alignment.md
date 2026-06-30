# E1-S1-T3 — Technical Stack Architecture Alignment

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S1-T3`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S1`](E1-S1-hld-and-interface-design.md) / `E1`          |
| Output(s)    | `docs/specs/tech-stack.md`                                    |
| Depends on   | `E1-S1-T1`                                                    |
| Branch       | `feature/E1-S1-T3`                                            |
| Status       | Ready                                                         |
| PRs          | —                                                             |

## Purpose

Achieve formal alignment across all core platform technologies and permanently
log the decisions with engineering rationale and bottleneck mitigations, so
that framework drift is eliminated during development.

## Steps

1. Create `docs/specs/tech-stack.md` covering:
   - **React 19 + Vite:** how streaming/Suspense primitives interact with
     long-running LLM generation threads.
   - **Tauri v2:** validation that it satisfies native host filesystem mutations
     and Rust-to-TypeScript IPC channels without heavy external subprocesses;
     assessment of IPC payload limits.
   - **Fastify:** confirmation of efficient cloud orchestration with
     low-overhead JSON validation schemas and streaming text loops.
   - **AWS CDK v2:** confirmation that ALB configuration can maintain persistent
     stateful WebSocket/SSE connections back to ECS Fargate; assessment of
     Fargate task execution timeouts for deep agent loops.
   - A technology matrix table: component → chosen technology → version pin →
     engineering rationale.
   - Identified engineering bottlenecks with written mitigation strategies.
2. Update this task file and the register to Done with PR link.
3. Raise the spec PR.

## Acceptance criteria

- `docs/specs/tech-stack.md` exists and is approved.
- Technology matrix covers all core platform components with version pins and
  engineering rationale.
- Potential bottlenecks are identified with written mitigations.

## Measure of done

`docs/specs/tech-stack.md` is merged with the author's approval.

## Estimated duration

Half a day (single spec PR).

## Notes

Spec Mode only — no tests or implementation gate. Gate: Spec PR merged.
Depends on `E1-S1-T1` being Done so technology decisions are grounded in the
approved component topology.
Can proceed in parallel with `E1-S1-T2` once `E1-S1-T1` is Done.
