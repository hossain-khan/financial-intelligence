# ADR-016: Deterministic qualification harness for browser, accessibility, and performance

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

By the end of Phase 3 the app has four representative flows (CSV/OFX/PDF import, PWA lifecycle,
encrypted backup/restore) and documented budgets — NFR-020 (≤2 s warm shell), NFR-021 (≤200 ms
filter/sort), NFR-022 (≤1 s dashboard), NFR-023 (≥10k CSV rows/s), NFR-024 (<50 ms main-thread
tasks), NFR-025 (bounded DOM), and the WCAG 2.2 AA journeys (NFR-040..044). What was missing was a
**repeatable, versioned way to prove those budgets on representative workloads** and to expand
accessibility coverage to the journeys added since the original quality baseline. Issue #29 asks for
that harness without making unreproducible benchmark claims or coupling instrumentation into feature
code.

## Decision

Add a deterministic qualification harness with three parts and an informational-first CI posture.

**Seeded, reconciled synthetic workloads** live in a new framework-independent
`packages/qualification`. A seeded LCG and a counter-derived (parser-accepted, v4-shaped) UUID
factory make generation byte-for-byte reproducible; `generateWorkload(config)` builds a valid
workspace (accounts, starter categories, merchants, rules, and `CommitAcceptedImport`-shaped
candidates) reconciled with decimal-safe inflow/outflow/net totals. A workload manifest records the
generator version, seed, config, record counts, byte size, content digest, and expected totals, so a
data change can never masquerade as a performance change. Nothing derives from a real statement;
amounts are always exactly two decimal places to satisfy both `Money` and the candidate validator,
and one source row maps to exactly one candidate to satisfy the commit invariant.

**A versioned result schema** (`PerfResult`) records commit/dirty/node/pnpm/browser/OS/hardware,
workload digest+label, cold/warm mode, iterations, raw samples, median, p95, nullable memory,
threshold, threshold direction, and pass/fail. `compareResults` compares **only matching environment
profiles**: a changed environment, browser, or workload digest is a *new baseline*, never an
automatic regression. An `assertNoSensitiveContent` guard restricts every artifact to an allow-list
of keys carrying only timings, counts, digests, and identifier/timestamp strings — it rejects any
free-text (a transaction description) or money-like value, so artifacts can be uploaded safely.

**User-visible timing** is captured with `performance.mark`/`measure` at interaction boundaries
(shell→interactive, import preview vs. commit, ledger render/filter, dashboard query→render). The
marks carry only stable names and are effectively free in normal use; a `PerformanceObserver`-backed
reader is installed on `window.__perf` **only** when `?perf=1` is present, so production sessions pay
no observer or sample-retention cost. A Playwright `perf` project (Chromium, its own directory)
seeds a workload through the supported import UI, runs warmups + iterations, asserts bounded DOM as a
hard correctness check (NFR-025), and writes a schema-valid, privacy-checked JSON artifact.

**CI is informational first.** A non-blocking `performance` job runs the 1k PR-smoke tier, validates
the artifact with `scripts/check-perf-result.mjs`, and uploads it; it never fails the build while
CI-runner variance is characterised. Promotion of a stable, high-signal budget to a blocking gate is
a documented future review; a threshold is never loosened merely to pass. PR smoke is 1k/10k; 50k is
a scheduled/release-candidate workload and the 250k NFR bound is a documented config change, not a
per-PR run.

**Accessibility and capability.** The existing axe/keyboard/reduced-motion/320px/network-guard
pattern is extended to the ledger, dashboards (with chart→table equivalents per NFR-042), and
backup/restore journeys. Core no-AI qualification must pass **without WebGPU**; WebGPU/WASM/worker/
persistence/install capability is recorded as informational input for Phase 4, never a core pass
condition.

## Consequences

### Positive

- Budgets are measured on reproducible, reconciled workloads with environment-aware comparison, so a
  regression is distinguishable from a data or environment change.
- Artifacts are provably free of financial content by construction.
- Timing instrumentation adds no production overhead and lives outside feature logic.
- Accessibility coverage now spans every critical Phase 1–3 journey.

### Negative

- CI perf numbers on shared runners are noisy; they are informational until variance is understood,
  so they do not yet block regressions.
- End-to-end UI measures (e.g. import throughput measured through the full mapping/commit UI) are
  higher than the raw-operation NFR figures; interpreting them requires the recorded environment and
  the understanding that the release budgets are confirmed on pinned physical reference devices.
- The project now owns a workload generator that must track domain-factory changes.

## Alternatives considered

- **Micro-benchmarks of internal functions only:** rejected — they miss the user-visible latency the
  NFRs actually target. The harness prefers `performance.measure` at interaction boundaries.
- **Blocking perf gate from day one:** rejected — CI-runner variance would produce flaky failures the
  issue explicitly warns against; informational-first with a documented promotion path is safer.
- **Random (`Math.random`) fixtures:** rejected — non-reproducible and unavailable in some sandboxes;
  a seeded LCG makes a workload's digest stable across runs.
- **Deriving fixtures from a real statement:** rejected outright — all workloads are synthetic.

## Validation

- `packages/qualification` unit tests: determinism (same seed ⇒ same digest), reconciliation
  invariants, one-row-per-candidate, 2dp amounts, result-schema validation, environment-profile
  comparison (mismatch ⇒ new baseline), and the privacy guard (rejects descriptions/amounts/free
  text; allows identifiers/timestamps/digests).
- The Playwright `perf` project produces a valid, privacy-clean artifact and asserts bounded DOM
  (50 ledger rows) on a 1k workload; `scripts/check-perf-result.mjs` validates and compares it.
- New accessibility spec: ledger, dashboard (table equivalent), and backup/restore pass axe WCAG
  2.2 AA under the network guard, alongside the existing import/onboarding/PWA/quality-baseline axe
  coverage.

## Related decisions

- [ADR-004](ADR-004-Technology-Stack.md)
- [ADR-009](ADR-009-Cloudflare-Workers-Static-Hosting.md)
- [ADR-014](ADR-014-PWA-Update-And-Cache-Lifecycle.md)
- [Quality baseline](../17-QUALITY-BASELINE.md)
- [Qualification matrix](../22-QUALIFICATION-MATRIX.md)
- [Non-functional requirements](../06-NON-FUNCTIONAL-REQUIREMENTS.md)
