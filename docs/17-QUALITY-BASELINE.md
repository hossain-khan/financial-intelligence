# Quality Baseline

## Purpose

Define the initial browser, development-runtime, accessibility, offline-privacy, security-header, and
supply-chain verification contract. This is a baseline for repeatable evidence, not a claim that
automation alone establishes WCAG 2.2 AA conformance.

## Supported browser matrix

Core no-AI workflows do not require WebGPU.

| Browser family | Initial support | Pull-request evidence | Release evidence |
| --- | --- | --- | --- |
| Chromium (Chrome and Edge) | Latest two stable major versions | Playwright Chromium project | Current Chrome and Edge stable |
| Firefox | Latest two stable major versions | Playwright Firefox project | Current Firefox stable |
| WebKit (Safari) | Safari 17.4 and later on supported Apple platforms | Playwright WebKit project | Current macOS Safari and one current iOS/iPadOS device |

Playwright emulation catches cross-engine regressions but does not replace release checks in the
vendor browsers, operating systems, assistive technologies, and installed-PWA modes listed above.
JavaScript and cookies/site storage must be available. Private-browsing storage limits and browser
data eviction remain supported failure states rather than durable-storage guarantees.

## Development runtime matrix

| Tool | Supported range | CI pin |
| --- | --- | --- |
| Node.js | 22.12 or later; active LTS preferred | Node.js 24 |
| pnpm | pnpm 10, using the repository `packageManager` declaration | 10.33.0 |
| TypeScript compiler | TypeScript 7 native CLI; TypeScript 6 compatibility package for legacy tooling | 7.0.2 CLI; `@typescript/typescript6` 6.0.2 |

Use Corepack or an equivalent version-aware installation. Changes to the CI Node major, pnpm major,
or browser floor require a compatibility note and documentation update.

## Automated browser gates

Run the Chromium gate locally after installing its browser binary:

```bash
pnpm exec playwright install chromium
pnpm browser:test:chromium
```

`pnpm browser:test` runs Chromium, Firefox, and WebKit when all three binaries are installed. Tests
use the production build, a temporary browser profile, synthetic workspace names, semantic
role/label selectors, and retained traces only on failure. Reports and test output are ignored by Git.

The gate covers:

- workspace creation, IndexedDB persistence, and reload;
- reload from the installed service-worker cache while Chromium is offline;
- axe-core checks for the overview/form, storage-error, and settings states;
- keyboard access to the skip link and visible focus;
- reflow at a 320 CSS pixel viewport and reduced-motion preference propagation;
- a fail-closed local-mode network allow-list;
- a negative request proving an unknown origin is blocked and reported.

Only the local application origin plus `blob:` and `data:` resources are allowed by the browser
tests. Analytics, remote fonts, provider endpoints, and any unknown origin fail the local-mode gate.

## Manual accessibility and adaptability checklist

Complete this checklist for release candidates and after material navigation, form, layout, chart,
or design-token changes. Record browser, OS, assistive technology, viewport, build commit, reviewer,
and findings in release evidence.

- [ ] Complete every visible action using keyboard only; focus order follows reading order.
- [ ] Confirm the skip link appears on focus and moves focus/reading context to main content.
- [ ] Confirm focus remains visible in default, dark/high-contrast system settings, and Windows
      forced-colors mode.
- [ ] At 200% browser text zoom, complete workspace creation without clipped text, hidden controls,
      two-dimensional scrolling, or lost status/error messages.
- [ ] At 320 CSS pixels, confirm content reflows without horizontal page scrolling and touch targets
      remain usable.
- [ ] With reduced motion enabled, confirm no essential information depends on animation and no
      unexpected motion remains.
- [ ] With a screen reader, verify landmarks, headings, primary navigation, form labels,
      required/error announcements, loading state, and workspace list semantics.
- [ ] Confirm status, error, inflow/outflow, and focus are not communicated by color alone.
- [ ] Test current macOS Safari and one current iOS/iPadOS device before a supported release.
- [ ] Reload the installed application offline in current Firefox, macOS Safari, and iOS/iPadOS
      Safari; Playwright's non-Chromium offline toggle does not exercise their service-worker
      navigation path reliably.
- [ ] With macOS full keyboard access enabled, verify Safari tabs to the skip link and all controls;
      WebKit CI inherits host keyboard preferences and uses programmatic focus for style/reflow checks.

## Production security headers

The deployable `_headers` file is copied into the production build. Run:

```bash
pnpm build
pnpm security:headers:check -- apps/web/dist/_headers
```

The check requires restrictive CSP, Permissions-Policy, Referrer-Policy, MIME sniffing protection,
and framing protection, and rejects unsafe inline/eval CSP allowances. Hosts that do not consume the
`_headers` format must translate the same policy and verify the actual HTTPS response before release.

## Cloudflare deployment verification

The reference Cloudflare Workers Static Assets bundle is checked without publishing it:

```bash
pnpm cloudflare:check
```

This runs the production build and Wrangler's dry-run deployment plan using `wrangler.jsonc`. Before
promoting a release, verify the preview and production URLs over HTTPS:

- direct navigation and reload for `/`, `/dashboard`, `/import`, `/transactions`, and `/settings`;
- the CSP, Permissions-Policy, Referrer-Policy, `nosniff`, framing, HTML revalidation, and immutable
  hashed-asset response headers;
- service-worker registration, installability, coordinated update, and offline reload;
- IndexedDB persistence across reload and deployment without transmitting workspace records;
- the local-mode network allow-list in Chromium, Firefox, and WebKit.

Workers Builds uses `main` for production and `wrangler versions upload` for non-production preview
versions. A Cloudflare build cannot replace GitHub CI or authorize an unreviewed production change.

## Dependency and supply-chain review

CI runs a high-severity `pnpm audit` and uploads a production dependency inventory for inspection.
Dependabot proposes grouped weekly development-dependency updates. Lockfile integrity is mandatory;
license review remains a required human step for direct dependencies and material transitive changes.

For dependency changes:

1. Prefer an existing platform or dependency already in the graph.
2. Review maintainer/repository identity, release history, license, transitive size, install scripts,
   browser/network privileges, and known advisories.
3. Pin direct dependencies and inspect the lockfile diff for unexpected packages or registries.
4. Give parser, cryptography, service-worker, AI runtime, and build-execution dependencies additional
   threat-model review.
5. Document any accepted high-severity advisory or non-standard license with scope, rationale,
   compensating control, owner, and review date. Do not silently bypass the CI gate.

The generated inventories contain package metadata only and are not uploaded to a third-party
analytics service. They are retained as bounded GitHub Actions artifacts.

## Related documents

- [Non-functional requirements](06-NON-FUNCTIONAL-REQUIREMENTS.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [UX guidelines](13-UX-GUIDELINES.md)
- [Technology stack](16-TECHNOLOGY-STACK.md)
