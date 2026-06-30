# E1-S1-T1 — Draft HLD Document

| Field        | Value                                                         |
|--------------|---------------------------------------------------------------|
| Reference    | `E1-S1-T1`                                                    |
| Type         | feature                                                       |
| Story / Epic | [`E1-S1`](E1-S1-hld-and-interface-design.md) / `E1`          |
| Output(s)    | `docs/hld.md`                                                 |
| Depends on   | —                                                             |
| Branch       | `feature/E1-S1-T1`                                            |
| Status       | Ready                                                         |
| PRs          | —                                                             |

## Purpose

Codify the structural topology, runtime behaviour, and boundary definitions of
the magpie-weaver platform into a single source of truth, so that both Local
Desktop and Enterprise Cloud execution pathways are fully mapped before any
scaffolding begins.

## Steps

1. Create `docs/hld.md` covering:
   - Component responsibilities for each workspace (`apps/desktop`, `apps/web`,
     `apps/server`, `packages/filestore`).
   - The human-in-the-loop review architecture: how the React 19 UI intercepts
     the Continuity Linting stage to present JSON diffs before mutating state.
   - Local Desktop Mode data flow: React SPA → Tauri IPC Bridge → host
     filesystem / native Git CLI.
   - Enterprise Cloud Mode data flow: React SPA → AWS ALB → Fastify API on ECS
     Fargate → remote Git over HTTPS/SSH.
   - Multi-tenant cloud container routing lifecycle:
     - Phase A — perimeter routing and SSL termination via AWS ALB.
     - Phase B — tenant identification: Fastify pre-handler parses JWT/session
       cookie, identifies Tenant ID and User ID, applies tenant isolation scoping.
     - Phase C — contextual execution: `CloudGitFileStore` injects tenant-specific
       credentials (from AWS Secrets Manager) and repository URI; agent loop runs
       in an ephemeral scratch disk scoped to that tenant's repository.
   - Session stickiness and concurrency isolation requirements for long-running
     agent loops.
   - Data serialisation and communication patterns across Tauri IPC and
     Fastify WebSocket/SSE protocols.
2. Update this task file and the register to Done with PR link.
3. Raise the spec PR.

## Acceptance criteria

- `docs/hld.md` exists and is approved.
- Both Local Desktop Mode and Enterprise Cloud Mode runtime flows are described
  without ambiguity.
- Multi-tenant routing logic and isolated storage boundaries are documented.
- Data serialisation across Tauri IPC and Fastify WebSocket/SSE is explicitly
  covered.

## Measure of done

`docs/hld.md` is merged with the author's approval.

## Estimated duration

Half a day (single spec PR).

## Notes

Spec Mode only — no tests or implementation gate. Gate: Spec PR merged.
