# ADR-004: TypeScript React PWA Technology Stack

- Status: Accepted
- Date: 2026-07-19
- Decision owners: Project maintainers

## Context

The project needs an implementation stack for a client-only, offline-first application with large local structured datasets, workers, portable JSON contracts, accessible data-heavy UI, optional browser AI, and no required server. The stack must preserve the domain/application boundaries in the system architecture and remain approachable to contributors and coding agents.

## Decision

Build a statically deployed Progressive Web Application using:

- TypeScript strict mode and pnpm workspaces;
- React for presentation and Vite for static builds and module workers;
- Workbox through vite-plugin-pwa for an explicitly controlled service worker;
- IndexedDB as the authoritative local store, accessed through Dexie repository adapters;
- Ajv 2020 for portable JSON Schema validation;
- React Aria Components and project-owned CSS tokens for accessible UI;
- TanStack Table/Virtual for the transaction grid when needed;
- Visx/D3 primitives for visualizations with mandatory accessible equivalents;
- Vitest, Testing Library, fake-indexeddb, fast-check, Playwright, and axe-core for verification.

Use decimal-backed domain value objects for money. AI remains an optional provider boundary; WebLLM and Transformers.js are candidates for later local adapters, not core dependencies.

## Consequences

### Positive

- Static hosting and offline execution align with ADR-001.
- TypeScript contracts can span domain, workers, schemas, and UI.
- IndexedDB and workers are native browser capabilities behind replaceable adapters.
- Accessible unstyled primitives allow a distinct product design without rebuilding complex interaction behavior.
- The deterministic product remains independent of AI and remote services.

### Negative

- Browser storage, service-worker updates, and multi-tab coordination need dedicated testing.
- IndexedDB is less convenient for analytics than SQL and requires projections.
- React ecosystem choices can create overlap; state ownership and package boundaries must be enforced.
- Local model support remains fragmented and resource intensive.

### Required mitigations

- Treat Dexie as infrastructure rather than exposing it in domain/UI code.
- Keep the ledger out of a second global state store.
- Use explicit worker protocols and application-controlled atomic commits.
- Benchmark projections before considering a WASM query database.
- Pin stable versions in the lockfile and review dependency/model provenance.
- Maintain a complete rules-only/no-AI test suite.

## Alternatives considered

- **Next.js or another server-oriented meta-framework:** rejected because SSR/server actions add a deployment/runtime surface not required by the product.
- **Svelte/Vue:** capable alternatives, but React offers the selected accessible component, data-grid, and contributor ecosystem and already appears in the documented technology goals.
- **Raw IndexedDB:** rejected due to migration, transaction, and query ergonomics; Dexie remains behind a port.
- **SQLite/DuckDB WASM as source of truth:** deferred until large-workload evidence shows IndexedDB projections are insufficient.
- **Cloud database as canonical storage:** rejected by offline/privacy requirements.

## Validation

- Initial vertical slice creates and reloads a workspace through domain, application, and IndexedDB boundaries.
- Production build is a static artifact and works after installation with the network disabled.
- CI enforces format, lint, typecheck, tests, schema/example validation, and build.
- Architecture tests or lint rules prevent inward layers importing browser/presentation packages.

## Related decisions

- [ADR-001](ADR-001-Offline-First.md)
- [ADR-002](ADR-002-Why-IndexedDB.md)
- [ADR-003](ADR-003-Why-WebGPU.md)
- [Technology stack](../16-TECHNOLOGY-STACK.md)
