# ADR-005: CSV Parse for bounded delimited-text intake

- Status: Accepted
- Date: 2026-07-19
- Decision owners: Project maintainers

## Context

Phase 1 needs standards-aware CSV and TSV parsing in a browser module worker. The parser must handle
quoted delimiters, escaped quotes, embedded line endings, malformed records, and large synthetic
datasets while remaining compatible with the restrictive content-security policy. Application-owned
limits, cancellation, provenance, and sanitized issues cannot be delegated to a third-party parser.

## Decision

Use `csv-parse` 7.0.1 through its browser ESM distribution inside `packages/import-csv`.

The dependency provides streaming input, automatic record-delimiter support, raw record and line
information, malformed-record callbacks, and an internal `max_record_size` guard. It performs no
type casting in this integration: every field remains text. Our adapter owns encoding/BOM handling,
delimiter confirmation, header policy, row provenance, resource limits, progress, cancellation,
issue normalization, output shaping, and worker protocol validation.

The parser dependency is isolated to the import worker package. It does not enter the main application
bundle, domain/application packages, storage adapters, or service worker.

## Dependency review

- The package is MIT licensed, has no runtime dependencies, and has been maintained as part of the
  Adaltas CSV project since 2010.
- The project documents browser ESM and streaming APIs. Version 7.0.1 was current when this decision
  was recorded.
- The distributed browser ESM file is approximately 215 kB uncompressed and 51 kB gzip before
  bundler optimization. The maintained worker build is approximately 97 kB uncompressed and 29 kB
  gzip. This cost is paid only when the dedicated import worker is loaded.
- A source scan found no dynamic code evaluation, DOM access, network calls, or URL fetching in the
  JavaScript distribution, so it is compatible with the production CSP without `unsafe-eval`.
- Adversarial fixtures cover formula-like text, HTML, URLs, prompt-like content, malformed quoting,
  oversized records, output bounds, cancellation, and issue bounds.

Primary references:

- <https://csv.js.org/parse/distributions/browser_esm/>
- <https://csv.js.org/parse/api/>
- <https://csv.js.org/parse/options/max_record_size/>
- <https://csv.js.org/parse/options/on_skip/>
- <https://www.npmjs.com/package/csv-parse>

## Consequences

### Positive

- Mature CSV grammar behavior does not need to be reimplemented.
- Streaming chunks allow the worker event loop to observe cancellation and emit progress.
- Parser-specific failures are converted to stable, bounded application issue/error codes.
- Source cells remain inert strings and never gain DOM, formula, instruction, or network semantics.

### Negative

- The browser distribution includes stream polyfills and adds a non-trivial worker chunk.
- The adapter must continue testing library upgrades against the malicious and dialect fixture corpus.
- The library's limits are insufficient alone, so application limits remain mandatory.

## Alternatives considered

- **Hand-written CSV state machine:** rejected because subtle quoting and recovery behavior would add
  unnecessary security and compatibility risk.
- **Papa Parse:** capable and browser-focused, but the selected package offers a smaller dependency
  surface, explicit stream APIs, raw/info metadata, and malformed-record hooks that align closely with
  the adapter contract.
- **Synchronous parsing:** rejected because cancellation and main-thread responsiveness are product
  requirements even when parsing runs in a worker.

## Validation

- Fixture tests cover comma, semicolon, tab, LF, CRLF, UTF-8 BOM, UTF-16LE BOM, quoting, escaped quotes,
  embedded newlines, empty input, configured footers, and source locations.
- Limit tests cover file, row, column, cell, runtime, issue, and output bounds.
- Worker tests cover progress, cancellation, normalized failure, unknown messages, and unsupported
  protocol versions.
- A 20,000-row synthetic reference dataset must parse above the 10,000 rows/second threshold in the
  maintained test environment.

## Related decisions

- [ADR-001](ADR-001-Offline-First.md)
- [ADR-004](ADR-004-Technology-Stack.md)
- [Import pipeline](../11-IMPORT-PIPELINE.md)
