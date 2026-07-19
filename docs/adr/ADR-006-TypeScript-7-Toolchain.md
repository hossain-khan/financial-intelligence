# ADR-006: TypeScript 7 Native Compiler with a TypeScript 6 Compatibility API

- Status: Accepted
- Date: 2026-07-19
- Decision owners: Project maintainers

## Context

TypeScript 7 replaces the JavaScript compiler with a native Go implementation. It provides the
`tsc` command but does not ship the legacy programmatic compiler API. The application type-checks
and builds with TypeScript 7, while `typescript-eslint` 8 still imports the `typescript` module and
expects the TypeScript 6 API. Installing TypeScript 7 directly as `typescript` therefore makes lint
startup fail before any source file is checked.

Microsoft provides `@typescript/typescript6` for tools that need the legacy API and recommends a
side-by-side installation during the transition.

## Decision

Use exact package aliases for the transitional toolchain:

```json
{
  "@typescript/native": "npm:typescript@7.0.2",
  "typescript": "npm:@typescript/typescript6@6.0.2"
}
```

The package installed as `@typescript/native` owns the `tsc` executable used by repository
type-check and build scripts. The package installed as `typescript` exposes the TypeScript 6 API and
the separately named `tsc6` executable for API-dependent tools such as `typescript-eslint`.

Application, worker, schema, and build configuration code must not import the TypeScript compiler
API. The compatibility package is tooling-only and must not enter browser or worker bundles.

Remove the compatibility alias when the maintained lint and build toolchain supports TypeScript 7's
new API. That removal requires proving that `typescript-eslint` no longer imports the TypeScript 6
API, replacing the aliases with the standard TypeScript package, and passing every quality gate.

Primary references:

- <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>
- <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html>

## Consequences

### Positive

- Project type-checking and builds use the faster native TypeScript 7 compiler immediately.
- ESLint remains functional without pinning the entire toolchain to TypeScript 6.
- Exact aliases make the temporary compatibility boundary explicit and reproducible.

### Negative

- Two compiler packages are installed during the transition.
- Editors and tools that resolve the `typescript` module directly see the TypeScript 6 API unless
  explicitly configured for TypeScript 7.
- Dependency automation cannot safely replace only the `typescript` alias without considering the
  paired native compiler version.

## Alternatives considered

- **Install TypeScript 7 directly as `typescript`:** rejected because `typescript-eslint` 8 crashes
  while importing compiler API values that TypeScript 7 does not expose.
- **Remain entirely on TypeScript 6:** rejected because the application compiler path is compatible
  with TypeScript 7 and can benefit from the native implementation now.
- **Disable linting:** rejected because lint is a required CI quality gate.
- **Patch or fork `typescript-eslint`:** rejected because Microsoft publishes a supported
  compatibility package and the upstream API transition is temporary.

## Validation

- `pnpm exec tsc --version` reports TypeScript 7.0.2.
- `pnpm exec tsc6 --version` reports TypeScript 6.0.3 from compatibility package 6.0.2.
- Importing the `typescript` module reports TypeScript API version 6.0.3 for API-dependent tooling.
- `pnpm typescript:check` enforces the exact aliases, package identities, binary roles, and API major
  in CI.
- Formatting, lint, schema generation checks, type-checking, unit tests, production builds, security
  header checks, dependency audit, and maintained browser gates pass.

## Related decisions

- [ADR-004](ADR-004-Technology-Stack.md)
- [Technology stack](../16-TECHNOLOGY-STACK.md)
- [Quality baseline](../17-QUALITY-BASELINE.md)
