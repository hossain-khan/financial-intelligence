# ADR-012: Purpose-built bounded OFX/QFX parser without a third-party OFX or XML dependency

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

Phase 3 adds OFX and QFX statement import (issue #25). OFX is two dialects behind one message
grammar: OFX 1.x is SGML with a `key:value` preamble and frequently unclosed leaf elements; OFX 2.x
(and most QFX) is XML with an `<OFX>` root. Both are untrusted input and can carry hostile
constructs — DTDs, internal and external entity declarations, processing instructions, and CDATA —
that a general XML parser may resolve, enabling entity-expansion denial of service or external
resource access (XXE). The default analysis path must remain network-free and CSP-safe, and
application-owned limits, cancellation, provenance, masking, and sanitized issues cannot be
delegated to a general-purpose library.

## Decision

Implement a purpose-built, bounded OFX parser in `packages/import-ofx` with no third-party OFX or XML
runtime dependency. The package implements the existing `@financial-intelligence/import-core`
`StatementParser` contract with parser id `ofx` and version `1.0.0`, and mirrors the worker
protocol, cancellation, progress, bundle-size check, and stable error-code patterns of
`packages/import-csv`.

The parser:

- decodes a documented encoding set only (UTF-8, UTF-16 with BOM, Windows-1252/US-ASCII per the OFX
  header or XML declaration) and treats an unknown or self-contradictory encoding as an explicit
  error;
- tokenizes both dialects with one bounded tag scanner that uses a known OFX leaf-tag table to close
  unclosed SGML leaves, rather than a general markup parser or whole-document regex substitution;
- rejects DTDs, entity and notation declarations, CDATA sections, and any non-standard entity
  reference before building the node tree, and never resolves external resources;
- parses OFX timestamps with a dedicated `YYYYMMDDHHMMSS[.fff][offset:zone]` grammar that validates
  every calendar and offset field and derives a canonical date deterministically, never delegating
  to `Date.parse`;
- enforces byte, decoded-character, nesting-depth, element-count, statement, transaction,
  field-length, issue, output, and runtime limits, starting from the CSV 16 MiB / 100k envelope.

Only OFX 1.x SGML and OFX 2.x XML bank (`STMTRS`) and credit-card (`CCSTMTRS`) statement responses
are in v1 scope. Investment, loan, bill-pay, profile/signup, interbank/wire request, and sign-on
blocks produce bounded `UNSUPPORTED_SECTION` warnings and are never acted upon. Full account and
routing numbers are never stored or displayed; only a masked last-four hint is surfaced to help the
user select a local account.

Format-neutral candidate validation and result assembly shared with CSV live in a new
`buildCandidatesFromDrafts` helper in `import-core`; CSV column mapping and locale parsing remain in
`import-core/mapping.ts`. FITID is preserved as the source transaction id but is treated as unique
only within the selected account/import context, never as a global identifier.

## Alternatives considered

- **A general XML parser (e.g. `fast-xml-parser`, `DOMParser`) plus an OFX library:** rejected. It
  would not natively handle OFX 1.x SGML with unclosed leaves, would add attack surface for
  entity/DTD/XXE handling that we would have to re-secure anyway, and would enlarge the worker
  bundle. Maintained, security-reviewed, CSP-safe browser OFX libraries covering both dialects were
  not available at decision time.
- **Reusing `mapCsvSources` from the OFX adapter:** rejected. CSV column mapping and locale-specific
  date/number parsing do not apply to OFX, which is already normalized; only the post-parse
  validation is genuinely shared, so that part alone was factored out.
- **Applying the OFX GMT offset to shift the calendar day:** rejected for v1. A posted date is a
  statement wall-clock day; the offset is validated and preserved in provenance but not applied, so
  a transaction cannot silently move between days.

## Consequences

### Positive

- No new third-party runtime dependency enters the worker or application bundle; the built worker is
  well under budget and free of `eval`, network, and storage access.
- Hostile markup fails closed before tree construction; the parser cannot be induced to resolve
  entities or fetch external resources.
- One code path serves both dialects, and OFX shares the canonical fingerprint/duplicate/commit
  pipeline with CSV.

### Negative

- The project now owns OFX grammar behavior, including the leaf-tag table, which must be extended as
  new supported tags appear and kept covered by the dialect and fuzz fixtures.
- Constructs outside the v1 leaf-tag table are treated as aggregates or unsupported sections rather
  than fully modeled.

## Validation

- Synthetic OFX 1.x SGML and OFX 2.x XML bank and credit-card fixtures produce correct canonical
  candidates through the shared commit path.
- Adversarial tests cover DTD/entity/CDATA/XXE rejection, unknown/contradictory encodings, SGML leaf
  closing, nesting/element/field/output/runtime/file limits, and truncated documents failing closed.
- OFX date tests cover offsets, fractions, calendar validity across a full leap year, and rejection
  of impossible values; amount tests cover signed decimals and invalid amounts.
- Worker tests cover cancellation and normalized failures; cross-format tests confirm OFX and CSV
  records deduplicate via the shared fingerprint.
- Chromium, Firefox, and WebKit Playwright import flows run under the local network guard.

## Related decisions

- [ADR-005](ADR-005-CSV-Parser.md)
- [ADR-001](ADR-001-Offline-First.md)
- [ADR-010](ADR-010-CSP-Safe-Generated-Validators-And-WebAssembly.md)
- [Import pipeline](../11-IMPORT-PIPELINE.md)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
