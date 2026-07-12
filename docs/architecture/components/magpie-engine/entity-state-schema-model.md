---
created: 2026-07-05T22:54:31+01:00
modified: 2026-07-05T22:54:37+01:00
---

# Magpie Weaver — Core Data Model: Entity State Schema

> Covers the state-tracking core of the data model: how narrative state is
> defined, held, and moved through time. Character/Scene/WorldLoreItem/
> PlotPoint full schemas are stubbed only — see §6 for what's still open.

---

## 1. Overview

Narrative entities (characters, world lore items, plot-central objects) are
**immutable in their base definition** through the course of directing a
scene, and ideally across the whole narrative. Anything that legitimately
changes over time — a character losing a hand, becoming ordained, learning
a secret — is modeled as an author-defined **`EntityStateAttribute`**, never
as an edit to the entity's own base fields.

There are no default attributes. Every attribute that can affect
chronological validity or narrative context is explicitly defined by the
author. This is why the naming is exactly `EntityStateAttribute`, not
something implying built-in state.

Three schemas work together to model this:

| Schema | Answers |
|---|---|
| `EntityStateAttribute` | What attributes *can* exist, and what type are they? |
| `EntityStateAttributeValue` | What is an attribute's *current* value, right now, in memory? |
| `EntityStateAttributeValueDelta` | What *changed* — old → new — at a specific point? |

All entities, across the whole data model, share a common `id: UUID` (PK).

---

## 2. `EntityStateAttribute` — attribute definitions

The existence of an attribute is itself just another entity, managed and
validated by `GitDataStore` like everything else.

```
EntityStateAttribute {
  id:            UUID (PK)
  dataType:      enum[boolean, number, string]   // IMMUTABLE once set
  applicability: List<EntityType>                // which entity types this may attach to
  name:          String
  description:   String
  plotPointId:   UUID (FK -> PlotPoint)           // the plot point that motivates this attribute's existence
}
```

**`dataType` is immutable.** Object and list types are deliberately excluded
— authors are not expected to design custom structured state that has to
survive automatic mutation both in-engine and through Git merges; booleans,
numbers, and strings cover the meaningful cases without that complexity.

Because `dataType` can never change, **an attribute is never "edited" to a
new type** — if an author needs a differently-typed version of a concept,
that's a new `EntityStateAttribute`, not a mutation of an existing one.

> **Open:** whether a retired/superseded attribute needs an explicit
> active/deprecated status field, so historical deltas referencing it don't
> dangle against a definition treated as gone. Not yet decided.

`plotPointId` records *provenance* — the plot point that motivated this
attribute coming into existence — not a scoping constraint limiting where
the attribute is relevant.

---

## 3. `EntityStateAttributeValue` — live in-memory current state

Maintained during the evolution of the narrative in Scene Director mode:
the current value of a given attribute, for a given entity, right now.

```
EntityStateAttributeValue {
  entityId:     UUID (FK -> Entity owning this value)
  attributeId:  UUID (FK -> EntityStateAttribute)
  dataType:     enum[boolean, number, string]     // must match attributeId's definition
  booleanValue: boolean
  numericValue: number
  stringValue:  string
}
```

Exactly one of `booleanValue` / `numericValue` / `stringValue` is
meaningful, determined by `dataType`. Validation must reject any value
where a non-matching field is populated, or where none is populated for the
declared type. `dataType` here is a required, denormalized copy of the
attribute definition's type (needed at the persistence layer prior to
linking/marshalling) and must always match the referenced
`EntityStateAttribute.dataType` — a mismatch is a validation error, not a
silently-tolerated state.

---

## 4. `EntityStateAttributeValueDelta` — state change over time

Records a single attribute's change for a single entity, at a specific
point in the narrative's evolution. This is what lets Scene Director move
state forward and backward through time (e.g. `[From the <Event>]` rolling
back to reject prose and reset state to the right point before re-running
`[Action]`), and is what chronology validation reads to determine state at
any point.

```
EntityStateAttributeValueDelta {
  entityId:    UUID (FK -> Entity)
  attributeId: UUID (FK -> EntityStateAttribute)
  dataType:    enum[boolean, number, string]      // must match attributeId's definition
  old: {
    booleanValue: boolean
    numericValue: number
    stringValue:  string
  } | null                                        // null = this is the attribute's initial state
  new: {
    booleanValue: boolean
    numericValue: number
    stringValue:  string
  }
}
```

**No ordering field.** Order is carried entirely by the containing
structure, not by the delta itself:

- Within an in-flight **Scene**, deltas are grouped by **SceneEvent**, and
  SceneEvents are inherently sequential — at most one delta per
  Entity/Attribute pair per SceneEvent.
- Once a Scene completes, its SceneEvent-level deltas are aggregated into
  **one delta per Entity/Attribute pair for the whole Scene** — the net
  change the scene achieved. This aggregate is **derived, not a
  separately-maintained fact**: because the Chronology allows Scene order
  to change, a scene-level delta has no fixed meaning to persist ahead of
  time — it must be computed (or recomputed) by replaying that Scene's
  SceneEvent deltas whenever it's needed, and re-derived if the Scene's
  content or position changes.
- **Initial state** (an entity's starting value for an attribute, set when
  the entity is defined) is recorded as a delta with `old: null` — not as a
  separate schema. Every consumer of deltas (replay logic, chronology
  validation) must treat `old: null` as an expected, first-class case, not
  a special exception to work around.

**Scoping exception — SceneEvent deltas may also live alongside prose.**
See §5. Once a Scene is complete, its SceneEvent-level deltas are not
retained in the JSON metadata store — the completed Scene's aggregate delta
is the only persisted record there. The exception is that SceneEvent deltas
may additionally be persisted alongside a specific take's prose (see §5),
outside `GitDataStore` entirely.

---

## 5. Prose — write-once, outside the data store

A Scene may have several generated takes of prose over time. The tool never
edits an already-generated ("exported") prose file — new prose is always
generated fresh and stored, grouped by Scene ID.

- Stored as flat text files with a YAML header, living in the Git
  repository but **outside** `GitDataStore`'s JSON metadata layer entirely.
- Because prose is write-once and never edited after generation, it is
  **never a merge-conflict target** — there is nothing to reconcile between
  branches, since nothing edits an existing prose file in place.
- A Scene links to its latest prose by reference (Scene ID + commit
  reference). When reading prose, if the linked Scene is still at the
  linked commit, that's a "green tick" — a cheap way to confirm the
  displayed prose is still consistent with current project state, without
  needing conflict-resolution machinery at all.
- Managed by per-user storage limits, with auto-archiving/pruning and
  labelling.

> **Open:** the full YAML header shape (beyond Scene ID + commit ref —
> presumably a take/label identifier and generation timestamp at minimum),
> and the specifics of the storage/archiving/pruning policy. Not yet
> defined.

---

## 6. Conditional context-inclusion rules

A recurring pattern: whether a piece of narrative context should be fed to
the LLM is often **conditional on an `EntityStateAttribute`'s current
value**, rather than being a fixed property of an entity or lore item.

Example: a `WorldLoreItem` about priestly customs, or a `Character`'s
description as "a priest," should only be included in generation context
when that character's `isOrdained` attribute is currently `true`. This is
not a validation rule (nothing is rejected) — it's author-authored
context-filtering logic. An author is free to set up contradictory or
unusual conditions (e.g. as a deliberate narrative device); the app applies
whatever is configured without judgment, consistent with the same "warn,
don't block" philosophy used elsewhere (chronology, proactive interception).

This needs its own named schema concept — a condition object (attribute
reference + comparison operator + expected value), attachable to:
- `WorldLoreItem.scope` (who currently has access to this lore)
- Conditional facts/descriptions on `Character` and other entities

> **Open:** the condition object's concrete schema has not yet been
> defined — this section names the concept and its two known attachment
> points, not the final shape.

---

## 7. What's still open (not covered by this document)

- Full schemas for `Character`, `Scene`, `SceneEvent`, `WorldLoreItem`,
  `PlotPoint` (known so far: `PlotPoint` is a self-referential hierarchy —
  a PlotPoint may contain other PlotPoints — and may reference many
  `EntityStateAttribute`s; `WorldLoreItem` likely needs a `scope` concept
  tied to the conditional-inclusion mechanism in §6).
- The condition object schema (§6).
- Attribute deprecation/lifecycle status (§2).
- Prose YAML header shape and storage/archiving policy (§5).
-
