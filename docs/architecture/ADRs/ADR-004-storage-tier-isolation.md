# ADR-004 — Storage Tier Isolation (Approved)

**Decision:** Isolate all storage and persistence operations behind the
**FileStore abstraction interface** in `/packages/filestore`. All other layers
(UI, agent pipelines, linting) interact solely through this contract.

**Key rationale:**
- Decoupling the UI from filesystem mechanics future-proofs the platform;
  swapping the storage backend (e.g. from Git to S3 + database) requires no
  changes to frontend code.
- `InMemoryMockFileStore` eliminates physical disk I/O in tests, enabling
  thousands of read/write/revert cycles in milliseconds.
- The abstraction normalises environmental path variations (Windows local paths
  vs. ephemeral Linux container paths).

**Consequence to note:** requires CI linter rules to strictly block any rogue
direct filesystem reads or writes outside the interface contract.
