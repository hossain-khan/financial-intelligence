# AI Architecture

## Purpose

Define where probabilistic models add value, how local and remote providers are abstracted, and how privacy, validation, and explainability are enforced.

## Scope

AI may assist merchant normalization, uncertain categorization, natural-language query planning, and concise insight wording. It is not responsible for parsing authoritative amounts, monetary arithmetic, duplicate deletion, transfer confirmation, data mutation, or financial advice.

## Core rule

AI is an optional classifier and interface layer, not the ledger. The application remains useful and correct when every provider is unavailable.

## Task model

Providers accept named, versioned tasks with JSON input/output schemas:

| Task | Input minimization | Output |
| --- | --- | --- |
| `merchant.resolve.v1` | Normalized description tokens; optional country/category hints | Candidate merchant label, confidence, evidence codes |
| `category.classify.v1` | Redacted description/merchant, direction, allowed categories | Category ID, confidence, concise rationale |
| `query.plan.v1` | User question, metric/dimension vocabulary, available date range | Validated read-only query plan |
| `insight.word.v1` | Deterministic aggregate facts | Plain-language summary with fact references |

Raw source documents, account identifiers, unrelated transactions, notes, and full history are excluded unless a future separately consented task explicitly requires them.

## Classification pipeline

1. Honor locked user decisions.
2. Apply transaction-specific overrides.
3. Apply deterministic rules by precedence and specificity.
4. Resolve canonical merchant aliases.
5. Apply versioned heuristics.
6. If unresolved and eligible, invoke the selected provider.
7. Validate response schema, allowed IDs, confidence range, and safety constraints.
8. Store the inference with method/version/evidence, or route to review.

A model cannot overwrite stages 1–4. A provider error yields `unclassified` or preserves the best deterministic candidate.

## Provider types

### No AI

Always available. Returns unsupported for model tasks while leaving rules, review, analysis, and dashboards functional.

### Browser-local

Runs an explicitly downloaded model using a compatible browser runtime, potentially WebGPU with a WASM/CPU fallback if practical. The model package has a declared source, license, size, digest, memory estimate, supported tasks, and deletion control. WebGPU is an optimization, not a core requirement; see [ADR-003](adr/ADR-003-Why-WebGPU.md).

### Self-hosted

Targets a user-specified compatible endpoint. Loopback and LAN endpoints still count as remote from the browser privacy boundary. Connection tests send only a health/capability request. CORS and TLS limitations are explained rather than bypassed.

### Bring your own key

Targets a supported provider adapter or OpenAI-compatible API. The app shows provider, endpoint origin, task, field classes, estimated volume/cost when possible, retention-policy reminder, and consent state. Provider-specific SDK types do not leak into the domain contract.

## Provider contract

Each adapter reports:

- stable provider profile ID and adapter version;
- local/self-hosted/remote execution location;
- supported task IDs and context/output limits;
- structured-output and streaming capabilities;
- model identity requested and model identity reported;
- health without sensitive payload;
- timeout, cancellation, and normalized error codes.

The router selects only an explicitly enabled profile that supports the task. There is no silent fallback from local to remote.

## Consent and data disclosure

Consent is versioned by provider profile and disclosure template. A material change in endpoint origin, task payload, retention assumptions, or adapter behavior requires renewed consent. The first request shows representative field names and redacted values. Users can revoke consent and clear profile history without deleting classifications already accepted.

## Secret handling

- Keys are held in memory for the session by default.
- Persistent key storage is opt-in and must use the strongest practical platform protection; a web app cannot promise hardware-grade secrecy.
- Keys never enter URLs, IndexedDB records used for exports, service-worker caches, logs, error reports, plugins, or prompts.
- A provider profile references a secret handle, never the secret value, in portable configuration.

## Prompt and input safety

Transaction descriptions and imported text are untrusted content. Prompts wrap data in typed JSON and instruct the model that source fields are data, not instructions. More importantly, output authority is structurally limited: models choose only from allowed IDs or produce a constrained query plan. No model output is executed as code or rendered as raw HTML.

## Structured output validation

Model output must pass:

1. strict JSON parse and task schema validation;
2. allowed enum/ID checks against the current workspace;
3. numeric range and length bounds;
4. no unknown executable fields;
5. policy checks for advice, unsupported mutation, or data exfiltration attempts.

Repair may retry once with validation errors but never guesses a category from malformed text. Repeated failure routes to review.

## Explainability and confidence

The UI exposes decision evidence, not hidden reasoning traces. Evidence examples: `matched_alias`, `matched_rule`, `similar_confirmed_merchant`, `model_category_candidate`, and `insufficient_evidence`. Confidence thresholds are task- and classifier-version-specific and calibrated on synthetic/public fixtures plus user-confirmed outcomes locally.

Suggested policy:

- `>= 0.90`: may auto-apply if no conflict and task permits;
- `0.60–0.89`: apply as suggested and queue for review;
- `< 0.60`: remain unclassified unless the user requests suggestions.

These defaults require validation before release and must not imply universal probability accuracy.

## Natural-language questions

The model does not receive a database or calculate totals. It produces a constrained query plan containing metric, dimensions, filters, period, comparison, and sort/limit. The local engine validates and executes it. An answer formatter receives only the resulting fact table and reference IDs. The UI displays interpretation and lets the user open the exact contributing transaction query.

## Cost and resource controls

- Batch eligible classifications using bounded payloads.
- Deduplicate exact task inputs without retaining remote payload logs.
- Enforce per-operation record/token/time budgets.
- Show local model download, estimated memory, and device capability.
- Show estimated remote cost range when provider pricing configuration is available; label it as an estimate.
- Support cancellation and never retry billing requests indefinitely.

## Model evaluation

Release a task-specific evaluation harness with synthetic, public, and generated adversarial descriptions across locales. Track accuracy, abstention, calibration, invalid-output rate, latency, memory, and rule-vs-model utilization. Do not commit real user prompts. Provider/model upgrades require evaluation and a classifier-version change.

## Failure modes

- Unsupported device: offer rules-only mode or a user-configured provider.
- Model download interrupted: verify chunks/integrity and resume or restart safely.
- Out of memory: unload model, preserve work, reduce batch/model, explain options.
- Provider rate limit: stop, show retry-after when available, keep items reviewable.
- Model drift/provider alias change: record reported model and warn if it differs from configuration.
- Hallucinated category: reject any ID not in the allowed set.

## Open questions

- Select local runtime/model only after benchmark and license review; model names from early ideation are candidates, not commitments.
- Decide whether embeddings add enough value to justify portability and privacy complexity; v1 rules do not require them.
- Define provider pricing metadata maintenance without network telemetry.

## Related documents

- [Learning engine](10-LEARNING-ENGINE.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [AI provider schema](../schemas/ai-provider.schema.json)
