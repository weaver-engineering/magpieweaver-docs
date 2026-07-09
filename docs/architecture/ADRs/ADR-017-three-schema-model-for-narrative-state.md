# ADR-017 — Three-Schema Model for Narrative State (Approved)

**Decision:** Model all narrative state that changes over time using three
related schemas: `EntityStateAttribute` (author-defined, immutable-dataType
attribute definitions, restricted to boolean/number/string), plus a
denormalized `dataType` field required on both `EntityStateAttributeValue`
(live current value) and `EntityStateAttributeValueDelta` (old→new change
record, `old: null` representing initial state). Base entity definitions
(characters, world lore, plot-central objects) remain immutable through
scene direction; any change over time is represented exclusively through
these attributes, never through edits to an entity's own fields.

**Key rationale:**
- No default/built-in attributes keeps the model fully author-driven and
  avoids assuming a fixed narrative ontology that won't fit every project.
- Restricting to boolean/number/string (no object or list types) avoids
  requiring authors — who are not data engineers — to design custom
  structured state that must survive automatic in-engine mutation and Git
  merge without corruption.
- Separating "definition" from "current value" from "change record" mirrors
  how the state is actually consumed: definitions are static and rarely
  read outside setup, current values are read constantly during direction,
  and deltas are what both scene time-travel (`[From the <Event>]`) and
  chronology validation actually operate on.
- Making `dataType` immutable on the definition, and denormalizing it as a
  required field on values/deltas (validated to match), removes an entire
  class of drift bugs where a value's type-tagged fields could silently
  fall out of sync with its definition.
- Deltas deliberately carry no ordering field — order is already fully
  determined by the containing structure (SceneEvent sequence within an
  in-flight scene; nothing meaningful within a completed Scene's aggregate,
  since Chronology allows Scene reordering) — avoiding a redundant, and
  potentially misleading, sequence field.

**Consequence to note:** a Scene's aggregate delta (net change achieved by
the whole scene) must be treated as derived, not cached-and-forgotten —
because Chronology allows Scene reordering, the aggregate has to be
recomputed by replaying SceneEvent deltas whenever needed rather than
trusted as a fixed fact. Attribute deprecation/lifecycle (what happens to
historical deltas referencing a retired attribute) is not yet resolved (see
HLD §12.7).