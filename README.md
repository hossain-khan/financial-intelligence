# Financial Intelligence

> Privacy-first, offline-first personal finance analysis that turns bank statements into understandable, portable insights.

Financial Intelligence is an open-source web application for people who want to understand their cash flow without connecting a bank account or surrendering financial data to a mandatory cloud service. Users import statements, review normalized transactions, correct classifications, and explore dashboards. The application remembers those corrections in a portable **Financial Brain** owned by the user.

## Product promise

- Raw financial data stays on the device by default.
- Useful analysis works without an account, bank connection, or network connection.
- Deterministic rules handle known transactions before optional AI is used.
- Every automated classification includes confidence and an explanation.
- Transactions, learned knowledge, and settings can be exported in documented formats.
- Local AI is the default AI mode; bring-your-own-key and self-hosted modes are explicit opt-ins.

## Initial capabilities

1. Import CSV, OFX, and QFX statements; support text-based PDF statements when a compatible parser is available.
2. Preview, map, normalize, validate, and deduplicate transactions before committing an import.
3. Categorize transactions using user rules, merchant memory, heuristics, and optional AI.
4. Correct results in bulk and convert confirmed corrections into reusable rules.
5. Explore cash flow, category, merchant, recurring-payment, savings, and trend views.
6. Export or restore an encrypted application backup and a versioned, human-readable Financial Brain.

## AI modes

| Mode | Data destination | Network required | Intended user |
| --- | --- | --- | --- |
| Local browser | Nowhere outside the device | No, after model installation | Default |
| Self-hosted endpoint | User-configured endpoint | Usually local network | Power users |
| Bring your own API key | Selected provider | Yes | Users accepting provider terms |
| No AI | No model | No | Rules-only users |

Remote modes must show what data will be sent and require confirmation before the first request. API keys are stored only when the user explicitly chooses to persist them.

## Repository map

```text
docs/       Product, architecture, privacy, UX, and roadmap specifications
schemas/    Versioned JSON Schemas for portable data contracts
examples/   Synthetic fixtures that conform to the schemas
packages/   Future application and library workspaces
```

Start with:

- [Vision](docs/00-VISION.md)
- [Design principles](docs/01-DESIGN-PRINCIPLES.md)
- [Product requirements](docs/03-PRODUCT-REQUIREMENTS.md)
- [System architecture](docs/07-SYSTEM-ARCHITECTURE.md)
- [Security and privacy](docs/12-SECURITY-AND-PRIVACY.md)
- [Roadmap](docs/15-ROADMAP.md)
- [Technology stack](docs/16-TECHNOLOGY-STACK.md)
- [Quality baseline and browser support](docs/17-QUALITY-BASELINE.md)
- [Cash-flow summaries and filtered CSV export](docs/18-CASH-FLOW-AND-FILTERED-EXPORT.md)
- [Phase 2 implementation and hardening](docs/20-PHASE-2-IMPLEMENTATION.md)

## Project status

**Phase 2 complete; Phase 3 is next.** The offline PWA supports local CSV import, canonical ledger
review, deterministic merchant/category learning, stale-safe Financial Brain apply/undo,
recoverable transfer and recurring decisions, and revision-consistent financial dashboards with
shared filters, accessible charts, exact drilldown, and design-system-consistent responsive
presentation.

## Local development

Requirements: Node.js 24 and pnpm 10.

```bash
pnpm install
pnpm dev
```

The development server prints the local URL. The initial screen can create a named workspace stored only in the current browser origin.

Run the complete local quality gate:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security:headers:check -- apps/web/dist/_headers
pnpm browser:test:chromium
```

See the [quality baseline](docs/17-QUALITY-BASELINE.md) for supported browsers, Playwright setup,
manual accessibility checks, and dependency-review expectations.
Visible product work must follow the [design system](docs/21-DESIGN-SYSTEM.md) and
[UX guidelines](docs/13-UX-GUIDELINES.md) so new surfaces reuse the established visual language,
responsive patterns, and accessible interaction contracts.

Workspace packages follow the dependency direction documented in the [technology stack](docs/16-TECHNOLOGY-STACK.md). New functionality should begin as a thin vertical slice through domain, application, adapter, and UI boundaries.

## Cloudflare Workers deployment

The reference production deployment uses Cloudflare Workers Static Assets. It serves the generated
PWA without a Worker entrypoint, application backend, remote database, telemetry, or access to local
financial records. Wrangler usage metrics, dependency instrumentation, and Worker observability are
disabled in the repository configuration.

Validate the deployable bundle locally:

```bash
pnpm cloudflare:check
```

Run the Cloudflare-hosted preview or deploy from an authenticated development environment:

```bash
pnpm cloudflare:preview
pnpm cloudflare:deploy
```

For Git-connected Workers Builds, import this repository with the repository root as the build root,
use `main` as the production branch, set the build command to `pnpm build`, and set the deploy command
to `pnpm exec wrangler deploy`. Use `pnpm exec wrangler versions upload` for non-production branches.
Set `NODE_VERSION=24` and `PNPM_VERSION=10.33.0` in the Cloudflare build variables so deployment uses
the same supported toolchain as CI. The Cloudflare Worker name must match `financial-intelligence` in
[`wrangler.jsonc`](wrangler.jsonc).

See [ADR-009](docs/adr/ADR-009-Cloudflare-Workers-Static-Hosting.md) for the privacy boundary,
alternatives, and production verification requirements.

## Development principles

- Treat imported content as untrusted data.
- Preserve provenance from every normalized value back to its source import.
- Prefer deterministic, testable behavior over model calls.
- Keep domain logic independent of React, browser storage, and any AI provider.
- Do not introduce network access into the default analysis path.
- Meet WCAG 2.2 AA for supported workflows.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.
AI coding agents must also follow the repository-wide [`AGENTS.md`](AGENTS.md) operating contract;
it requires issue-aligned work, documentation and ADR maintenance, complete verification, and a pull
request for every change.

## License

Licensed under the [MIT License](LICENSE).
