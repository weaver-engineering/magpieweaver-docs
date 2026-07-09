# ADR-005 — Cloud Hosting Infrastructure Topology (Approved)

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
