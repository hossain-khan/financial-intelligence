# ADR-002: IndexedDB as Primary Browser Persistence

- Status: Accepted
- Date: 2026-07-19
- Decision owners: Project maintainers

## Context

The application needs transactional local persistence for tens to hundreds of thousands of structured records, indexes, migrations, and blobs/metadata. `localStorage` is synchronous, small, string-only, and lacks transactions. An in-browser SQL/WASM database may improve analytical queries but adds binary/runtime, persistence, migration, and cross-browser complexity.

## Decision

Use IndexedDB as the authoritative browser persistence mechanism for canonical application records and operational metadata. Access it only through repository and unit-of-work ports; domain code cannot depend on IndexedDB APIs or a particular wrapper library.

Use Cache Storage or other appropriate browser storage for immutable application/model assets, referenced by integrity metadata. Source document bytes are optional and stored separately from canonical rows. Derived analytical projections are rebuildable.

## Consequences

### Positive

- Broad browser support, asynchronous operation, indexes, and atomic transactions.
- Structured-clone values and blobs avoid manual string serialization for internal state.
- No server or native packaging required.
- Repository boundary permits future alternative adapters.

### Negative

- Query/aggregation ergonomics are weaker than SQL.
- Transaction lifetime and browser implementation behavior require care.
- Storage quota and eviction vary by browser/device.
- Schema migrations need an explicit tested harness.

### Required mitigations

- Keep transactions short and perform parsing/inference before commit.
- Maintain revisioned, rebuildable projections for common analytics.
- Surface quota/persistence status and backups.
- Test migrations, interruption, multi-tab coordination, and low-quota behavior.
- Keep the contiguous database-version registry in `packages/storage-indexeddb/src/migrations.ts`.
- Use native version-change transactions for bounded canonical migrations and explicit journals for
  resumable multi-transaction work; a database reset is never a migration strategy.
- Close coordinated stale connections on `versionchange` and surface blocked or incompatible opens
  as actionable application errors.
- Benchmark before adding a WASM query engine; it would remain derived, not authoritative, unless a superseding ADR says otherwise.

## Alternatives considered

- **localStorage:** rejected for size, synchronization, data types, and transaction limitations.
- **Origin Private File System only:** useful for file/database engines but not a universal structured-record abstraction; may be an adapter optimization later.
- **SQLite/DuckDB in WASM as source of truth:** attractive querying but higher delivery and persistence complexity; deferred until evidence shows IndexedDB projections are insufficient.
- **Remote database:** conflicts with ADR-001.

## Validation

- Repository contract tests across supported browsers.
- Atomic import and interrupted migration tests.
- Typical/large workload benchmarks for list, filter, and dashboard queries.
- Quota exhaustion leaves the prior committed revision valid.

## Related decisions

- [ADR-001](ADR-001-Offline-First.md)
