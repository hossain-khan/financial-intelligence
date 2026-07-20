# Cash-flow summaries and filtered CSV export

## Purpose

Define the deterministic facts, shared query behavior, accessibility contract, and CSV safety rules implemented by the Phase 1 overview.

## Scope

This contract covers the cash-flow summary on the transaction page and the user-triggered export of its current shared query. It does not define the full portable-data export planned separately.

## Deterministic calculations

The pure functions in `packages/analysis` calculate all totals from canonical transactions. UI components must render these facts and must not reimplement financial arithmetic.

- Income is the sum of positive, non-transfer, non-void transactions.
- Spending is the absolute sum of negative, non-transfer, non-void transactions.
- Net cash flow is income minus spending.
- Transfer activity reports the absolute value moved, but transfers are excluded from income, spending, and net cash flow.
- Void transactions are excluded and counted in the disclosure.
- Transactions marked `needsReview` remain included and are counted in the disclosure because unresolved duplicate decisions may affect totals.
- Decimal-safe `Money` operations are used for aggregation. JavaScript floating-point arithmetic is used only to scale decorative chart bars.
- Currencies are grouped independently. The application never adds currencies together or implies an exchange rate.

Results are grouped by currency, month, account, and spending category. A month is marked incomplete when the selected date range clips either boundary or the month has not ended as of the explicit analysis date.

## Shared query

Account, date range, currency, and category filters are shared between the summary, its drill-down facts, the ledger, and the filtered CSV export. Ledger-only search, direction, review-state, and sorting controls do not alter summary facts.

Each summary exposes a reproducible text description of the active shared filters. Every metric and row retains the canonical transaction identifiers that contributed to it, allowing the UI to show the exact underlying records.

## Accessible presentation

Every summary currency section includes:

- a title, period, currency, active filter description, and neutral text takeaway;
- income, spending, excluded transfer activity, and net cash-flow metrics;
- a monthly SVG comparison with a programmatic title and description;
- an adjacent table containing the exact monthly values and incomplete-period markers;
- account and category fact tables; and
- keyboard-operable buttons that drill into the contributing canonical transactions.

Color and chart geometry are supplemental. Exact information remains available in semantic tables.

## Filtered CSV format

The export is UTF-8 CSV with CRLF record endings and this stable column order:

```text
transaction_id,posted_date,description,amount,currency,account,category,review_state,status,source_location,filter_summary
```

The export contains exactly the transactions selected by the shared query, including void records when they match. This preserves the distinction between a query export and cash-flow calculations, which exclude void records from totals.

CSV fields follow RFC-style quoting: fields containing commas, quotes, carriage returns, or line feeds are quoted, and embedded quotes are doubled. Every cell is checked for spreadsheet formula injection. After optional leading whitespace/control characters, values beginning with `=`, `+`, `-`, or `@` are prefixed with an apostrophe. This applies to imported descriptions and all application-provided labels or metadata.

## Performance target

A 50,000-transaction deterministic aggregation should complete within one second on the test environment. The UI may later move analysis to a worker if rendering measurements show main-thread contention; this does not change the pure analysis contract.

## Related documents

- [Product requirements](03-PRODUCT-REQUIREMENTS.md)
- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [Data model](09-DATA-MODEL.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [UX guidelines](13-UX-GUIDELINES.md)
