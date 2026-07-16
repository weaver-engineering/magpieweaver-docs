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
> the enterprise-scale architecture — **confirmed by ADR-019 (now Approved)**, which also resolves that this
> exclusion covers Local Desktop Mode as a *shipped surface* specifically; the separate Development Architecture
> (below) is unaffected, since it doesn't use the Local Desktop launcher at all.

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

This section consolidates and formalizes the mechanical guardrails that keep
100% agent-authored **code changes** controlled and aligned with the agreed
design. It draws together decisions already recorded piecemeal in the
Development Cycle section above, HLD §11.3/§11.4, ADR-015, and ADR-021 —
this is the single place they're stated as one coherent set, rather than
the reader having to reassemble them from three documents.

> **Note on scope — ADR-022 is deliberately not covered here.** MAG-35's own
> task description lists ADR-022 (Structured PII Linter) as related context,
> but it's a different category of guardrail entirely: a **runtime**
> application feature (Weaver's continuity-linting pass and Data Entry
> save/publish time, per the HLD) that checks narrative *content* users
> generate, not a CI/CD check gating agent-authored *code* changes before
> merge. Conflating the two would blur what this section is actually
> about — controlling the code-change pipeline. ADR-022 remains fully in
> force; it simply belongs to **MagpieEngine's** runtime design (HLD
> §12.11), not this section — confirmed over Weaver specifically because
> nearly all user-authored free text sits in MagpieEngine's domain (Data
> Entry mode's entity/metadata fields), while Weaver only sees user text
> indirectly, as scene direction feeding generation; Weaver's
> continuity-linting pass invokes MagpieEngine's lint utility rather than
> owning a second copy.

> **Resolved: OpenCode is the correct tool; the HLD's Kiro references were
> an error, now corrected there too.** OpenCode was confirmed over Kiro
> specifically because it's model-agnostic — it works with Bedrock in
> production and local Ollama/LM Studio in dev, matching this project's own
> multi-tier LLM strategy, rather than tying development tooling to AWS's
> own models and subscriptions the way Kiro would. One thing this correction
> surfaced, worth stating plainly rather than silently absorbing: **Kiro
> genuinely does offer native spec→implement gating out of the box; OpenCode
> does not.** OpenCode's built-in workflow is a simpler two-state toggle —
> Plan mode (read-only analysis) and Build mode (full read/write) — not a
> native three-phase Spec/Test/Build gate. Approximating phase separation in
> OpenCode itself means configuring custom slash commands and subagent
> isolation per phase, not relying on an out-of-the-box feature. This makes
> §2's CI-side mechanical checks the real enforcement mechanism, more so
> than they would have been under Kiro's native gating — not a backstop to
> strong IDE-level enforcement, but doing most of the actual work.

**Why mechanical, not judgment-based.** Given 100% agent-authored code,
there is no separate human line-by-line code review backstop — the
Spec→Test→Build gate *is* the primary correctness mechanism (HLD §11.3,
ADR-015). Every guardrail below is designed to be checked by a script or a
CI status check, not by an architect reading a diff and forming an opinion.
Where architect judgment is genuinely required (see "Escalation" below), it
happens at defined checkpoints, not as an ambient backstop.

#### 1. Phase-scoped change permissions

Consolidating the Development Cycle section above into one table — this is
what each phase's guardrail actually gates on:

| Phase | Owned by | Agent may change | Agent may **not** change |
|---|---|---|---|
| **Specification** | Architect | Nothing (agent has no role yet) | N/A — task not yet handed to the agent |
| **Test** | Agent (architect reviews before commit) | Test package files only | Any implementation code; `task-<REF>.md`/`task-<REF>-spec.md`; any existing test's expected behaviour (see §2's fail-then-pass rule) |
| **Build** | Agent (architect reviews before commit) | Implementation code only | The test package; `task-<REF>.md`/`task-<REF>-spec.md`; design/spec documentation |
| **Deploy (deploy-test / deploy-prod)** | CI/CD + architect (UAT/sanity testing) | Nothing — this phase deploys and verifies what Build produced | Everything; this phase is verification, not authorship |
| **Done** | — | Nothing | — (task closed) |

A task can be reverted to any earlier phase at the architect's discretion
(Development Cycle section above); reverting resets which of the above
columns currently applies.

#### 2. Mechanical checks enforced automatically

| Check | Runs at | Enforces | Reference |
|---|---|---|---|
| **Commit-scope diff inspection** | Test commit, Build commit | The "Agent may / may not change" boundaries in §1 above — a Test commit touching implementation files, or a Build commit touching the test package or spec docs, fails the check | ADR-015; ADR-021 |
| **Fail-then-pass test ordering, existing tests immutable** | Test commit (pre-implementation), Build commit (post-implementation) | New tests in the Test commit must **fail** against the pre-existing codebase; **any diff touching a pre-existing test file, or anything outside the test package, fails the check outright** — this is a hard invariant with no built-in automated exception. After the Build commit, **all** tests (new and old) must pass, with no further test edits. In-progress drafting/revision of *this task's new tests* is unrestricted before the final commit — intermediate commits are squashed into one before the gate evaluates anything, so the gate only ever diffs the final squashed Test commit against mainline's prior state, never the agent's own iteration history | HLD §11.3; ADR-015; ADR-021 |
| **Diff-scoped coverage thresholds** | Build commit | ~80–85% overall codebase coverage; **95%+ on new/changed lines specifically** (diff coverage, not whole-file) — avoids penalizing an agent for pre-existing untested code in a touched file | HLD §11.3 |
| **"Unicorn linter" (weak-but-passing test detection)** | Test commit, Build commit | Flags code/tests built on literal-value checks disconnected from the component's natural behaviour — a test that passes mechanically without actually exercising the requirement it claims to cover | HLD §11.3 |
| **Small-change fast path** | Task start | Changes that don't require altering existing tests and still pass coverage checks may skip the full three-gate cycle and go straight to implementation | HLD §11.3 |
| **Branch protection / required status checks** | Every PR/merge attempt | Makes every check above an actual merge precondition, not an advisory one | ADR-021 |
| **Squash-on-merge** | Merge to mainline | The three phase-scoped commits (Spec/Test/Build) are squashed into one on merge — a deliberate tradeoff of detailed gate-level forensics (which live in the per-task doc files, HLD §11.4) for a clean mainline history | ADR-015; HLD §11.4 |

**Status of implementation, not just design:** ADR-021 confirmed GitHub
Actions is *capable* of enforcing every check above (via required status
checks, scripted commit-diff inspection, and structured test-result
ingestion) — it did not confirm these scripts already exist. Building and
maintaining them is separate, tracked engineering work
(`docs/specs/tech-stack.md`), not something this section can claim is
already running.

**A deliberate wrinkle, not a gap: pre-existing tests are truly immutable
to this gate.** An earlier draft of this section (and of HLD §11.3) assumed
a "reviewed test-branch gated by a linter confirming concurrence with the
spec" could safely permit an existing test's expected output to change.
That mechanism doesn't actually work: an automated linter judging whether a
test change "matches updated intent" would be making exactly the kind of
semantic judgment call this entire gate model exists to avoid trusting to
automation — an agent could get an automated pass to weaken a
regression-protection test simply by phrasing the change as spec-compliant.
The correct model is simpler and stricter: **the check has no built-in
exception path.** If a pre-existing test genuinely needs to change, the
gate **will always fail**, by design. The only way through is the
architect's manual override (§3 below) — and that override should itself
be preceded by its own Specification-phase task revising the relevant
spec to justify the change, giving the same documented paper trail every
other change gets, rather than a bespoke automated carve-out.

#### 3. Escalation — how violations are surfaced to the architect

Given this project's actual scale (a single architect working with an
agent, not a team), surfacing is deliberately simple rather than a
notification system:

- **Mechanical check failures** appear as a failed required status check on
  the PR/branch (visible directly in GitHub) — the merge is blocked at the
  platform level; there is no separate alerting channel to build or
  maintain.
- **Task-state visibility:** each task's `task-<REF>.md` state (Specified →
  Tested → Done, HLD §11.4) only advances when its corresponding gate
  passes — a task stuck on a failing check simply doesn't advance state,
  which is itself the visible signal to the architect reviewing Linear.
- **Architect review remains the explicit checkpoint at every phase
  transition** (Development Cycle section above: "once the architect is
  content that..." at both the Test→Build and Build→Deploy transitions) —
  mechanical checks are a precondition for that review, not a replacement
  for it.
- **Manual override** remains available to the architect throughout (§4
  below; HLD §11.3) — an admin bypass of a required status check, used at
  the architect's discretion. Two distinct cases warrant it: a check's
  failure being itself wrong (rare), and the deliberate, expected case of a
  genuinely necessary pre-existing-test change (§2 above) — always
  preceded by its own spec-revision task, never a bare override with no
  accompanying justification on record.

#### 4. IDE-level support (OpenCode)

**OpenCode** is intended to keep the agent working within phase boundaries
as it works, ahead of §2's mechanical checks acting as the actual
enforcement backstop. OpenCode does not provide native three-phase
Spec/Test/Build gating (see the resolved note above) — its own built-in
modes are a simpler Plan (read-only analysis) / Build (full read/write)
toggle. The practical configuration for this project's phase model:

- **Plan mode** for the Specification phase (architect-owned; agent has no
  editing role yet, so read-only analysis is a natural fit if the agent is
  consulted at all during this phase).
- **Build mode**, scoped per phase via **custom slash commands** (e.g. a
  project-defined `/test-phase` command instructing the agent to touch only
  the test package, and a `/build-phase` command instructing it to touch
  only implementation) — this is configuration this project defines, not an
  OpenCode feature that enforces the boundary on its own.
- **Subagent isolation** (`subtask: true`) is available to force a given
  phase's work into its own isolated context, which may help keep a Test-
  phase agent invocation from "seeing" or being tempted to touch
  implementation code it hasn't been asked to change — worth evaluating
  during actual pipeline build-out, not assumed effective here.
- **Git-backed snapshots** (OpenCode creates one on every meaningful change)
  give a fine-grained undo/redo trail during a single phase's work, useful
  for the architect's in-phase review before a phase's commit is finalized
  — distinct from, and in addition to, the three-commit-per-task structure
  itself (HLD §11.4).
- **LSP integration** (real-time compiler diagnostics fed back to the
  model) supports faster self-correction during the Build phase
  specifically — reduces the number of Build-phase iterations needed before
  the mechanical checks in §2 are run, though it doesn't substitute for them.

None of the above is a hard boundary — per the resolved note above, the
guardrail that actually holds is the mechanical CI-side check in §2, not
OpenCode's own workflow state. This subsection describes how OpenCode is
configured to *support* working within phase boundaries, not what enforces
them. Detailed configuration (exact command definitions, agent frontmatter)
belongs in the "OpenCode Configuration" section below, once written.

### Security & Secrets Management
**ToDo** — see task `TBD-03`.

This section will cover how credentials and sensitive data are protected across environments: Bedrock API
credentials, Git credentials for per-user workspaces, session data held in cache, how ADR-022's structural PII
linter fits into the wider security posture, and how ADR-023's account-PII encryption key (SSM Parameter Store
`SecureString`) is managed and rotated — key rotation specifically is flagged in ADR-023 as not yet defined.

### Build Process
**TBC** — see task `TBD-04`.

### Deployment / CI/CD Pipeline
**TBC** — see task `TBD-05`.

> **Note — ADR-021 resolved:** GitHub Actions is confirmed as the CI/CD provider (ADR-021, now Approved). This
> section's remaining TBC status is about the specific pipeline stages/gates/infrastructure implementation, not
> provider choice — the gate-enforcement scripts themselves (commit-diff inspection, fail-then-pass test ordering,
> diff-scoped coverage, the unicorn linter) are still unbuilt and tracked as their own follow-up task, per ADR-021's
> Consequences.

### Rollback / Incident Response
**ToDo** — see task `TBD-06`.

The deployment process above defines forward gates (`deploy-test` UAT, `deploy-prod` sanity test) but not yet what
happens if a `deploy-prod` sanity test fails after mainline has already been merged and deployed. This section will
define the rollback procedure and who/what triggers it.

### OpenCode Configuration
**TBC** — see task `TBD-07`.

> **Note:** OpenCode is confirmed as the correct tool (see the Guard Rails
> section above, §4) — the earlier naming conflict with the HLD's Kiro
> references has been resolved and corrected in both documents. This
> section still needs the actual configuration detail: custom slash-command
> definitions for phase-scoped work, subagent/`subtask` configuration, and
> LSP setup per language — sketched at a high level in Guard Rails §4, not
> yet specified in full here.

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
  - https://github.com/weaver-engineering/magpieweaver-docs
* The Code Repository
  - https://github.com/weaver-engineering/magpie-weaver

#### Branching Strategies

**The Code Repository**

```
----------- local repository ----------------------------+---------------------------- Github --------------------------+------ Environments -------
> Specfication Phase                                     |                                                              |
> ==================                                     |                                                              |
> ( Start ) -> pull (main) <------------------------------------------ main [HEAD]                                      |
>                 |                                      |                                                              |
>              checkout - (spec/{ref})                   |                                                              |
>                 |                                      |                                                              |
>              write /docs/tasks/task-<ref>.md           |                                                              |
>              write /docs/tasks/task-<ref>-spec.md      |                                                              |
>                 |                                      |                                                              |
>              commit (specification-commit)             |                                                              |
>                 |                                      |           +---manual--+                                      |
>              raise PR -> (test/{ref}) ---------------------------> | Test Gate |                                      |
                                                         |           |   merge   |                                      |
> Test Phase                                             |           +-----------+                                      |
> ==========                                             |                 |                                            |
>              pull (test/{ref}) <----------------------------------- test/{ref} - main[HEAD] & specification-commit    |
>                  |                                     |                                                              |
>              code failing tests                        |                                                              |
>                  |                                     |                                                              |
>              commit (test-commit)                      |                                                              |
>                  |                                     |           +---manual---+                                     |
>              raise PR (build/{ref}) -----------------------------> | Build Gate |                                     |
                                                         |           |   merge    |                                     |
> Build Phase                                            |           +----------_-+                                     |
> ===========                                            |                 |                                            |
> ( Start ) -> pull (build/{ref}) <---------------------------------- build/{ref} - main[HEAD] & specification-commit   |
>                  |                                     |                           & test-commit                      |
>              code solution to failing tests            |                                                              |
>                  |                                     |                                                              |
>              commit (build-commit)                     |                                                              |
>                  |                                     |                                                              |
>             [ Deploy {dev} ] ----------------------------------------------------------+                              |           
>                  |                                     |                               |                              |
>              raise PR (uat/{ref}) ---------------------------------------+             |                              |  
>                                                        |                 |             |                              |
                                                         |                 |             |                              |
> Manual Task                                            |                 |             |                              |
> ===========                                            |                 |             |                              |
> ( Start ) -> pull (main) <-------------------------------- main [HEAD]   |             |                              |
>                 |                                      |                 |             |                              |
>              checkout - (task/{ref})                   |                 |             |                              |
>                 |                                      |                 |             |                              |
>              do task                                   |                 |             |                              |
>                 |                                      |                 |             |                              |
>              commit (task-commit)                      |                 |             |                              |   Development Environment
>                 |                                      |                 |             |                              |   =======================
>            [ Deploy {dev} ] -----------------------------------------------------------+--------------------------------> Deployed task {ref}
>                 |                                      |                 |                                            |
>                 |                                      |           +---manual---+                                     |
>              raise PR (uat/{ref}) -------------------------------> | UAT Gate   |                                     |  
>                                                        |           |   merge    |                                     |
                                                         |           +------------+                                     |                                                         
> User Acceptance Test Phase                             |                 |                                            |
> ==========================                             |                 |    main[HEAD} & (specification-commit      |
>                                                        |                uat - & test-commit                           |    
>                                                        |                 |    & build-commit) OR task-commit          |
>                                                        |                 |                                            |
>                                                        |            +------automatic--------+                         |
>                                                        |            | Deploy Test Action    |                         |    Test Environment
>                                                        |            | squash commits        |                         |    ================
>                                                        |            | Deploy {test}         | ---------------------------> Deployed task {ref}
>                                                        |            | raise PR (main)       |                         |
>                                                        |            +-----------------------+                         |
                                                         |                 |                                            |
                                                         |            +------manual---------+                           |    
> Deployment Phase                                       |            | Main Gate           |                           |
> ================                                       |            | merge               |                           |
>                                                        |            +---------------------+                           |
>                                                        |                 |                                            |
>                                                        |            +-----automatic-------+                           |    Production Environment
>                                                        |            | Deploy Prod Action  |                           |    ======================
>                                                        |            | Deploy {production} |------------------------------> Deployed task {ref}
>                                                        |            +---------------------+                           |
                                                         |                 |                                            |
(Done) <------------------------------------------------------------- main [task-commit -> HEAD]                        |                                                                                           
                                                         |                                                              |
```
**Branches**
- ***spec/{ref}***
  - New `spec/{ref}` branches from `main[HEAD]`.
  - The architect commits task specifications to this branch for the given `task-{ref}`, referencing design documentation in `magpieweaver-docs`repository.
  - Changes are **ONLY PERMITTED** in `/docs/tasks/task-{ref}` and **MUST** contain at least `/docs/tasks/task-{ref}/task-{ref}.md`and `/docs/tasks/task-{ref}-spec.md`
  - `origin/spec/*` accepts pushes from remotes.

- ***test/{ref}***
  - New `test/{ref}` branches from `spec/{ref}[HEAD]`.
  - The agent commits failing tests to this branch for the given `task-{ref}` which exercise the designed behaviors of the system.
  - Changes are **ONLY PERMITTED** in `/test`.
  - Existing tests **MAY NOT** be edited and **MUST** pass.
  - At least 1 new failing test **MUST** exist.
  - `origin/test/{ref}` rejects pushes from remotes and requires a PR from `spec/{ref}`.

- ***build/{ref}***
  - New `build/{ref}` branches from `spec/{ref}[HEAD]`.
  - The agent commits solutions to the failing tests
  - Changes are **ONLY PERMITTED** in `/src`
  - All tests **MUST** pass.
  - `origin/build/{ref}` rejects pushes from remotes and requires a PR from `test/{ref}`.
  
- ***task/{ref}***
  - New `task/{ref}` branches from `main[HEAD]`.
  - The architect commits changes
  - The change **MUST** be documented in `/docs/tasks/task_{ref}` and contain at least `/docs/tasks/task-{ref}/task-{ref}.md`
  - All tests **MUST** pass.
  - `origin/task/*` accepts pushes from remotes.

- ***uat***
  - `origin/uat` rejects pushes from remotes and requires a pull request from `build/{ref}` OR `task/{ref}`.
  - Merging changes into `origin/uat` 
    - Squashes to a single commit. 
    - Deploys to the test environment.
    - Raises a PR to `main`.

- ***main***
  - `origin/main` rejects pushes from remotes and requires a PR from `uat/{ref}`.
  - Merging changes into `main`
    - Deploys the production environment.

**Gates And Actions**
- ***Test Gate***
  - Is a PR from `spec/{ref}` to `origin/test/{ref}`
  - Requires human approval to proceed
  - Validates
    - Single inbound commit.
    - Commit messages starts with `[{ref}]`
    - Commit message includes a description.
    - Changes are **ONLY** in `/docs/tasks/task-{ref}`
    - `/docs/tasks/task-{ref}/task-{ref}.md` exists.
    - `/docs/tasks/task-{ref}/task-{ref}-spec.md` exists.
  - Requires human override of failing validation.

- ***Build Gate***
  - Is a PR from `test/{ref}` to `origin/build/{ref}`.
  - Requires human approval to proceed.
  - Validates
    - 2 inbound commits
    - 1st commit
      - Passes test gate validation.
    - 2nd commit
      - Commit message starts with `[{ref}]`
      - Commit message includes a description.
      - Changes are **ONLY** in `/test`
      - Existing tests not changed.
      - Existing tests pass.
      - At least 1 new test fails.
  - Requires human override of failing validation.

- ***UAT Gate***
  - Is a PR from `build/{ref}` or `task/{ref}` to `origin/uat`
  - Requires human approval to proceed
  - Validates
    - Changes from `build/{ref}`
      - 3 inbound commits
      - 1st commit
        - Passes test gate validation
      - 2nd commit
        - Commit message starts with `[{ref}]`
        - Commit message includes a description.
        - Changes are **ONLY** in `/test`
        - At least 1 new test
      - 3rd commit
        - Commit message starts with `[{ref}]`
        - Commit message includes a description.
        - Changes are **ONLY** in `/src`
        - All tests pass
    - Changes from `task/{ref}`
      - 1 inbound commit
      - Commit message starts with `[{ref}]`
      - Commit message includes a description.
      - All tests pass
  - Requires human override of failing validation

- ***Deploy Test Action***
  - Triggered on merge to `uat`
  - Squashes to 1 commit, concatenating the commit messages (spec + test + build)
  - Deploys the test environment
  - Raises a PR to `main`

- ***Main Gate***
  - Is a PR from `uat` to `origin/main`
  - Requires human approval to proceed.
  - Validates
    - 1 inbound commit
    - Commit title starts with `[{ref}]`
    - Commit message includes a description.
    - `/docs/tasks/task-{ref}/task-{ref}.md` exists.
    - All tests pass

- ***Deploy Prod Action***
  - Triggered on merge to `main`
  - Deploys the production environment

**The Document Repository**

```
----------- local repository ----------------+---------------------------- Github ---------------------------------+
                                             |
> Research Phase                             |
> ==============                             |
> ( Start ) pull (obsidian) <--------------------- obsidian[HEAD]
>              |                             |
>          write up notes                    |
>              |                             |
>          commit notes-commit               |
>              |                             |                     
>          push (obsidian) --------------------------------+
                                             |             |
( Done ) <---------------------------------------- obsidian[notes-commit -> HEAD]
                                             | 
> Documentation Phase                        |
> ===================                        |                                                                      
> ( Start ) -> pull (main) <---------------------- main [HEAD]
>               |                            |
>            checkout task/{ref}             |
>               |                            |
>            squash merge (origin/obsidian) <----- obsidian[HEAD]
>               |                            |
>            write up documentation          |
>               |                            |
>            commit documentation-commit     |
>               |                            |     +------manual-----+
>            raise PR (main) --------------------> | Main Gate       |
                                             |     | merge           |
                                             |     +-----------------+
                                             |             |
( Done ) <--------------------------------------------------------- main [documentation-commit -> HEAD]
                                             |             |
                                             |     +---automatic-----+
                                             |     | Main Action     |
                                             |     | push (obsidian) | ---> obsidian [documentation-commit -> HEAD]
                                             |     +-----------------+
                                             | 
```

***Branches***

- ***obsidian***
  - Kept up to date with `main[HEAD]`
  - Used for injecting research notes into the repository via obsidian (tablet app) allowing early integration of docs and AI agents.
  - No branch protection
  - Obsidian app configured to auto pull/push on commit;
  - Supports fast research and injection into documentation

- ***main***
  - Protected branch. No pushes to `main`
  - Single branch for documentation changes
  - Pull from `obsidian` before making edits
  - Squashed commits when pulling from `obsidian` (Obsidian creates lots of poorly named/described commits)
  - commits require `[{ref]}` at start of the title
  - commit require a description of the change


***Gates And Actions***

- ***Main Gate***
  - Is a PR to `main`
  - Requires manual approval
  - Requires title of latest commit to start with `[{ref}]`
  - Requires description of commit to be present
  - Requires *at most* 2 commits (1 squashed from `obsidian` and a single commit from `main`)
  - Requires human override of failing validation

- ***Main Action***
  - Triggered by merge into `main`
  - push to `obsidian`


### Task Tracking
Tasks, their status and lifecycle are mastered in `Linear` at https://linear.app/simonemmott/project/magpie-weaver-a6314c2e525d

---
# Appendix

## Architectural Decision Records

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
| [ADR-019](ADRs/ADR-019-mvp-scope-boundary.md) | MVP Scope Boundary                                                            | Approved                     |
| [ADR-020](ADRs/ADR-020-openobserve-for-local-observability.md) | OpenObserve for Local Observability, Lifecycle Owned by MagpieWeaverApp       | Approved                     |
| [ADR-021](ADRs/ADR-021-github-actions-as-cicd-provider.md) | GitHub Actions as CI/CD Provider                                              | Approved                     |
| [ADR-022](ADRs/ADR-022-structural-pii-linter.md) | Structured PII Linter: Hard Block with Audited Override                       | Approved                     |
| [ADR-023](ADRs/ADR-023-account-pii-storage.md) | Account PII Storage: Self-Service Onboarding with Static-Key Encryption       | Approved                     |
