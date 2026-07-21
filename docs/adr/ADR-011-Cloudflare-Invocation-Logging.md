# ADR-011: Persistent Cloudflare Invocation Logging

- Status: Accepted
- Date: 2026-07-20
- Decision owners: Project maintainers

## Context

The assets-only Cloudflare Worker has no application handler, backend, bindings, canonical data, or
custom server-side logging. Operational diagnosis still benefits from knowing whether requests reach
the Worker and what status the host returns. Cloudflare Workers Logs can persist invocation events
containing the request URL, response information, and platform metadata.

This changes the default in ADR-009, which disabled Worker observability. It does not change the
offline-first application boundary: imported files, IndexedDB records, backup plaintext, and
Financial Brain contents remain inaccessible to the static host. However, route query strings cross
the network boundary, and dashboard filters can contain opaque account/merchant identifiers,
user-authored tags, currencies, and date ranges.

## Decision

- Enable persistent Cloudflare Worker logs with `head_sampling_rate` set to `1` and invocation logs
  enabled.
- Keep distributed traces disabled. Retain explicit trace settings so a dashboard or default change
  does not silently enable them.
- Keep Wrangler usage metrics and dependency instrumentation disabled.
- Do not add application `console` logging of financial, imported, learned, user-authored, secret, or
  backup data.
- Do not place transaction text, exact amounts, account labels, filenames, prompts, keys, backup
  contents, or other restricted values in URLs.
- Treat Cloudflare's configured retention, access controls, query access, and usage limits as release
  operations that maintainers must review.

## Consequences

### Positive

- Maintainers can diagnose asset requests, routing failures, status codes, and deployment behavior
  from the Cloudflare dashboard.
- Logging requires no application backend, SDK, custom telemetry event, or access to browser storage.
- Explicitly disabling traces prevents automatic trace collection if platform defaults change.

### Negative

- Cloudflare persists every sampled invocation, increasing provider-held metadata, retention, and
  account-access risk.
- Request URLs can include dashboard filter values and therefore may reveal opaque identifiers,
  user-authored tags, currencies, or date ranges.
- A 100% sampling rate consumes the account's log allowance faster than a diagnostic sample and may
  incur cost or automatic sampling at platform limits.

## Alternatives considered

- **Keep observability disabled:** offers the smallest provider-held metadata footprint but was not
  selected because the maintainer enabled Worker logging for production diagnosis.
- **Sample less than 100%:** reduces metadata and usage but was not selected for the initial
  operational baseline.
- **Enable traces:** rejected because an assets-only Worker has no application call graph requiring
  distributed tracing.
- **Add custom client telemetry:** rejected because it would create a new network flow capable of
  exposing local financial behavior.

## Validation

- Wrangler schema validation and deployment dry-run accept the nested log and trace configuration.
- Deployment inspection confirms logs are enabled at 100% sampling and traces remain disabled.
- Browser network tests continue to reject unexpected application requests.
- Release review checks application logging and URL changes for restricted data exposure.

## Related decisions

- [ADR-001: Offline-first core architecture](ADR-001-Offline-First.md)
- [ADR-009: Cloudflare Workers Static Assets as the reference host](ADR-009-Cloudflare-Workers-Static-Hosting.md)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [System architecture](../07-SYSTEM-ARCHITECTURE.md)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
