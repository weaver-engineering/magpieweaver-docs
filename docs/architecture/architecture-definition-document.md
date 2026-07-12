# Magpie Weaver Architecture

---
## 1. Context

- [Glossary](../glossary.md) - Glossary of terms.
- [About Magpie Weaver](../magpie-weaver.md) - Background reading about Magpie Weaver.
- [High Level Design](high-level-design.md) - Magpie Weaver high level design.

This document details the architecture of Magpie Weaver. It records what is being built and the environments
it is built in (production/test/development).
It defines the development approach and cycle. It documents the guardrails to keep changes to the code base
controlled and delivering changes in line with the agreed design.
It details the devOps build process so that new developers (or development continuing after a break) always have a
reference of how Magpie Weaver is built.
It defines the deployment process (CI/CD pipeline), the gates between pipeline stages and the devOps infrastructure.
It specifies the configuration of the OpenCode Agentic AI IDE that is used to keep the agent working efficiently
within the confines of the development cycle phase.

---
## Production Architecture
There are 2 flavors of production architecture for Magpie Weaver.
The architecture of the system at enterprise scale, not part of MVP, and the architecture at small scale (limited users).

> **Note — LLM model selection:** The Bedrock model to use (marked "TBD" in every diagram below) is not yet decided.
> This depends on an open item and should not be treated as finalized until that item is resolved and recorded as
> its own ADR.

### Target Production Architecture - Enterprise Scale

> **Correction (post tech-stack.md finalisation):** the diagram below originally showed load-balanced
> EC2 instances at this tier. That was an error — the confirmed Enterprise-scale compute model is a
> **pooled ECS Fargate task fleet** behind the ALB (see `docs/specs/tech-stack.md` §4/§6). Isolation
> between users stays at the Git-workspace/EFS layer, not at the compute layer, so any task in the pool
> can serve any user's request — **provided** the ElastiCache session/index cache is genuinely
> externalized first (see the note under the diagram); that externalization is a hard prerequisite for
> safe task pooling, not an optional optimization.

```
---------------- Local Device ----------------------+----------------- Cloud (e.g. AWS) ------------------------------ 
                                                    |
+------------------+                                |             
| iOS - Native App + ----------+                    |                                         +--------storage-------+
+------------------+           |                    |                                         |          EFS         |
                               |                    |                 +---------------+   +-> + (Per user workspaces |
+----------------------+       |   +- embedded -+   |   +-----+       | ECS Fargate   +   |   |  & Git repos)        |
| Android - Native App + ------+-> |     UI     | <---> + ALB + <---> + (Pooled Task  + <-+   +----------------------+
+----------------------+       |   | (React/TS) |   |   +-----+       |  Fleet: TS    |   |
                               |   +-----+------+   |                 |  Service &    |   |   +--------cache---------+
+---------------------------+  |                    |                 |  Git binary)  |   +-> +   ElastiCache        |
| Desktop - magpieweaver.sh + -+                    |                 +---------------+       |   -Memcached-        |
|   -system tray icon-      |                       |                                         | (User session data   |
+-----cache-----------------+                       |                                         | Indexes, Semaphores  |
|   Map<string,any>         |                       |                                         | etc. - REQUIRED for  |
+---------------------------+                       |                 +----LLM----+           | safe task pooling)   |
|  TS Service & Git binary  + <-------------------------------------> + Bedrock   +           +----------------------+
+-------storage-------------+                       |                 |model - TBD| 
|      Local FS             |                       |                 +-----------+ 
+---------------------------+                       |                 
```

* Mobile first
* Thin client
* Single React/TS UI
* Single React/TS service backend
* Bedrock LLM
  - model TBD — see LLM model selection note above
  - pay-per-use
* Cloud
  * ECS Fargate — pooled task fleet behind an ALB
    - TS Service (TypeScript service) & Git binaries, containerized
    - any task can serve any user's request (isolation is per-user at the Git-workspace/EFS layer, not per-task)
    - **requires** the ElastiCache session/index cache to be externalized before pooling is safe (see correction note above) — a task-local cache would let two tasks serving the same user diverge
  * EFS shared storage
    - per user workspaces
  * ElastiCache
    - memcached session data
* Local
  * Local compute
    - TS Service & Git binaries
  * Local RAM
    - map cached session data
  * Local FS
    - per user shared workspaces

### MVP Production Architecture - Limited Users

> **Note — scope of MVP devices:** MVP targets Android only (no iOS, no Desktop). This is a deliberate choice, not an
> oversight: Magpie Weaver is currently developed by a single person, the initial user base is expected to be around
> 2-3 users, and keeping the footprint small minimizes development effort. iOS and Desktop support are deferred to
> the enterprise-scale architecture (see ADR-013 and ADR-019).

```
---------------- Local Device ----------------+----------------- Cloud (e.g. AWS) ---------------- 
                                              |                             +----LLM----+
                                              |                         +-> + Bedrock   |
                                              |                         |   |model - TBD|
                                              |   +-----cache-------+   |   +-----------+
                                              |   | Map<string,any> |   | 
                                              |   +-----------------+   |   +--------storage-------+     
+----------------------+     +- embedded -+   |   | EC2 Instance    |   |   |          EFS         |    
| Android - Native App + --> |     UI     | <---> + (TS Service     + <-+-> + (Per user workspaces |
+----------------------+     | (React/TS) |   |   | & Git binary)   |       |  & Git repos)        | 
                             +------------+   |   +-----------------+       +----------------------+  
```

* Android App
* Thin client
* React/TS UI
* Single EC2 instance
  - TS Service (TypeScript service) & Git binaries
  - scale-to-zero
  - fixed address via an attached Elastic IP (persists across stop/start); a small Lambda triggers
    `StopInstances`/`StartInstances` on idle detection — see `docs/specs/tech-stack.md` §4.1 for the
    resolved detail; not re-drawn into the diagram above to keep this doc's diagrams stable
* EC2-instance-scoped cache
  - map cached session data
* EFS storage
  - per user workspaces
* Bedrock LLM
  - model TBD — see LLM model selection note above
  - pay-per-use

---
## Test Architecture

> **Note:** The Test architecture is currently identical to the MVP production architecture, below. This is
> intentional for now (the test environment mirrors MVP so behavior verified in test transfers directly to
> production), but the two may diverge over time as MVP evolves and test-specific needs emerge — for example,
> additional instrumentation, seeded data, or environment isolation that shouldn't exist in production.

```
---------------- Local Device ----------------+----------------- Cloud (e.g. AWS) ---------------- 
                                              |                             +----LLM----+
                                              |                         +-> + Bedrock   |
                                              |                         |   |model - TBD|
                                              |   +-----cache-------+   |   +-----------+
                                              |   | Map<string,any> |   | 
                                              |   +-----------------+   |   +--------storage-------+     
+----------------------+     +- embedded -+   |   | EC2 Instance    |   |   |          EFS         |    
| Android - Native App + --> |     UI     | <---> + (TS Service     + <-+-> + (Per user workspaces |
+----------------------+     | (React/TS) |   |   | & Git binary)   |       |  & Git repos)        | 
                             +------------+   |   +-----------------+       +----------------------+  
```

* Android App
* Thin client
* React/TS UI
* Single EC2 instance
  - TS Service (TypeScript service) & Git binaries
  - scale-to-zero
* EC2-instance-scoped cache
  - map cached session data
* EFS storage
  - per user workspaces
* Bedrock LLM
  - model TBD — see LLM model selection note above
  - pay-per-use

---
## Development Architecture

```
------------------------- Local Device ------------------------------------------

                                                        +----LLM----+
                                                    +-> | LM Studio |
                                                    |   |model - TBD|
                                                    |   +-----------+
                                                    |    
                                                    |   +-------cache-----+
                                                    +-> + Map<string,any> +
+----browser----+     +-------------------------+   |   +-----------------+
| UI (React/TS) + --> + TS Service & Git binary + --+
+---------------+     +-------------------------+   |   +--------storage-------+
                                                    |   |          EFS         | 
                                                    +-> + (Per user workspaces |
                                                        |  & Git repos)        |
                                                        +----------------------+
```

* Browser SPA
* Thin client
* React/TS UI
* Local compute
  - TS Service (TypeScript service) & Git binaries
  - start-stop by developer
* Local RAM
  - map cached session data
* Local FS
  - per user shared workspaces
* LM Studio LLM
  - model TBD

### Development Approach
The development approach is 100% AI-authored code. To support this and ensure that the final solution is fit for
purpose, the deployed systems **MUST** be fully designed before development starts, and to avoid the AI becoming
overloaded with context, the delivery of system code **MUST** be specified in detail at a task level. A system is
built over many tasks, where the scope of each task delivers part of the designed system. The scope of a task is
defined by its task specification, `task-<REF>-spec.md`.

Due to the agentic nature of the approach, the documentation of Magpie Weaver, its architecture and designs **MUST**
be in a format and location that the agents can read. Documentation of Magpie Weaver as a whole — architecture, HLD,
subsystem designs and component breakdown — is all recorded in *this* repository. The documentation of a task (what
it is supposed to deliver) is recorded in `task-<REF>.md` with `task-<REF>-spec.md`. These documents live within the
code base that the task changes. They are recorded in
```
docs/
  +-tasks/
      +- <REF-A>/
      |    +- task-<REF-A>.md
      |    +- task-<REF-A>-spec.md
      +- <REF-B>/
      |    +- task-<REF-B>.md
      |    +- task-<REF-B>-spec.md
     ...
```
in the code repository. The human description of the task and the spec which the AI **MUST** achieve for the task are
both available to the AI agent during development. Though the design documentation lives in the documentation
repository (this one), it is also available to the agent by cloning *this* repository into the workspace used by the
agent.

Although the code is to be 100% AI-developed, it **MUST** be maintainable without AI assistance.

### Development Cycle
To keep the AI agents honest, each task goes through 5 phases.
* `specification`
* `test`
* `build`
* `deploy`
  - `deploy-test` - UAT testing of the deployed test system demonstrates that the behavioral changes work as expected
  - `deploy-prod` - Sanity testing asserts that the new behaviors are deployed correctly to production.
* `done`

In the `specification` phase the task is *owned* by the human architect. The architect ensures that the system
designs that the task delivers or relies upon are fully complete (at least with respect to the task, though ideally
100% complete) before the agent takes over completion of the task. The spec defines the expected system behaviors
that must be exhibited by the system for the task to be complete. The architect writes the `task-<REF>.md` and the
`task-<REF>-spec.md` and commits them to the code repository. Once the architect is content that the documentation
required to complete the task is done and committed to the code repository, the `specification` phase is complete and
the task transitions to the `test` phase.

In the `test` phase the agent reads the `task-<REF>.md` and the `task-<REF>-spec.md` files and whatever design
documentation it deems necessary, and writes the failing tests which must pass before the task can be completed.
During the `test` phase the agent **may only** change contents in the test packages. The new tests **MUST** fail
against the existing code base while old tests must still pass against the existing, unchanged code base.
During the `test` phase these behaviors are encapsulated in *system tests* which test that the system as a whole
exhibits the required behavior. Since the tests are defined at a system level, they may only mock the subsystem
dependencies. This ensures that the tests map directly to the expected behavior of the system as a whole (the level
at which the architect has designed it), so that at review time the architect can assert that the tests are a fair
reflection of the system's required behavior. The tests **MUST** fully assert the interactions with the external
systems on which the system depends.
Once the architect is content that the tests written by the agent properly reflect the required behaviors, the
failing tests are committed to the code repository and the `test` phase is complete and the task transitions to the
next phase, `build`.

In the `build` phase the agent reads the `task-<REF>.md` and the `task-<REF>-spec.md` files and whatever design
documentation it deems necessary and, **without changing the test package or the design/specs**, implements the code
changes required to make the failing tests pass. Once the architect is content that the system behaves as required
by the task and that existing system behaviors are unaffected (existing tests still pass), the code changes are also
committed to the code repository and the task transitions to the `deployment` phase.

In the `deployment` phase the CI/CD deploys the changes to the test environment and blocks until UAT testing
(human interactive testing) passes. On UAT *pass*, the `deploy-test` subphase is complete and the change is deployed
to production. Before the change is deployed, the 3 commits (`specification`/`test`/`build`) are squashed into a
single commit to keep the commit history clean. The changes for the task (single commit) are merged with mainline
and the system deployed to production, where a final *sanity* test (human interactive testing) asserts that the
new behaviors are present in the production environment. With the changed behaviors acceptance-tested in
`deploy-test` and confirmed present in production in `deploy-prod`, the task transitions to its final phase (state),
`done`.

At any phase, until `done`, the task can be reverted back to any earlier phase, to change the design/specs/tests which
define the changes that the AI agent is expected to perform in the subsequent phases. Reverting a phase is
deliberately left to the architect's judgement rather than following a fixed rule: if a fault is found in the spec,
the architect decides case by case whether the agent's work in the phases being reverted is discarded and redone from
scratch, or kept and amended in place. This gives the architect explicit control over the trade-off between the
cleanliness of a full redo and the cost, in AI token usage, of doing so.

The tasks' progress through these phases is tracked by the ticketing system `Linear`, where the task and its `<REF>`
are mastered.

### Local Dev Environment Setup
Full step-by-step instructions: [local-dev-environment-setup.md](../setup/local-dev-environment-setup.md).

**Quick start** (assumes `pnpm`, see the linked doc for full detail, prerequisites, and the first-run smoke test):
```bash
# 1. Clone repositories
mkdir -p ~/dev/magpie-weaver && cd ~/dev/magpie-weaver
git clone https://github.com/simonemmott/magpieweaver.git code
git clone https://github.com/simonemmott/magpieweaver-docs.git docs

# 2. Install dependencies
cd code
pnpm install

# 3. Configure environment
cp .env.example .env.local   # then fill in LM Studio endpoint, workspace path, service port

# 4. Start LM Studio (separately, via its own app) and confirm it's serving on the configured port

# 5. Create local workspace storage
mkdir -p ~/dev/magpie-weaver/workspaces

# 6. Start the TS Service
pnpm dev

# 7. Start the UI
pnpm dev:ui
```
Open the UI at the URL printed by step 7, then run the first-run smoke test in the linked doc before starting task work.

### Guard Rails
**ToDo** — see task `TBD-02`.

### Security & Secrets Management
**ToDo** — see task `TBD-03`.

This section will cover how credentials and sensitive data are protected across environments: Bedrock API
credentials, Git credentials for per-user workspaces, session data held in cache, and how ADR-022's structural PII
linter fits into the wider security posture.

### Build Process
**TBC** — see task `TBD-04`.

### Deployment / CI/CD Pipeline
**TBC** — see task `TBD-05`.

> **Note — dependency on ADR-021:** ADR-021 (GitHub Actions as CI/CD Provider) is currently open, pending
> investigation. This section cannot be finalized until that ADR is resolved, since the pipeline stages, gates, and
> infrastructure described here depend on which CI/CD provider is adopted.

### Rollback / Incident Response
**ToDo** — see task `TBD-06`.

The deployment process above defines forward gates (`deploy-test` UAT, `deploy-prod` sanity test) but not yet what
happens if a `deploy-prod` sanity test fails after mainline has already been merged and deployed. This section will
define the rollback procedure and who/what triggers it.

### OpenCode Configuration
**TBC** — see task `TBD-07`.

### Observability & Monitoring
**ToDo** — see task `TBD-08`.

ADR-020 commits to OpenObserve for local observability, lifecycle owned by MagpieWeaverApp. This section will define
what is actually monitored (logs, metrics, traces), where that data lives in each environment (local, test,
production), and how the architect checks system health day to day.

### Cost Management
**ToDo** — see task `TBD-09`.

Bedrock is pay-per-use and EC2 is scale-to-zero, both of which can produce cost surprises without active monitoring.
This section will define cost guardrails and alerting thresholds.

### Backup & Disaster Recovery
**ToDo** — see task `TBD-10`.

EFS holds all per-user workspaces and Git repositories — the system's actual product data. This section will define
backup frequency/retention and the recovery procedure if that data is lost or corrupted.

### Repositories
To minimise the risk of one `subsystem` of Magpie Weaver being built against the wrong version of other `subsystems`,
all the `subsystems` of Magpie Weaver are defined in a single code repository. To keep the commit history of the code
base clean, documentation of Magpie Weaver resides in its own repository (`this one`).

All changes to all repositories **MUST** be related to a `Linear` task by stamping the commit message with the
`task-<REF>`. This includes documentation changes, i.e. no changes are made to the mainline documentation without a
`Linear` task justifying why the change is required and what the scope of the change is. No commit to any branch of
the code base is permitted without reference to a `Linear` task. This keeps the documentation chain intact and
supports either new contributors joining the team or (more importantly) allows development effort to pause for a
while without risking the architect losing their place/context on the Magpie Weaver project.

The repositories maintained by the Magpie Weaver project are:
* The Documentation Repository
  - https://github.com/simonemmott/magpieweaver-docs
* The Code Repository
  - https://github.com/simonemmott/magpieweaver

#### Branching Strategies
**ToDo** — see task `TBD-11`.

### Task Tracking
Tasks, their status and lifecycle are mastered in `Linear` at https://linear.app/simonemmott/project/magpie-weaver-a6314c2e525d

---
# Appendix

## Architectural Decision Records

> **Note — open ADRs and their impact on this document:**
> - **ADR-019 (MVP Scope Boundary)** is open, not yet finalized. The "MVP Production Architecture - Limited Users"
>   section above depends on this ADR's outcome; treat that section as provisional until ADR-019 is closed.
> - **ADR-021 (GitHub Actions as CI/CD Provider)** is open, pending investigation. The "Deployment / CI/CD Pipeline"
>   section above depends on this ADR's outcome and cannot be completed until it is closed.

| Reference      | Title                                                                         | State                        |
|----------------|-------------------------------------------------------------------------------|------------------------------|
| [ADR-001](ADRs/ADR-001-tech-stack-solution.md) | Tech Stack Solution                                                           | Approved                     |
| [ADR-002](ADRs/ADR-002-repository-layout-strategy.md) | Repository Layout Strategy                                                    | Approved                     |
| [ADR-003](ADRs/ADR-003-operational-separation-via-task-modes.md) | Operational Separation Via Task Modes                                         | Approved                     |
| [ADR-004](ADRs/ADR-004-storage-tier-isolation.md) | Storage Tier Isolation                                                        | Approved                     |
| [ADR-005](ADRs/ADR-005-cloud-hosting-infrastructure-topology.md) | Cloud Hosting Infrastructure                                                  | Approved                     |
| [ADR-006](ADRs/ADR-006-multi-user-colaboration-via-per-user-git-workspace.md) | Multi-User Collaboration via Per-User Git Workspaces                          | Approved                     |
| [ADR-007](ADRs/ADR-007-editing-model-separation-and-commit-granularity.md) | Editing Mode Separation & Commit Granularity                                  | Approved                     |
| [ADR-008](ADRs/ADR-008-multi-devide-concurrency.md) | Multi-Device Concurrency via Checksum-Validated PATCH + Write-Ahead Deltas    | Approved                     |
| [ADR-009](ADRs/ADR-009-semantic-json-merge-for-multi-user-conflict-resolution.md) | Semantic JSON Merge for Multi-User Conflict Resolution                        | Approved                     |
| [ADR-010](ADRs/ADR-010-in-memory-per-user-cache-index-for-querying.md) | In-Memory Per-User Cache/Index for Querying                                   | Approved                     |
| [ADR-011](ADRs/ADR-011-branching-chronology-model-with-concurrent-branch-isolation.md) | Branching Chronology Model with Concurrent-Branch Isolation                   | Approved                     |
| [ADR-012](ADRs/ADR-012-desktop-as-thin-launcher-no-native-shell.md) | Desktop as Thin Launcher, No Native Shell                                     | Approved                     |
| [ADR-013](ADRs/ADR-013-mobile-native-app-as-primary-target.md) | Native Mobile App as Primary Target, Not PWA                                  | Approved                     |
| [ADR-014](ADRs/ADR-014-dual-exdecution-mode-interactive-vs-async.md) | Dual Execution Model: Interactive Sessions vs. Isolated Async Jobs            | Approved                     |
| [ADR-015](ADRs/ADR-015-ai-development-rails.md) | Development Gate: System-Level Tests, Mechanical Enforcement, Squash-on-Merge | Approved                     |
| [ADR-016](ADRs/ADR-016-scale-to-zero-cache-model-with-branch-scoped-transactional-index.md) | Scale-to-Zero Cache Model with Branch-Scoped, Transactional Index Consistency | Approved                     |
| [ADR-017](ADRs/ADR-017-three-schema-model-for-narrative-state.md) | Three-Schema Model for Narrative State                                        | Approved                     |
| [ADR-018](ADRs/ADR-018-prose-as-flat-files-outside-git-data-store.md) | Prose as Write-Once Flat Files Outside GitDataStore                           | Approved                     |
| [ADR-019](ADRs/ADR-019-mvp-scope-boundary.md) | MVP Scope Boundary                                                            | Open — not yet finalized     |
| [ADR-020](ADRs/ADR-020-openobserve-for-local-observability.md) | OpenObserve for Local Observability, Lifecycle Owned by MagpieWeaverApp       | Approved                     |
| [ADR-021](ADRs/ADR-021-github-actions-as-cicd-provider.md) | GitHub Actions as CI/CD Provider                                              | Open — pending investigation |
| [ADR-022](ADRs/ADR-022-structural-pii-linter.md) | Structured PII Linter: Hard Block with Audited Override                       | Approved                     |
