# Security and Privacy

## Purpose

Define the threat model, data boundaries, security controls, consent model, retention, deletion, and verification requirements.

## Privacy promise

Core use is local. The application does not require an account, bank credentials, client-side
telemetry, or remote AI. The reference static host persists invocation metadata as documented below;
it cannot access origin-local financial records. When a user enables another network capability,
the product identifies the destination and data classes before transmission. This document is a
product/engineering specification, not a substitute for a release-specific privacy notice.

## Data classification

| Class | Examples | Default handling |
| --- | --- | --- |
| Restricted | Source statements, transactions, balances, notes, account labels, API keys | Local only; encrypted backup; never diagnostics |
| Sensitive learned | Merchant aliases, category rules, recurring decisions | Local; portable Brain on explicit export |
| Configuration | Theme, locale, dashboard layout, provider model ID | Local; portable where safe |
| Public application | Static assets, schema definitions, synthetic fixtures | Cache/distribute normally |

Exact amounts and merchant combinations can reveal health, religion, location, relationships, or hardship. They are restricted even without a name.

## Trust boundaries

1. **Untrusted input boundary:** statement files, imported Brain/backups, transaction text.
2. **Application boundary:** main UI/application/domain modules.
3. **Worker boundary:** parsers, crypto, analysis, local models.
4. **Persistent browser boundary:** IndexedDB, Cache Storage, optional file handles.
5. **Network boundary:** static host, model asset host, self-hosted/remote AI.
6. **Extension boundary:** plugins and their UI/network capabilities.
7. **Export boundary:** files downloaded outside application control.

The reference static host persists 100% sampled Worker invocation logs. Cloudflare can retain
request URLs and platform request/response metadata according to the account plan and service
configuration. The application emits no custom financial logs and tracing remains disabled, but URL
query values are inside this network boundary. Never put source text, descriptions, exact amounts,
account labels, filenames, prompts, secrets, or backup contents in a URL.

## Threat actors and scenarios

- Malicious statement content attempts script, HTML, formula, prompt, parser, or resource-exhaustion attacks.
- Cross-site scripting reads the local ledger or secrets.
- A compromised dependency/model/plugin exfiltrates data.
- A remote provider receives more context than disclosed.
- Shared-device users open an unlocked browser profile.
- Browser eviction or failed migration causes data loss.
- An exported backup is stolen or a Brain file reveals patterns.
- User mistakes likely duplicates or transfer suggestions for facts.

The app does not claim protection against a fully compromised device, malicious browser, or attacker with access to an unlocked operating-system account.

## Required controls

### Application and content security

- Strict CSP; avoid inline scripts and unsafe evaluation.
- Compile JSON Schema validators into checked generated modules at build time; never use runtime
  schema compilation, `eval`, or `Function` construction in the browser bundle.
- Limit the production script policy to same-origin code plus `'wasm-unsafe-eval'` for the reviewed
  local Argon2id adapter. This WebAssembly-specific source expression must not be replaced with the
  broader `'unsafe-eval'` permission.
- Render imported/model/plugin text as text, never raw HTML.
- Trusted Types where browser/tooling support is practical.
- Lock dependencies and verify build provenance; review high-risk parser/crypto/model dependencies.
- Parse untrusted documents in bounded workers and never follow embedded URLs.
- Use framework escaping plus explicit URL and downloadable-filename sanitization.
- Prevent spreadsheet formula injection in CSV exports by safe encoding/prefix policy with disclosure.

### Storage

- Keep canonical restricted data in origin-scoped local stores.
- Request durable storage only with explanation; treat denial as normal.
- Show quota/persistence and backup status.
- Do not store persistent secrets by default. If enabled, clearly state browser limitations.
- Service-worker caches contain application/model assets, not statements, provider responses, or exports.

### Cryptography

- Use platform Web Crypto and reviewed formats; never invent primitives.
- Full backups use authenticated encryption (for example AES-GCM) and a memory-hard passphrase KDF selected by ADR/implementation review (for example Argon2id via reviewed WASM).
- Store KDF parameters, salt, nonce, format version, and ciphertext authentication data; never store the passphrase.
- Encrypt before writing the download stream. Avoid keeping extra plaintext copies.
- Financial Brain JSON is human-readable and unencrypted by definition; offer optional encrypted wrapping without changing the canonical JSON schema.

### Network

- Local mode has automated zero-network assertions after asset installation.
- Remote requests use HTTPS except explicit loopback development endpoints.
- Restrict `connect-src` to required static origins; user endpoints require deliberate policy handling.
- No sensitive values in URLs, referrers, DNS-derived hostnames, headers other than required auth, or analytics.
- Remote AI payloads are minimized per task and not cached by service workers.

### Authorization and plugins

- Core UI uses command validation even though the user is local.
- Plugins receive least-privilege, revocable capabilities and isolated execution.
- Plugin writes are proposals; host invariants and confirmation rules still apply.
- Plugins cannot access secret handles, unrestricted DOM, raw stores, or undeclared network origins.

## Remote AI consent

Consent must show:

- provider label and exact endpoint origin;
- local/self-hosted/remote classification;
- task and field classes sent, with a redacted preview;
- whether raw descriptions or only normalized tokens are included;
- provider terms/retention reminder and cost uncertainty;
- session-only vs persistent key choice;
- revocation and delete-profile controls.

Changing endpoint origin, disclosure template, or task scope invalidates prior consent. There is no silent fallback from local to remote.

## Data minimization and retention

- Retaining source documents after extraction is opt-in.
- Provenance retains only fields required to explain/repair the import and is length bounded.
- Operation history is bounded and user-clearable.
- Provider request/response bodies are not logged by default.
- Model artifacts are removable independently.
- Financial Brain export contains reusable knowledge only; backup contains selected workspace data.
- Learning and decision journals contain sensitive before/after state. They remain local, use
  bounded records (1,000 per operation journal), are included only in encrypted full backup, and
  never enter Financial Brain.
- Preview digests and source revisions are opaque concurrency controls. Do not expose their input
  material, transaction text, or exact financial values in URLs, logs, or errors.

## Backup and recovery

Onboarding and storage settings explain that clearing browser/site data can destroy the workspace. Remind users to back up after material imports/corrections without dark patterns. Verify backups before reporting success. Restore decrypts and validates in a temporary area, previews impact, and commits atomically.

## Deletion

Granular deletion covers source file, import, account, provider profile/secret, rules, model asset, diagnostics, and workspace. Complete deletion clears application-controlled IndexedDB, Cache Storage, service worker state where appropriate, and stored handles. The app cannot delete independent files already downloaded or provider-side data; it says so and links to provider controls when known.

## Logging and diagnostics

Default diagnostic events include error code, component/parser/classifier version, duration bucket, record-count bucket, and capability flags. Redact filenames, descriptions, merchant/category names, notes, exact counts/amounts/dates, account IDs/labels, URLs, keys, prompt bodies, and stack fragments containing source content. User reviews a diagnostic export before saving it.

## Security verification

- Threat model review for imports, persistence, AI, backup, and plugins.
- Dependency/SBOM, license, and known-vulnerability checks.
- CSP and network allow-list tests in production build.
- XSS, formula injection, path/URL, parser bomb, prompt injection, and malformed JSON fixtures.
- Fuzz/property tests for parsers and schema/migration boundaries.
- Backup cryptography test vectors, tamper detection, wrong-passphrase, and interrupted restore.
- Plugin permission bypass tests before plugin execution ships.
- Manual shared-device and browser-data-clear recovery review.

## Incident readiness

Before public release, establish a private reporting channel, supported-version policy, severity rubric, fix/notification process, and signed release mechanism. A security issue affecting local data must not be minimized merely because there is no server.

## Open questions

- Select the exact backup container/KDF based on browser performance and cryptographic review.
- Determine whether an optional application lock materially protects shared devices given browser constraints.
- Define release hosting/CSP strategy for user-configured endpoints.

## Related documents

- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [AI architecture](08-AI-ARCHITECTURE.md)
- [Plugin system](14-PLUGIN-SYSTEM.md)
