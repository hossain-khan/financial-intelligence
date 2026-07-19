# ADR-003: WebGPU as Optional Local AI Acceleration

- Status: Accepted
- Date: 2026-07-19
- Decision owners: Project maintainers

## Context

Local models can assist uncertain classification and language tasks without transmitting data, but hardware, memory, browser support, model licenses, and runtime quality vary. Making WebGPU mandatory would exclude users and incorrectly couple core financial logic to model availability.

## Decision

Support WebGPU as a preferred acceleration path for an optional browser-local AI provider when capability checks and selected runtime/model benchmarks pass. WebGPU is not required for importing, rules, manual classification, dashboards, query execution, backup, or any core workflow.

Local models are explicitly downloaded, integrity checked, removable, and identified by task capability, source, version, license, size, and memory estimate. The provider interface must allow WASM/CPU fallback or no-AI behavior without changing domain logic. There is no automatic remote fallback.

This ADR does not select a specific model or runtime; that requires benchmark, license, accessibility/resource UX, and security evidence closer to implementation.

## Consequences

### Positive

- Strong privacy option for model-assisted features.
- GPU acceleration can make small-model inference practical in the browser.
- Task/provider abstraction preserves model and runtime replaceability.

### Negative

- Device/browser fragmentation and out-of-memory failures.
- Large downloads, storage use, power consumption, and update costs.
- Model supply-chain and license obligations.
- Local does not automatically mean safe; malicious assets/runtime remain risks.

### Required mitigations

- Capability check before download and a clear rules-only alternative.
- User-initiated, cancelable download with digest verification and removal.
- Worker isolation, resource/batch limits, and safe out-of-memory recovery.
- Evaluation harness for accuracy, abstention, invalid output, latency, and memory.
- Content/security review of runtimes and model provenance.

## Alternatives considered

- **Remote AI only:** broader model quality/device reach, rejected as a default because it transmits data and requires connectivity.
- **WASM/CPU only:** broader compatibility but potentially poor latency; retained as an optional fallback if benchmarks justify it.
- **No AI:** fully viable for the core and remains a supported mode, but optional AI may reduce review effort and improve natural-language access.

## Validation

- Published task benchmarks on the supported device/browser matrix.
- Model download, integrity, cache removal, cancellation, and OOM tests.
- Local-mode network assertion during inference.
- No-AI end-to-end suite remains green.

## Related decisions

- [ADR-001](ADR-001-Offline-First.md)
- [AI architecture](../08-AI-ARCHITECTURE.md)
