# ADR-009: Cloudflare Workers Static Assets as the Reference Host

- Status: Accepted
- Date: 2026-07-20
- Decision owners: Project maintainers

## Context

Financial Intelligence produces a static Vite PWA and requires HTTPS, single-page-application route
fallback, configurable security headers, immutable versioned assets, and predictable application
updates. The project also needs preview deployments and an automatic production deployment after a
change passes review and is merged to `main`.

Hosting must not introduce a required application backend or move statements, transactions,
IndexedDB records, backups, or Financial Brain data into provider storage. The built application
must remain portable to another conforming static HTTPS host.

## Decision

Use [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) as
the reference production host. Deploy the Vite output in `apps/web/dist` as an assets-only Worker:

- no Worker entrypoint, D1 database, KV namespace, R2 bucket, server-side rendering, or first-party
  API is required;
- `assets.not_found_handling` uses `single-page-application` so direct navigation to React Router
  routes serves the application shell;
- the checked-in `_headers` file defines CSP and the other required response policies;
- Wrangler usage metrics, dependency instrumentation, and Worker observability are disabled by
  default;
- Cloudflare Workers Builds connects to GitHub, promotes builds from `main`, and uploads preview
  versions for non-production branches;
- the Wrangler version and configuration are pinned in the repository, and a dry run validates the
  deployable asset bundle before release.

Production deployment remains downstream of the mandatory pull-request and GitHub CI workflow.
Cloudflare build success does not replace repository verification. The application continues to use
origin-local IndexedDB and Cache Storage; Cloudflare receives requests for public application assets
but not locally imported financial data.

## Consequences

### Positive

- GitHub-connected builds can deploy every reviewed `main` change without maintaining deployment
  credentials in repository workflows.
- Static assets, SPA routing, HTTPS, preview versions, and `_headers` policies use one supported
  hosting path.
- There is no application server to operate and no new runtime access to user financial data.
- The generated static build remains deployable to another host that implements equivalent routing
  and response headers.

### Negative

- Production availability and asset delivery depend on Cloudflare until the deployment target is
  changed.
- Build settings in the Cloudflare dashboard are operational configuration and must be reviewed
  against the documented values.
- Provider preview URLs and build metadata are visible to the configured GitHub/Cloudflare accounts.
- Direct-route fallback and security headers require deployment-level verification in addition to a
  successful Vite build.

### Required mitigations

- Restrict production deployment to `main`; use non-production versions for pull requests.
- Keep Wrangler configuration, tool versions, and dashboard build commands documented and pinned.
- Verify the deployed CSP, permissions policy, cache behavior, service-worker update flow, direct
  routes, offline reload, and zero unexpected network requests before treating a deployment as a
  release.
- Do not add Worker bindings or server-side data handling without a separate threat-model review and
  ADR.
- Preserve the host-neutral static artifact and the security requirements in ADR-001 and ADR-004.

## Alternatives considered

- **Cloudflare Pages:** supports Git-connected static deployment, but Workers Static Assets is the
  current unified Cloudflare deployment model and provides the required assets-only behavior without
  adding a backend.
- **GitHub Pages:** can host static files, but SPA fallback and response security-header control are
  less direct for this application contract.
- **A custom Worker entrypoint:** unnecessary for a client-only PWA and would create an avoidable
  runtime and header-maintenance surface.
- **A conventional server or server-rendered framework:** rejected by ADR-001 and ADR-004 because
  the product does not require a backend.

## Validation

- `pnpm cloudflare:check` builds the repository and completes a Wrangler dry-run upload plan.
- `pnpm security:headers:check -- apps/web/dist/_headers` validates the deployable header policy.
- Preview and production smoke tests open `/`, `/dashboard`, `/import`, `/transactions`, and
  `/settings` directly over HTTPS.
- Browser qualification verifies installation, coordinated update, offline reload, local
  persistence, and the local-mode network guard.
- Production response inspection confirms the configured CSP, Permissions-Policy,
  Referrer-Policy, MIME-sniffing protection, framing protection, and cache directives.

## Related decisions

- [ADR-001: Offline-first core architecture](ADR-001-Offline-First.md)
- [ADR-004: TypeScript React PWA technology stack](ADR-004-Technology-Stack.md)
- [System architecture](../07-SYSTEM-ARCHITECTURE.md)
- [Quality baseline](../17-QUALITY-BASELINE.md)
