---
created: 2026-07-12T10:25:26+01:00
modified: 2026-07-12T10:26:07+01:00
---

# Shared Schemas Between GitDataStore and Fastify

# Note: Shared Schema Source for GitDataStore Entity Validation & API Contracts

**Origin:** Observation surfaced while drafting `docs/specs/tech-stack.md`
(§3, Fastify JSON validation rationale). Extracted here as its own note so it
can feed directly into the GitDataStore interface design task, rather than
staying buried in an unrelated document.

**Status:** Observation / design input, not a decision. The GitDataStore
design task should evaluate and either adopt, adapt, or explicitly reject
this — it isn't being imposed as settled here.

---

## 1. The observation

Two schema-validation needs currently exist side by side in the design, and
nothing today ties them together:

1. **Entity validation** — project data (characters, lore, plot, scenes) is
   stored as JSON validated against fixed JSON Schemas, owned by MagpieEngine
   (ADR-017 three-schema narrative state model, ADR-018 prose-as-flat-files,
   `entity-state-schema.md`). This is what GitDataStore's `read`/`write`/
   `commit` operations ultimately guard the shape of.
2. **API request/response contracts** — Fastify (chosen for both Local
   Desktop and Enterprise Cloud backends) validates routes against JSON
   Schema definitions, compiled ahead of request time for low-overhead
   validation.

Both are JSON Schema. Where an API endpoint's request/response body *is* an
entity (or a well-defined slice of one — e.g. a PATCH delta against a
character), the schema shape is describing the same data twice: once as the
entity's canonical schema, once as that endpoint's route schema. Maintained
independently, these two definitions can drift as `entity-state-schema.md`
evolves — a change to an `EntityStateAttribute`'s shape doesn't automatically
propagate to the Fastify routes that accept or return it.

## 2. Why this matters specifically for GitDataStore's design

GitDataStore is the component that owns the read/write contract for entity
data (HLD §5 — the `FileStore` interface: `read`, `write`, `list`, `commit`,
`revert`). Whatever validates writes *into* GitDataStore and whatever
validates the API layer *around* it are natural candidates to share a single
schema source, if the interface is designed with that in mind from the start:

- **PATCH-based writes (Data Entry mode, HLD §6.1):** writes are validated
  against a checksum of the state being edited, and arrive as entity-scoped
  PATCH deltas. If the PATCH shape is derived from the same schema as the
  entity itself, the API route accepting that PATCH and GitDataStore's
  internal validation of it can both check against one definition rather than
  two independently-maintained ones.
- **Structural PII lint (ADR-022):** runs as a lint pass at Data Entry
  save/publish time, over structured fields (email, phone, DOB, URL). If
  those fields are identifiable from the shared schema (e.g. a
  format/pattern annotation), the lint pass and the API-layer validation can
  both key off the same schema metadata instead of the lint maintaining its
  own separate field list.
- **Checksum-validated concurrency (ADR-008):** the checksum that gates a
  PATCH write is computed over *some* canonical representation of the
  entity's current state. Whatever that representation's shape is should be
  the same shape the schema describes — worth confirming explicitly in the
  GitDataStore design rather than letting the checksum's serialization
  format silently diverge from the schema's field set.

## 3. What this would look like in practice (sketch, not a spec)

- A single schema source per entity type (character, lore item, plot point,
  scene, etc.), authored once — likely still owned by MagpieEngine per HLD
  §11.7, since MagpieEngine already owns the entity-state schema and the
  further `Character`/`Scene`/`SceneEvent`/`WorldLoreItem`/`PlotPoint` schema
  work.
- GitDataStore's write-path validation and the Fastify route schemas for
  endpoints that accept/return those entities both **derive from** that one
  source — either by direct reference (Fastify supports `$ref`-based schema
  composition) or by a generation step (route schema built from the entity
  schema at build time), rather than being hand-authored twice.
- Where an API contract is *not* a 1:1 entity shape (e.g. a paginated list
  wrapper, or a computed/derived view), that wrapper schema composes the
  entity schema rather than re-declaring the entity's fields inline.

## 4. Open questions for the GitDataStore design task itself

These are genuinely for that task to resolve, not pre-answered here:

- Does GitDataStore's interface operate on raw JSON validated against
  MagpieEngine-owned schemas, or does it own a validation layer of its own
  that would need to *consume* those schemas as a dependency? (HLD's
  component dependency table lists MagpieEngine's dependency on
  FileStore/GitDataStore for entity/lore reads — the reverse direction,
  GitDataStore depending on MagpieEngine's schemas for validation, isn't
  currently stated either way and should be made explicit.)
- Where does schema composition/generation actually happen — a build step
  in `packages/gitdatastore`, a shared `packages/schemas` (or similar)
  package both GitDataStore and the Fastify route layer import from, or
  something else? A shared package avoids a circular dependency between
  GitDataStore and the API layer if both need the same definitions.
  What's below is illustrative, not prescriptive:

  ```
  packages/
  ├── gitdatastore/   # imports schema definitions, doesn't own them
  ├── schema/         # (illustrative) single source, owned by MagpieEngine
  └── infra/
  ```
- Does this extend to `MockDataStore` (HLD §5) as well, so CI-time
  validation exercises the same schema source as production — worth
  confirming so the test double doesn't quietly validate against a
  different or looser shape than the real implementation.
- PATCH-delta shapes (partial entity updates) aren't simply "the entity
  schema, all fields optional" in every case — some fields may be
  immutable post-creation (the glossary notes `EntityStateAttribute.dataType`
  is immutable, for instance). The GitDataStore design should decide whether
  PATCH schemas are derived automatically from the entity schema with
  immutable fields stripped, or authored as a deliberate second artifact per
  entity type reflecting which fields are actually PATCH-able.

## 5. Non-goals of this note

This note is not proposing a specific tool, code-generation pipeline, or
package layout — those are implementation decisions for the GitDataStore (and
possibly a new shared-schema) design doc to make. It's recording the
observation and its concrete implications so the GitDataStore design doesn't
have to rediscover them independently, and so "one schema source" is at least
considered and consciously accepted or rejected, rather than defaulting to
two parallel definitions by omission.
