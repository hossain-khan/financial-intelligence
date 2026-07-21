# ADR-010: CSP-Safe Generated Validators and Narrow WebAssembly Execution

- Status: Accepted
- Date: 2026-07-20
- Decision owners: Project maintainers

## Context

The deployed application uses a restrictive Content Security Policy (CSP). Ajv normally compiles
JSON Schemas into JavaScript functions at runtime, so initializing schema validators in the browser
requires dynamic JavaScript evaluation and prevents the application from starting under that
policy.

The encrypted-backup implementation separately uses the reviewed `hash-wasm` Argon2id adapter from
ADR-007. CSP applies its script execution policy to WebAssembly compilation as well. Disallowing all
WebAssembly compilation therefore makes encrypted backup creation unavailable in production even
though its code and data remain local.

The CSP Level 3 integration distinguishes the narrow `'wasm-unsafe-eval'` source expression from
`'unsafe-eval'`: the former permits WebAssembly compilation and instantiation, while the latter also
permits JavaScript string evaluation and `Function` construction.

## Decision

- Compile every canonical portable JSON Schema into named Ajv standalone validator functions during
  `pnpm schema:generate`.
- Bundle the generated validator module for browsers and commit it with the generated TypeScript
  contracts. CI rejects stale generated artifacts and tests that the module contains no `eval` or
  `Function` call.
- Keep Ajv, ajv-formats, esbuild, and the formatter as schema-package build dependencies. Production
  application code imports the generated functions and does not ship Ajv's runtime compiler.
- Set production `script-src` to `'self' 'wasm-unsafe-eval'`. Continue to prohibit
  `'unsafe-eval'`, inline scripts, remote scripts, and other unapproved execution sources.
- Serve browser tests through the pinned Wrangler runtime so the checked-in production headers are
  applied. Browser tests must prove initial application bootstrap and encrypted backup operation
  under the policy in Chromium, Firefox, and WebKit.

The WebAssembly allowance exists only for reviewed local runtimes such as the Argon2id adapter. A
new WebAssembly dependency still requires ordinary dependency, privacy, resource-bound, and
supply-chain review.

## Consequences

### Positive

- The application starts under the production CSP without weakening JavaScript evaluation controls.
- Portable validation behavior remains generated from the canonical root schemas and retains the
  existing validation API.
- The Argon2id encrypted-backup path works under the deployed policy without allowing `eval` or the
  JavaScript `Function` constructor.
- Browser verification now observes the same CSP and static-asset behavior as the reference host.

### Negative

- Generated validators add a large machine-generated source artifact that must be regenerated and
  reviewed through deterministic checks.
- The CSP permits WebAssembly compilation for same-page code, increasing the importance of script
  integrity, dependency review, and the existing same-origin script restriction.
- The schema generator gains build-time dependencies and a bundling step.

## Alternatives considered

- **Add `'unsafe-eval'`:** rejected because it would permit both Ajv runtime compilation and general
  JavaScript string evaluation, unnecessarily weakening the XSS mitigation.
- **Remove CSP enforcement:** rejected because financial data is highly sensitive and the existing
  host can enforce the policy.
- **Hand-maintain validators:** rejected because they would drift from the normative JSON Schemas and
  duplicate validation logic.
- **Disable encrypted backup in production:** rejected because ADR-007 already selected a local
  Argon2id WASM implementation and the narrow CSP source expression supports it.
- **Return browser tests to Vite Preview:** rejected because that server does not apply the deployed
  `_headers` policy and allowed both incompatibilities to escape verification.

## Validation

- `pnpm schema:check` regenerates and compares all portable types and the standalone validator
  module.
- Schema contract and round-trip tests execute the public validation functions with accepted and
  rejected data.
- Generation tests reject dynamic JavaScript evaluation in the generated module.
- Production bundle inspection finds no `eval` or `new Function` expression.
- The security-header check requires `'wasm-unsafe-eval'` while continuing to reject
  `'unsafe-eval'` and `'unsafe-inline'`.
- Playwright runs through Wrangler and verifies application bootstrap, encrypted backup, and the
  local network guard in every supported engine.

## Related decisions

- [ADR-001: Offline-first core architecture](ADR-001-Offline-First.md)
- [ADR-004: TypeScript React PWA technology stack](ADR-004-Technology-Stack.md)
- [ADR-007: Versioned encrypted workspace backup](ADR-007-Encrypted-Workspace-Backup.md)
- [ADR-009: Cloudflare Workers Static Assets as the reference host](ADR-009-Cloudflare-Workers-Static-Hosting.md)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/#wasm-integration)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
- [Quality baseline](../17-QUALITY-BASELINE.md)
