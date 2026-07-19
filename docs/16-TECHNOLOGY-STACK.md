# Technology Stack and Engineering Guidelines

## Purpose

Turn the system architecture into an implementation-ready stack. This document selects defaults for the first release, explains their boundaries, and identifies technologies that require later evidence before adoption.

## Decision summary

Financial Intelligence is a statically deployed, client-only Progressive Web Application built as a TypeScript modular monolith. React renders the interface, Vite builds the application and workers, IndexedDB stores canonical local data through Dexie, and deterministic domain/application packages remain independent of browser frameworks.

The application has no required backend. Optional remote AI providers are adapters and may not become a source of truth.

## Selected stack

| Concern | Selection | Guidance |
| --- | --- | --- |
| Language | TypeScript in strict mode | Avoid untyped boundary data; validate before narrowing |
| Workspace | pnpm workspaces | Keep packages independently testable; do not add a task orchestrator until build times justify it |
| UI | React stable | Client-rendered application; no React Server Components |
| Build | Vite | Static build, module workers, code splitting, development server |
| Routing | React Router | Client routes; route loaders must not imply a server dependency |
| PWA | vite-plugin-pwa with Workbox `injectManifest` | Cache only versioned application assets and explicit model downloads |
| Persistence | Dexie over IndexedDB | Use behind repository ports; never call it from domain code |
| Portable validation | Ajv 2020 plus ajv-formats | The files in `/schemas` are the external contract source of truth |
| Portable TypeScript types | json-schema-to-typescript | Generate from all root schemas; CI rejects stale artifacts |
| Accessible UI | React Aria Components | Use unstyled accessible behavior with project-owned design tokens |
| Styling | CSS Modules/custom properties or colocated plain CSS | No runtime CSS-in-JS; support forced colors, reduced motion, and content-driven breakpoints |
| Data grid | TanStack Table plus TanStack Virtual | Semantic markup, controlled state, bounded DOM rendering |
| Visualization | Visx/D3 primitives and d3-sankey | Every chart needs a text summary, table, and drill-down query |
| Money | Project Money value object backed by decimal.js | Portable amounts remain decimal strings; JavaScript `number` is not authoritative money |
| Dates | Temporal adapter with polyfill where required | Store date-only facts and UTC timestamps distinctly |
| Unit/integration tests | Vitest, Testing Library, fake-indexeddb, fast-check | Prefer domain properties and contract tests over snapshot volume |
| Browser tests | Playwright and axe-core | Cover critical flows, offline behavior, workers, migrations, and accessibility |
| CI | GitHub Actions | Format, lint, typecheck, unit/contract tests, build, schema checks, browser smoke tests |
| Hosting | Static HTTPS host with configurable security headers | No functions required; deployment must support CSP, Permissions-Policy, and immutable assets |

Versions are pinned through the lockfile. Upgrades use the latest stable release compatible with the published browser and Node support matrices; experimental/canary packages require an ADR or isolated evaluation.

## Repository layout

```text
apps/
  web/                    React/Vite PWA and composition root
packages/
  domain/                 Entities, value objects, invariants, policies
  application/            Commands, queries, use cases, and ports
  storage-indexeddb/      Dexie repositories and database migrations
  import-core/            Parser and normalization contracts
  import-csv/             CSV adapter (Phase 1)
  import-ofx/             OFX/QFX adapter (Phase 3)
  import-pdf/             Explicit PDF layout adapters (Phase 3)
  analysis/               Deterministic aggregates and query plans
  ai-core/                Task/provider contracts and safety gates (Phase 4)
  ai-webllm/              Optional local generative adapter (Phase 4)
  schemas/                Runtime validators for root JSON Schemas
  ui/                     Shared product components after patterns stabilize
  test-fixtures/          Synthetic builders and maintained format fixtures
schemas/                  Canonical portable JSON Schemas
examples/                 Human-readable synthetic examples
```

Do not create packages before a vertical slice needs them. The initial structure includes only the web composition root and foundational domain, application, storage, import-contract, and schema packages.

## Dependency rules

```text
apps/web
  -> application
  -> storage-indexeddb (composition only)

storage-indexeddb -> application ports + domain types
application       -> domain
import adapters   -> import-core + domain value objects
domain            -> no UI, browser, storage, network, or AI dependency
```

- Domain packages must be deterministic and usable in a Node test without DOM shims.
- Application use cases coordinate domain behavior through ports.
- Infrastructure packages implement ports and own migrations, browser APIs, provider protocols, and parser libraries.
- React components submit commands and render queries; they do not calculate financial totals or open database transactions.
- Cross-package imports use public package exports, never another package's private source path.
- Circular dependencies fail CI.

## State and persistence

IndexedDB is the source of truth for the local workspace. React state is limited to transient presentation state. Do not duplicate the ledger in Redux, Zustand, or a query cache.

Dexie is isolated in `storage-indexeddb`. Repository methods return domain/application DTOs, not Dexie collections. Atomic imports and migrations use explicit transactions. Derived projections carry a source revision and remain rebuildable.

Use Cache Storage only for immutable application assets and explicitly downloaded model assets. Source-document retention is opt-in. Provider keys are memory-only by default and never enter ordinary IndexedDB tables, exports, logs, service-worker caches, or URLs.

## Workers and long-running operations

Use standards-based module workers created with `new Worker(new URL(..., import.meta.url), { type: "module" })`. Parsing, hashing, encryption, projection rebuilds, and local inference run outside the main thread.

Worker protocols are versioned discriminated unions with operation ID, progress, cancellation, result, and normalized error messages. A worker does not write canonical storage directly; it returns a staged result to an application use case that performs the validated commit.

## Import implementation

- CSV: stream through a maintained parser in a dedicated worker; preserve row provenance.
- OFX/QFX: bounded SGML normalization followed by a streaming XML parser.
- PDF: PDF.js text extraction only for explicitly supported layout adapters.
- Every parser implements `StatementParser` from `import-core`.
- Boundary data is `unknown` until validated.
- Parser output contains source rows/issues, not canonical database records.
- Never execute formulas, document scripts, embedded URLs, macros, or model instructions found in source text.

## Domain conventions

- Use opaque UUID strings for identifiers and `crypto.randomUUID()` at the application boundary.
- Represent authoritative monetary values with `Money`, decimal strings, and explicit currency.
- Store posted dates as ISO date-only strings and event timestamps as RFC 3339 UTC.
- Never aggregate different currencies without a named exchange-rate source and date.
- Model imported facts, inferences, and user-confirmed decisions separately.
- Keep normalizers, rules, classifiers, schemas, and migrations explicitly versioned.
- Parse generated UUIDs with the entity-specific domain parser before constructing domain objects.
- Use branded `DateOnly` and `UtcTimestamp` strings for domain boundaries. Date-only values never
  pass through `Date`; UTC timestamps must use canonical uppercase `Z` notation.
- Treat `/schemas` as the only hand-maintained portable contract. Run `pnpm schema:generate` after a
  schema change and `pnpm schema:check` in local verification and CI.

## UI and accessibility

Use React Aria Components for interactive primitives. Project CSS owns visual design through tokens for color, typography, spacing, focus, motion, elevation, and chart semantics.

Core interface requirements:

- semantic landmarks, headings, tables, forms, and native text rendering;
- visible keyboard focus and no pointer-only action;
- 320 CSS pixel reflow and 200% zoom;
- forced-colors and reduced-motion support;
- non-color cues for inflow/outflow, confidence, and status;
- accessible chart summaries and data tables;
- progress announcements and cancel controls for long work;
- no raw HTML rendering for imported, model, or plugin content.

Build the transaction table with controlled TanStack row models and add virtualization only after the non-virtualized semantic behavior is tested. Virtualization must not make selected rows, focus, or screen-reader context unreliable.

## AI implementation

AI is not part of the first vertical slice. Phase 4 adds the task-based `AiProvider` interface only after deterministic imports, rules, review, and dashboards are complete.

- WebLLM is the leading candidate for browser-local structured generative tasks.
- Transformers.js may be evaluated for smaller classifier/embedding tasks.
- Remote providers use task-specific fetch adapters; a general chat SDK does not enter the domain.
- Every output passes strict JSON Schema and allowed-ID validation.
- The local query engine calculates every financial number.
- There is no silent local-to-remote fallback.
- Model assets are user-initiated, integrity pinned, removable, and separately cached.

Model/runtime selection requires task quality, calibration, invalid-output, latency, memory, license, and browser-support evidence.

## Security guidelines

- Deploy a restrictive CSP without unsafe evaluation or remote third-party scripts.
- Keep analytics, tag managers, remote fonts, and automatic diagnostics out of the default build.
- Use Web Crypto authenticated encryption for backup payloads; select the memory-hard passphrase KDF through a reviewed ADR.
- Use text nodes for all untrusted strings.
- Bound file bytes, rows, columns, cells, parser time, worker memory/output, provenance, and issue counts.
- Redact descriptions, exact amounts/dates, account labels, filenames, URLs, keys, and payloads from logs.
- Treat dependencies, PWA updates, model artifacts, and future plugins as supply-chain surfaces.

## Testing pyramid

1. Domain unit/property tests: money, dates, rules, transfer matching, deduplication, aggregates.
2. Contract tests: repositories, parsers, providers, schemas, workers.
3. IndexedDB integration: atomic writes, migrations, interruption, quota, multi-tab behavior.
4. Component tests: accessible roles, keyboard behavior, validation, empty/error/progress states.
5. Browser journeys: first import, overlapping import, review, drill-down, offline reload, backup/restore.
6. Manual accessibility/security/performance review at release gates.

Tests use only synthetic or irreversibly sanitized fixtures. No real statement, identifier, secret, or provider transcript may be committed.

## Initial delivery sequence

1. Establish workspace tooling and dependency rules.
2. Prove a vertical slice: create and reload a local workspace through an application port and IndexedDB adapter.
3. Add schema compilation/validation and synthetic contract tests.
4. Add the import worker protocol and CSV mapping flow.
5. Add canonical transaction commit, provenance, and duplicate review.
6. Add deterministic rules and dashboards.
7. Add optional AI only after the no-AI product meets its acceptance criteria.

## Technologies deliberately deferred

- Next.js, SSR, React Server Components, or a mandatory Node server.
- Firebase, Supabase, or another remote ledger source of truth.
- Redux or a mirrored global transaction store.
- Electron/native packaging before browser validation.
- SQLite/DuckDB WASM before performance evidence.
- Plugin execution before the permission/sandbox threat model is implemented.
- Cloud sync, bank connections, payments, and AI-generated authoritative financial values.

## Related documents

- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [AI architecture](08-AI-ARCHITECTURE.md)
- [Non-functional requirements](06-NON-FUNCTIONAL-REQUIREMENTS.md)
- [ADR-004](adr/ADR-004-Technology-Stack.md)
