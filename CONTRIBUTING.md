# Contributing

Thank you for helping build Financial Intelligence. The project handles unusually sensitive data, so correctness, privacy, and transparent behavior take precedence over feature speed.

## Before contributing

1. Read the [vision](docs/00-VISION.md), [design principles](docs/01-DESIGN-PRINCIPLES.md), and [glossary](docs/02-GLOSSARY.md).
2. Check the [product requirements](docs/03-PRODUCT-REQUIREMENTS.md) and [roadmap](docs/15-ROADMAP.md) for scope.
3. Open an issue before a large change or any change to public schemas, persistence, security boundaries, AI data disclosure, or plugin permissions.
4. Record decisions with long-lived architectural consequences as an ADR using the conventions in `docs/adr/`.

## Engineering expectations

- Use TypeScript with strict type checking for application code.
- Keep domain modules deterministic and free of UI, network, and storage dependencies.
- Add unit tests for domain behavior and integration tests for persistence and imports.
- Add synthetic fixtures for parsers; never commit real statements, names, account numbers, API keys, or model transcripts containing financial data.
- Make migrations additive and reversible when practical.
- Validate all portable JSON against the schemas in `schemas/`.
- Preserve keyboard, screen-reader, reduced-motion, high-contrast, and narrow-screen behavior.
- Do not add telemetry or remote requests without a reviewed ADR and explicit user consent.

## Suggested change workflow

1. Create a focused branch.
2. Update the relevant specification before or with implementation.
3. Add tests covering success, malformed input, duplicates, cancellation, and recovery where applicable.
4. Run formatting, linting, type checking, tests, schema validation, and production build.
5. Run the Chromium browser gate for UI, storage, PWA, routing, or network-boundary changes.
6. Describe privacy impact, data-model impact, migration behavior, and screenshots for UI changes in the pull request.

## Commit and pull-request guidance

Prefer small commits with imperative summaries. A pull request should state:

- the user problem and chosen behavior;
- the documents or requirements it implements;
- security and privacy implications;
- test evidence;
- migrations or compatibility considerations;
- unresolved risks or follow-up work.

## Schema changes

Portable formats use semantic versions. A breaking change requires:

- a new major schema version;
- a migration strategy and compatibility tests;
- updated examples and documentation;
- an ADR when the change alters ownership, privacy, or interoperability.

## Security reports

Do not publish exploitable security issues or sensitive fixtures in a public issue. Until a dedicated security contact is established, create a minimal private security advisory through the repository hosting service. Include reproduction steps using synthetic data only.

## Definition of done

A change is done when behavior is specified, accessible, tested at the appropriate layers, documented, backward-compatible or migrated, and free of unexplained network or sensitive-data handling.
