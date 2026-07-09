# About Magpie Weaver

-[Glossary](glossary.md) - Glossary of terms.

## 1. Thesis

**apply the patterns of AI software engineering (Specification-Driven Development + GitOps) to creative writing**:

- **Lore → database schemas** (world rules, geography, technology, canon).
- **Character profiles → state machines** (dynamic state: health, inventory,
  knowledge, psychological state, location).
- **Plot outlines → software specifications** (high-level goals + a queue of
  scenes to write).
- **Scenes → compiled source code** (the actual prose output).
- **A Git repository → the absolute source of truth** and the synchronisation
  layer across devices.

An app that
maintains a data structure / file system / git repo and iteratively calls an AI
model with context drawn from characters, situation, and lore to generate the
next scene, then updates characters with new understanding and the world with
new truths.

## 2. Repository structure

The metadata of a novel, characters, world lore, geography, plot, scenes etc are maintained
as JSON data files in a git repository giving commit, rollback and version control to
narative metadata. This data is maintained automatically via the Magpie Weaver backend services
and is stored in a fixed structural layout of singltons, entities grouped by type into directories.
Each entity is keyed with a UUID to allow entities to be shared between repositorties (narriative projects)

```
my-novel-repo/
├── .git/
├── lore/
│   ├── abd2736deaf82.json
│   └── d8fa239e1bca3.json # historical canon events
├── characters/            # the "state machines"
│   ├── 287ae4f87bd2a.json # dynamic state (inventory, health, wounds)
│   └── 2837da382ef18.json # motivations, secret knowledge, location
├── plot/                  # the "software specification"
│   ├── 12ae8374ecd19.json # high-level goals
│   └── fec28ab28cb18.json # queue of upcoming scenes
└── scnenes/               # the "compiled code" (the book)
    └── 48djef982ab23.json # word count, continuity validation flags
```

## 3. The agent execution loop

A stateful, four-stage loop run in a background thread for each scene:

```
[1. Context Assembler] -> [2. Scene Generator] -> [3. Continuity Linter] -> [4. State Committer]
  (reads lore/profiles)     (drafts the prose)      (validates rules/facts)    (updates JSON & Git)
```

1. **Context assembly.** Read the next item from `scene_backlog.json`; pull in
   *only* the relevant dependencies — the characters involved, the location/lore
   fragments, and the immediately preceding scene — acting like a compiler
   gathering dependencies.
2. **Generation.** Call a frontier LLM with a specific system prompt ("expert
   novelist engine"; honour character motivations, lore constraints, and the
   established prose style); receive raw markdown prose.
3. **Continuity linting.** Pass the draft to a **second, stricter LLM acting as
   a linter/compiler** whose only job is to catch continuity bugs (e.g. magic
   that violates `world_rules.md`; a character holding an item they lost
   earlier). On failure it rejects the output, feeds the error back, and demands
   a rewrite — the loop repeats until the draft passes.
4. **State mutation & commit.** Save the final scene; analyse it to mutate
   character JSON (e.g. `healthStatus: "injured"`) and record new
   `world_truths`; then `git add` + `git commit` (and, later, push). Git history
   gives an immutable record and the ability to `git revert` a plot path that
   goes off the rails.

## 4. Human-in-the-loop review

The source stresses not letting the agent run blind for hundreds of pages.
After each scene the app should pause and present a **pull-request-style view**:

- the drafted scene prose;
- the proposed **JSON diffs** for character/world files (e.g. *+1 secret
  learned*, *−1 sword*);
- an **Approve & Merge** action, or a **Request Changes** box for directing the
  agent ("make this scene darker; have the antagonist escape earlier").