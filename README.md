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

## Project status

**Initial implementation.** The repository contains the product specification and the first executable vertical slice: a React/Vite PWA that creates and reloads a private workspace through application ports backed by IndexedDB. Statement import and financial analysis follow the phased roadmap.

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
```

Workspace packages follow the dependency direction documented in the [technology stack](docs/16-TECHNOLOGY-STACK.md). New functionality should begin as a thin vertical slice through domain, application, adapter, and UI boundaries.

## Development principles

- Treat imported content as untrusted data.
- Preserve provenance from every normalized value back to its source import.
- Prefer deterministic, testable behavior over model calls.
- Keep domain logic independent of React, browser storage, and any AI provider.
- Do not introduce network access into the default analysis path.
- Meet WCAG 2.2 AA for supported workflows.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.

## License

Licensed under the [MIT License](LICENSE).
