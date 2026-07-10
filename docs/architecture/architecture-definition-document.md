# Magpie Weaver Architecture

---
## 1. Context

- [Glossary](/docs/glossary.md) - Glossary of terms.
- [About Magpie Weaver](../magpie-weaver.md) - Background reading about Magpie Weaver.
- [High Level Design](high-level-design.md) - Magpie Weaver high level design.

This document details the architecture of Magpie Weaver. It records what is being build and the environments
it is build in (production/test/development).
It defines the development approach and cycle. It documents the guardrails to keep changes to the code base
controlled and delivering changes inline with the agreed design.
It details the devOps build process so that new developers (or development continuing after a break) always have a 
reference of how Magpie Weaver is built.
It defines the deployment process (CI/CD pipeline), the gates between pipeline stages and the devOps infrastructure. 
It sepcifies the configuration of the OpenCode Agentic AI IDE that is used to keep the agent working efficiently 
within the confines of the development cycle phase.

---
## Production Architecture
There are 2 flavors of production architecture for Magpie Weaver.
The architecture of the system at enterprise scale, not part of MVP and the architecture as small scale (limited users)

### Target Production Architecture - Enterprise Scale

```
---------------- Local Device ----------------------+----------------- Cloud (e.g. AWS) ------------------------------ 
                                                    |
+------------------+                                |             
| iOS - Native App + ----------+                    |                                         +--------storage-------+
+------------------+           |                    |                                         |          EFS         |
                               |                    |                 +---------------+   +-> + (Per user workspaces |
+----------------------+       |   +- embedded -+   |   +-----+       | EC2 Instance+ |   |   |  & Git repos)        |
| Android - Native App + ------+-> |     UI     | <---> + ALB + <---> + (TS Service   + <-+   +----------------------+
+----------------------+       |   | (React/TS) |   |   +-----+       | & Git binary) |   |
                               |   +-----+------+   |                 +---------------+   |   +--------cache---------+
+---------------------------+  |                    |                                     +-> +   ElastiCache        |
| Desktop - magpieweaver.sh + -+                    |                                     |   |   -Memcached-        |
|   -system tray icon-      |                       |                                     |   | (User session data   |
+-----cache-----------------+                       |                                     |   | Indexes, Semaphores  |
|   Map<string,any>         |                       |                                     |   | etc.)                |
+---------------------------+                       |                 +----LLM----+       |   +----------------------+
|  TS Service & Git binary  + <-------------------------------------> + Bedrock   + <-----+    
+-------storage-------------+                       |                 |model - TBD| 
|      Local FS             |                       |                 +-----------+ 
+---------------------------+                       |                 
```

* Mobile first
* Thin client
* Single React/TS UI
* Single Reast Service backend
* Bedrock LLM 
  - model TBD
  - pay-per-use
* Cloud
  * Load balanced EC2 instances 
    - TS Server & Git binaries
  * EFS shared storage 
    - per user workspaces
  * Elasticache 
    - memcached session data
* Local
  * Local Compute 
    - TS Server & Git binaries
  * Local RAM 
    - map cached session data
  * Local FS 
    - per user shared workspaces

### MVP Production Architecture - Limited Users

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
* Thin Client
* React/TS UI
* Single EC2 Instance
  - TS Server & Git binaries
  - scale-to-zero
* EC2 Instance scoped cache 
  - map cached session data
* EFS storage
  - per user workspaces
* Bedrock LLM 
  - model TBD
  - pay-per-use

---
## Test Architecture

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
* Thin Client
* React/TS UI
* Single EC2 Instance
  - TS Server & Git binaries
  - scale-to-zero
* EC2 Instance scoped cache
  - map cached session data
* EFS storage
  - per user workspaces
* Bedrock LLM
  - model TBD
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
* Thin Client
* React/TS UI
* Local Compute 
  - TS Server & Git binaries
  - start-stop by developer
* Local RAM 
  - map cached session data
* Local FS 
  - per user shared workspaces
* LM Studio LLM 
  - model TBD

### Development Approach
The development approach is 100% AI authored code. To support this and ensure that the final solution is fit-for-purpose
the deployed systems **MUST** be fully designed before development starts and to avoid the AI becoming overloaded with 
context the delivery of system code **MUST** be specified in detail at a task level. A system is built over many tasks
where the scope of each task delivers part of the designed system. The scope of a task is defined by is task specification
`task-<REF>-spec.md`. 

Due to the agentic nature of the approach the documentation of Magpie Weaver its architecture and designs **MUST** be in 
a format and location that the agents can read. Documentation of Magpie Weaver as a whole, architecture, HLD, subsystem
designs and component breakdown are all recorded in *this* repository. The documentation of a task (what it is supposed
to deliver) is recorded in `task-<REF>.md` with `task-<REF>-spec.md`. These documents live within the code base that the
task changes. They are recorded in 
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
repository (this one) it is also available to the argent by cloning *this* repository into the workspace used by the
agent.

Although the code is to be 100% AI developed, it **MUST** be maintainable without AI assistance.

### Development Cycle
To keep the AI agents honest each task goes through 5 phases.
* `specification`
* `test`
* `build`
* `deploy`
  - `deploy-test` - UAT testing of the deployed test system demonstrates that the behavioral changes work as expected
  - `deploy-prod` - Sanity testing asserts that the new behaviors are deployed correctly to production.
* `done`

In the `specification` phase the task is *owned* by the human architect. The architect ensures that the system designs
that the task delivers or relies upon are fully complete (at least with respect to the task, though ideally 100%
complete) before the agent takes over the completion of the task. The spec defines the expected system behaviors that
must be exhibited by the system for the task to be complete.The architect writes the `task-<REF>.md` and the
`task-<REF>-spec.md` and commits them to the code repository. Once the architect is content that the documentation
required to complete the task is done and committed to the code repository the `specification` phase is complete and the
task transitions to the `test` phase.

In the `test` phase the agent reads the `tast-<REF>.md` and the `task-<REF>-spec.md` files and whatever design
documentation it deems necessary and write the failing tests which must pass before the task can be completed.
During the `test` phase the agent **may only** change contents in the test packages. The new tests **MUST** fail against
the existing code base while old tests must still pass against the existing and unchanged code base.
During the `test` phase these behaviors are encapsulated in *system tests* which test that the system as a whole
exhibits the required behavior. Since the tests are defined as a system level they may only mock the subsystem
dependencies. This ensures that the tests map directly to the expected behavior of the system as a whole (the level
at which the architect has designed it) so that the they can assert at review time that the tests are a fair
reflection of the required behavior of it. The tests **MUST** fully assert the interactions with the external
systems on which the system depends.
Once the archtect is content that the tests written by the agent properly reflect the required behaviors the failing
tests are commited to the code repository and the `test` phase is complete and the task transitions to the next phase
`build`.

In the `build` phase the agent reads the `tast-<REF>.md` and the `task-<REF>-spec.md` files and whatever design
documentation it deems necessary and **without changing the test package or the design/specs** implements the code
changes required to make the failing tests pass. Once the architect is content that the system behaves as required
by the task and that existing system behaviors are unaffected (existing tests still pass) the code changes are also
committed to the code repository and the task transitions to the `deployment` phase.

In the `deployment` phase the CI/CD deploys the changes to the test environment and blocks until UAT testing
(human interactive testing) passes. On UAT *pass* the `deploy-test` subphase is complete the change is deployed to 
production. Before the change is deployed, the 3 commits (`specification`/`test`/`build`) are squashed into a
single commit to keep the commit history clean. The changes for the task (single commit) are merged with mainline
and the system deployed to production, where a final *santity* test (human interactive testing) asserts that the 
new behaviors are extant in the production environment. With the changed behaviors acceptance tested in `deploy-test` 
and extant in production `deploy-prod` the task transitions to its final phase (state) `done` 

At any phase, until `done` the task can be reverted back to any earlier phase, to change the design/specs/tests which 
define the changes that the AI agent is expected to perform in the subsequent phases.

The tasks progress through these phases is tracked by the ticketing system `Linear` where the task and its `<REF>` are 
mastered.

### Guard Rails
**ToDo**

### Build Process
**TBC**

### Deployment / CI/CD Pipeline
**TBC**

### OpenCode Configuration
**TBC**

### Repositories
To minimise the risk of one `subsystem` of Magpie Weaver being build against the wrong version of other `subsystems` all
the `subsystems` of Magpie Weaver are defined in a single code repository. To keep the commit history of the code
base clean, documentation of Magpie Weaver resides in its own repository `this one`.

All changes to all repositories **MUST** be related to a `Linear` task by stamping the commit message with the 
`task-<REF>`. This includes documentation changes. i.e. No changed are made to the mainline documentation without a
`Linear` task justifying why the change is required and what the scope of the change is. No commit to any branch of the 
code base is permitted without reference to a `Linear` task. This keeps the documentation chain intact and supports
either new contributors joining the team and (more importantly) allows development effort to pause for a while without
risking the architect loosing their place/context the the Magpie Weaver project.

The repositories maintained by the MagpieWeaver project are:
* The Documentation Repository
  - https://github.com/simonemmott/magpieweaver-docs
* The Code Repository
  - https://github.com/simonemmott/magpieweaver

#### Branching Strategies
**ToDo**

---
# Appendix

## Architectural Decision Records

| Reference                                                                                    | Title                                                                         | State                        |
|----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|------------------------------|
| [ADR-001](ADRs/ADR-001-tech-stack-solution.md)                                               | Tech Stack Solution                                                           | Approved                     |
| [ADR-002](ADRs/ADR-002-repository-layout-strategy.md)                                        | Repository Layout Strategy                                                    | Approved                     |
| [ADR-003](ADRs/ADR-003-operational-separation-via-task-modes.md)                             | Operational Separation Via Task Modes                                         | Approved                     |
| [ADR-004](ADRs/ADR-004-storage-tier-isolation.md)                                            | Storage Tier Isolation                                                        | Approved                     |
| [ADR-005](ADRs/ADR-004-storage-tier-isolation.md)                                            | Cloud Hosting Infrastructure                                                  | Approved                     |
| [ADR-006](ADRs/ADR-006-multi-user-colaboration-via-per-user-git-workspace.md)                | Multi-User Collaboration via Per-User Git Workspaces                          | Approved                     |
| [ADR-007](ADRs/ADR-007-editing-model-separation-and-commit-granularity.md)                   | Editing Mode Separation & Commit Granularity                                  | Approved                     |
| [ADR-008](ADRs/ADR-008-multi-devide-concurrency.md)                                          | Multi-Device Concurrency via Checksum-Validated PATCH + Write-Ahead Deltas    | Approved                     |
| [ADR-009](ADRs/ADR-009-semantic-json-merge-for-multi-user-conflict-resolution.md)            | Semantic JSON Merge for Multi-User Conflict Resolution                        | Approved                     |
| [ADR-010](ADRs/ADR-010-in-memory-per-user-cache-index-for-querying.md)                       | In-Memory Per-User Cache/Index for Querying                                   | Approved                     |
| [ADR-011](ADRs/ADR-011-branching-chronology-model-with-concurrent-branch-isolation.md)       | Branching Chronology Model with Concurrent-Branch Isolation                   | Approved                     |
| [ADR-012](ADRs/ADR-012-desktop-as-thin-launcher-no-native-shell.md)                          | Desktop as Thin Launcher, No Native Shell                                     | Approved                     |
| [ADR-013](ADRs/ADR-013-mobile-native-app-as-primary-target.md)                               | Native Mobile App as Primary Target, Not PWA                                  | Approved                     |
| [ADR-014](ADRs/ADR-014-dual-exdecution-mode-interactive-vs-async.md)                         | Dual Execution Model: Interactive Sessions vs. Isolated Async Jobs            | Approved                     |
| [ADR-015](ADRs/ADR-015-ai-development-rails.md)                                              | Development Gate: System-Level Tests, Mechanical Enforcement, Squash-on-Merge | Approved                     |
| [ADR-016](ADRs/ADR-016-scale-to-zero-cache-model-with-branch-scoped-transactional-index.md)  | Scale-to-Zero Cache Model with Branch-Scoped, Transactional Index Consistency | Approved                     |
| [ADR-017](ADRs/ADR-017-three-schema-model-for-narrative-state.md)                            | Three-Schema Model for Narrative State                                        | Approved                     |
| [ADR-018](ADRs/ADR-018-prose-as-flat-files-outside-git-data-store.md)                        | Prose as Write-Once Flat Files Outside GitDataStore                           | Approved                     |
| [ADR-019](ADRs/ADR-019-mvp-scope-boundary.md)                                                | MVP Scope Boundary                                                            | Open — not yet finalized     |
| [ADR-020](ADRs/ADR-020-openobserve-for-local-observability.md)                               | OpenObserve for Local Observability, Lifecycle Owned by MagpieWeaverApp       | Approved                     |
| [ADR-021](ADRs/ADR-021-github-actions-as-cicd-provider.md)                                   | GitHub Actions as CI/CD Provider                                              | Open — pending investigation |
| [ADR-022](ADRs/ADR-022-structural-pii-linter.md)                                             | Structured PII Linter: Hard Block with Audited Override                       | Approved                     |

