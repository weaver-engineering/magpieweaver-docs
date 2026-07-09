# Magpie Weaver Architecture

## 1. Context

- [Glossary](/docs/glossary.md) - Glossary of terms.
* [About Magpie Weaver](../magpie-weaver.md) - Background reading about Magpie Weaver.
* [High Level Design](high-level-design.md) - Magpie Weaver high level design.

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

