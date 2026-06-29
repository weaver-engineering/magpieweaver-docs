# Magpie Weaver — Roadmap

The top-level delivery plan for Magpie Weaver. Epics are listed in sequence;
each is planned in detail by its own `PLAN-` task before it starts.

## Epics

| Ref  | Epic                      | Status   | Planning task | File |
|------|---------------------------|----------|---------------|------|
| `E1` | Architecture & HLD        | Proposed | `PLAN-2`      | —    |
| `E2` | Hello World Prototype     | Proposed | `PLAN-3`      | —    |
| `E3` | Stand up LLM              | Proposed | `PLAN-4`      | —    |
| `E4` | Git-backed file store     | Proposed | `PLAN-5`      | —    |
| `E5` | Minimum Product           | Proposed | `PLAN-6`      | —    |
| `E6` | MVP                       | Proposed | `PLAN-7`      | —    |

---

## E1 — Architecture & HLD

Establish the shape of the system before any code is written. Identify the
high-level components, decide the technology stack and implementation language,
create the required repositories, and agree how components will be documented.
Cross-repo branch naming is also confirmed here.

**End state:** HLD complete; top-level components identified and documented;
all required repos created; technology stack and language decided; cross-repo
branch naming confirmed; component documentation approach agreed.

**Planned by:** `PLAN-2`

---

## E2 — Hello World Prototype

Stand up the full multi-deployment stack with the simplest possible feature: a
UI that asks the user's name and returns "Hello \<name\>" from the backend.
Delivered across all three deployment targets — local desktop (embedded backend
+ embedded browser), AWS (API backend + web UI), and Android (emulator or
sideloaded APK). CI/CD is established in this epic. The UI and backend are
separate, reusable components from the outset.

**End state:** Hello World running locally, on AWS, and on Android; UI and
backend confirmed as independently deployable reusable components; CI/CD
pipeline established.

**Planned by:** `PLAN-3`

---

## E3 — Stand up LLM

Provision an LLM for development and testing, minimising cost. The hosting and
provider strategy (self-hosted open-source vs. commercial API proxy) is decided
as the first act of E3 planning, informed by `RES-1` and `RES-2`.

**End state:** An LLM is available to the development environment; the
provider/hosting decision is recorded; development can proceed against a stable
inference target without unexpected cost.

**Planned by:** `PLAN-4`

---

## E4 — Git-backed file store

Define a generic file store interface (read, write, update, list) and implement
it backed by the Git manuscript repository. A clean abstraction here means E5
(Minimum Product) can use the file store without coupling to Git internals, and
the full metamodel in E6 (MVP) can expand the stored entities without changing
the interface. The manuscript repo directory structure (characters, lore, scenes,
timeline, etc.) is established in this epic. Generic design supports future
metamodel expansion.

**End state:** A working generic file store with a clean interface; Git-backed
implementation with read, write, update, and list operations; manuscript repo
directory structure established; all file operations in the codebase go through
the interface.

**Planned by:** `PLAN-5`

---

## E5 — Minimum Product

Integrate the LLM with a minimal character definition and demonstrate the
end-to-end flow: author interacts with Magpie Weaver → Magpie Weaver queries
the LLM in character → result returned to the author. Runs across all
deployment targets established in E2, using the file store from E4. The
character model here is intentionally minimal and will be superseded by the
full metadata model in E6.

**End state:** Author can address a question to a named character and receive
an in-character LLM response, via local, AWS, and Android deployments.

**Planned by:** `PLAN-6`

---

## E6 — MVP

The minimum viable product: the full metadata model (lore, characters, story
arcs, scenes, timelines, revealed truths), the Magpie engine (context assembly,
scene generation, continuity linting, state mutation and author approval), and
the complete author-facing experience (scene setup and direction, prose output,
evolving world bible).

**End state:** Author can set up a scene, direct characters, and receive
generated prose; the agent updates the metadata after each scene with author
review; the world bible evolves across sessions.

**Planned by:** `PLAN-7`
