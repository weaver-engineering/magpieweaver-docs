# ADR-001 — Technology Stack Selection (Approved)

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