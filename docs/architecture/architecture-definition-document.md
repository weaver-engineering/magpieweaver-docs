# Magpie Weaver Architecture

---
## 1. Context

- [Glossary](/docs/glossary.md) - Glossary of terms.
- [About Magpie Weaver](../magpie-weaver.md) - Background reading about Magpie Weaver.
- [High Level Design](high-level-design.md) - Magpie Weaver high level design.

---
## Production Architecture
There are 2 flavors of production architecture for Magpie Weaver.
The architecture of the system at enterprise scale, not part of MVP and the architecture as small scale (limited users)

### Target Production Architecture - Enterprise Scale

```
---------------- Local Device ----------------------+----------------- Cloud (e.g. AWS) ------------------------------ 
                                                    |
                                                    |                 +----LLM----+
                                                    |             +-> + Bedrock   |
                                                    |             |   |model - TBD|
                                                    |             |   +-----------+
+------------------+                                |             |
| iOS - Native App + ----------+                    |             |   +---------------+       +--------storage-------+
+------------------+           |                    |             |   | EC2 Instance  |       |          EFS         |
                               |                    |             +-> + (TS Service   + <-+-> + (Per user workspaces |
+----------------------+       |   +- embedded -+   |   +-----+   |   | & Git binary) |   |   |  & Git repos)        |
| Android - Native App + ------+-> |     UI     | <---> + ALB + <-+   +---------------+   |   +----------------------+
+----------------------+       |   | (React/TS) |   |   +-----+   |                       |
                               |   +-----+------+   |             |   +---------------+   |   +--------cache---------+
+---------------------------+  |                    |             +-> + EC2 Instance  + <-+-> +   ElastiCache        |
| Desktop - magpieweaver.sh + -+                    |             |   | (TS Service   |   |   |   -Memcached-        |
|   -system tray icon-      |                       |             |   | & Git binary) |   |   | (User session data   |
+-----cache-----------------+                       |             |   +---------------+   |   | Indexes, Semaphores  |
|   Map<string,any>         |                       |             |                       |   | etc.)                |
+---------------------------+                       |             +->      ...          <-+   +----------------------+
|  TS Service & Git binary  + ---------------------LLM-->                                     
+-------storage-------------+                       |            
|      Local FS             |                       |
+---------------------------+                       |
```

* Mobile first
* Thin client
* Single React/TS UI
* Single Reast Service backend
* Bedrock LLM - model TBD
* Cloud
  * Load balanced EC2 instances - TS Server & Git binaries
  * EFS shared storage - per user workspaces
  * Elasticache - memcached session data
* Local
  * Local Compute - TS Server & Git binaries
  * Local RAM - map cached session data
  * Local FS - per user shared workspaces

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
* Single EC2 Instance - TS Server & Git binaries
* EC2 Instance scoped cache - map cached session data
* EFS storage - per user workspaces
* Bedrock LLM - model TBD

---
## Test Architecture
???

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
* Local Compute - TS Server & Git binaries
* Local RAM - map cached session data
* Local FS - per user shared workspaces
* LM Studio LLM - model TBD

### Development Approach
100% Agentic AI code writing etc.

### Development Cycle
Task phases etc.

### Guard Rails


### Deployment / CI/CD Pipeline


### OpenCode Configuration


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

