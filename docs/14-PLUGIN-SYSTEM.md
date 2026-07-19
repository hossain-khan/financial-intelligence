# Plugin System

## Purpose

Define a future extension model that preserves core privacy, integrity, portability, and accessibility.

## Status and scope

The plugin system is post-v1 infrastructure. This document reserves boundaries so core implementation does not accidentally make safe extensions impossible. Plugins may add import adapters, read-only analyses, dashboard widgets, export formats, and domain-specific calculators. They may not bypass core validation or silently expand network access.

## Design goals

- Explicit least-privilege permissions.
- Isolation from application storage, secrets, and DOM.
- Versioned, typed host APIs.
- Auditable reads and user-confirmed writes.
- Deterministic uninstall and compatibility behavior.
- Accessible, theme-compatible UI contributions.

## Non-goals

- Arbitrary npm packages executing in the main application realm.
- Unrestricted database, filesystem, network, model, or DOM access.
- Plugins initiating payments, trades, or regulated decisions.
- Guaranteeing backward compatibility for experimental APIs before 1.0 of the SDK.

## Extension points

| Type | Capability |
| --- | --- |
| Import adapter | Convert a declared file type/layout to bounded source rows |
| Analyzer | Read approved fields/aggregates and return typed insights |
| Dashboard widget | Render host-approved data through constrained UI or sandboxed view |
| Exporter | Transform a user-selected, disclosed data subset to a file |
| Calculator | Compute a clearly labeled estimate from explicit inputs |

AI provider adapters should use the AI provider contract and reviewed distribution route; treating them as ordinary plugins does not grant secret access.

## Manifest

A plugin manifest includes:

- stable reverse-domain ID, name, version, publisher, license;
- host API compatibility range and entry point;
- integrity/signature/provenance metadata;
- extension declarations;
- required and optional permissions with plain-language reasons;
- exact network origins, if any;
- settings and portable-data schema versions;
- minimum accessibility/localization metadata.

Unknown required permissions or incompatible API ranges block installation.

## Permission model

Permissions are granular and field-scoped:

- `transactions.read` with selectable fields and date/account scope;
- `aggregates.read` for approved metrics/dimensions;
- `categories.read`, `merchants.read`;
- `insights.propose`, `transactions.proposeUpdate`;
- `imports.parse` for user-selected file bytes only;
- `exports.write` for user-initiated downloads;
- `network.connect` restricted to declared origins;
- `ui.dashboard`, `ui.settings`;
- `model.request` for host-mediated tasks, never raw provider secrets.

The installation screen distinguishes required from optional permissions. Grants can be narrower than requested. A plugin handles denial without coercion.

## Isolation

Prefer a sandboxed iframe or worker with message-based RPC, CSP, resource limits, and no same-origin application access. The host passes immutable DTOs and opaque continuation handles. Plugin code receives no IndexedDB handle, service-worker control, top-level navigation, clipboard access, or application DOM reference.

Import adapters run with strict CPU/memory/output/time limits. UI extensions use a constrained component protocol or sandbox with accessibility contract; raw HTML is sanitized and insufficient for trusted integration.

## Data access and mutation

Reads are initiated through capability tokens bound to plugin ID, grant, fields, filters, and expiration. Large datasets use pagination/streaming with quotas. Mutations are proposals validated by domain commands and, when material, previewed to the user. Plugins cannot lock classifications, delete records, pair transfers, create remote consent, or weaken invariants without explicit host flows.

## Network access

Network is denied unless declared and granted. Requests should be host mediated so origin, method, headers, and payload classes can be enforced and logged locally. Secrets supplied to a plugin-specific service are separate from AI/provider secrets and never exposed as raw values when a token broker is feasible.

## Lifecycle

- Installation validates package, manifest, integrity, compatibility, and permissions.
- Updates show new permissions and material data-behavior changes; no silent permission expansion.
- Disable stops execution but retains settings.
- Uninstall removes code/caches and offers deletion/export of plugin-owned namespaced data.
- Core records created through host APIs remain, with plugin provenance.
- A crashing plugin is quarantined without affecting canonical data.

## Portability

Plugin-owned settings/data use a namespaced versioned schema. Financial Brain export excludes plugin data by default; a plugin may contribute a separately disclosed portable section only through a future schema extension mechanism. Core readers preserve or safely ignore compatible namespaced extensions.

## Example candidates

- Canadian RRSP/TFSA contribution visualization using user-entered limits.
- Mortgage amortization scenario calculator.
- Carbon-estimate analysis with clearly sourced assumptions.
- Specialized import adapter for an institution export.
- Family-oriented dashboard using the same local workspace.

These are analyses or estimates, not professional advice. Networked tax/rate data needs explicit origin and freshness disclosure.

## Governance and review

Before enabling third-party distribution, define publisher identity, signing, revocation, vulnerability reporting, automated scanning, permission review, user ratings/reporting, and malicious-package response. An “official” label implies a documented higher review bar.

## Testing requirements

- Manifest/schema and compatibility tests.
- Permission denial/escalation/revocation tests.
- Isolation and storage/network exfiltration tests.
- Resource exhaustion and crash recovery.
- Mutation validation and uninstall integrity.
- Accessibility and responsive checks for UI surfaces.
- Malicious import adapter/model-output fixtures.

## Open questions

- Choose constrained component protocol versus sandboxed web UI.
- Define package signing and registry governance.
- Decide whether third-party plugins can ship before a browser-standard permission mechanism is mature enough.

## Related documents

- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [Roadmap](15-ROADMAP.md)
