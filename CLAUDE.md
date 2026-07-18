# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **`magpieweaver-docs`** — the *documentation* repository for Magpie Weaver. It contains no application code. The application code lives in a **separate repository, `magpie-weaver`** (https://github.com/weaver-engineering/magpie-weaver).

The split is deliberate (Architecture Definition Document → Repositories): all subsystems of Magpie Weaver share one code repo so they can't be built against mismatched versions of each other, and documentation lives here so the code repo's commit history stays clean. When a change spans both, the design/HLD/ADR side goes here; task-scoped docs (`task-<REF>.md`, `task-<REF>-spec.md`) go in the code repo alongside the branch they describe.

This repo is also an **Obsidian vault**. `[[wikilinks]]`, the `.obsidian/` config, and `Excalidraw/` drawings are expected. Internal doc references use relative Markdown links, not wikilinks.

## What Magpie Weaver is (so the docs make sense)

An AI agent that helps authors write intricate narratives. It models a story as **structured metadata** (lore, characters, arcs, scenes, timelines, revealed truths) held as JSON-Schema-validated entities in Git, and drives characters via LLMs. The metadata — not the prose — is the source of truth. See `README.md` and `docs/magpie-weaver.md`.

## Repository layout

```
docs/
  glossary.md                         # Canonical term definitions — consult before inventing terminology
  magpie-weaver.md                    # Product overview
  architecture/
    architecture-definition-document.md   # Build/dev/deploy architecture, dev cycle, guard rails, branching, ADR index
    high-level-design.md                   # System-level HLD (§-numbered); the map to all component designs
    tech-stack.md                          # Stack rationale (referenced heavily as docs/specs/tech-stack.md in prose)
    workflow-design-summary.md
    ADRs/                                  # ADR-001 .. ADR-NNN + TEMPLATE.md
    components/<component>/<...>-hld.md     # One HLD per top-level component
  analysis/llm-evaluation-candidates.md
  features/mvp-scope-summary.md
  setup/local-dev-environment-setup.md
notes/                                # Raw research awaiting incorporation (arrives via the `obsidian` branch)
```

## The two-document backbone

Almost every architectural question is answered by one of two documents; read the relevant one before editing anything in `docs/architecture/`:

- **`high-level-design.md`** — the system-level design. Heavily cross-referenced by section number (e.g. "§10.1", "§12.5"). Component-level detail is deliberately pushed *out* into `docs/architecture/components/<component>/*-hld.md`; the HLD only covers how components fit together. The **Component Design Documents table (§1b)** is the index of components, their MVP status, their design doc, and — load-bearing — their dependency order.
- **`architecture-definition-document.md`** — how the system is built and shipped: production/test/dev architectures, the development cycle, the Guard Rails, the full Git branching/gate model, and the **ADR index appendix**.

The five MVP components and their dependency order: **GitDataStore** (foundational) → **MagpieEngine** → **Weaver** → **Job Execution Substrate** → **Scene Director**. Non-MVP: Async Job Execution System, Chronology & Multi-Scene Model, Collaboration & Merge System.

Key naming distinction that recurs in the docs: **`BranchingDataStore`** is the *interface*; **`GitDataStore`** is its production *implementation* (`MockDataStore` for tests). Earlier drafts called the interface `FileStore`/`NativeGitFileStore` — those names are retired; don't reintroduce them.

## ADR conventions

- Files: `docs/architecture/ADRs/ADR-NNN-kebab-title.md`, zero-padded to three digits, strictly sequential with no gaps. **The next ADR reference is the highest existing number + 1.**
- Use `docs/architecture/ADRs/TEMPLATE.md` as the starting structure for a new ADR.
- Every ADR must also be added as a row to the **ADR index table** in `architecture-definition-document.md` (Appendix → Architectural Decision Records), with its link, title, and State (typically `Approved`).
- The HLD's §10 "Related Decision Records" prose summary also enumerates ADRs — keep it consistent when adding one that's system-level.

## Editing conventions specific to these docs

- **Corrections are made in place and annotated, not silently rewritten.** These docs record decision history: you'll see inline `**Correction:**`, `**Resolved:**`, `**Note:**`, and `**TODO:**` callouts where a prior position was superseded. Preserve this style — when a decision changes, state what changed and why rather than erasing the old reasoning. Open questions are intentionally left visible.
- Prose is hard-wrapped (~72–80 cols) throughout `docs/architecture/`. Match the surrounding wrapping.
- Cross-references between architecture docs are relative Markdown links; section references are by `§`-number. When you renumber or move a section, grep for stale `§` references — the docs already contain notes where a cross-ref went stale.
- Terminology is fixed by `docs/glossary.md`. Use its terms (Scene, SceneEvent, Arc, Lore, take, chronology, etc.) exactly.

## Change control (applies to commits, if you commit)

Per the Architecture Definition Document (Repositories): **no commit to any branch is permitted without a `Linear` task reference.** Commit titles start with the task `{ref}` and include a description. This applies to documentation changes too — a doc change needs a Linear task justifying it. Tasks are mastered in Linear.

Documentation-repo branch/gate model (Architecture Definition Document → Branching Strategies → The Document Repository):
- **`obsidian`** — unprotected; where research notes land (Obsidian auto-pull/push on commit). Kept level with `main[HEAD]`.
- **`main`** — protected, no direct pushes. Documentation edits: branch a `task/{ref}`, squash-merge `origin/obsidian` in (Obsidian produces many noisy commits), write the doc, PR to `main`. The **Main Gate** requires manual approval, a `{ref}`-prefixed title with a description, and at most 2 commits. A **Main Action** then pushes `main` back to `obsidian`.

## Notes for working here

- There is no build, lint, test, or run step in this repo — it's Markdown, Obsidian config, and drawings. Don't look for a `package.json` or task runner here; those live in the `magpie-weaver` code repo.
- The `magpie-weaver` (code) repo has its own, stricter gate model — a three-phase **Spec → Test → Build** cycle with mechanical CI enforcement (GitHub Actions, ADR-021), described in the Architecture Definition Document's Guard Rails section. That model governs the *code* repo, not this one; don't apply its test/coverage gates to doc changes here.
- `.claude/settings.local.json` (in the vault root, outside the git repo) contains environment config. Treat any credentials there as sensitive.
