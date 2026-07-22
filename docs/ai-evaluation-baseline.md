# AI evaluation baseline and threshold rationale

This report records the initial evaluation baseline established in issue #32 and the rationale for
the checked-in threshold policy. It is a living document: each provider evaluated in #33–#35 appends
its measured baseline and reviewed support record.

## Status

No real provider has been measured yet. The only profiles exercised so far are the six synthetic
fake providers used to self-test the harness. Quality thresholds below are therefore **provisional**,
derived from the perfect-provider baseline; the **safety gates are final** and apply to every
provider.

## Corpus

- 12 synthetic cases across `merchant.resolve.v1`, `category.classify.v1`, and `query.plan.v1`
  (`insight.word.v1` fixtures follow when its runtime lands).
- Coverage: merchant noise, multilingual (fr-CA), unseen merchant, transfer-like (abstain),
  category collision, adversarial prompt-injection with a `mustNotEcho` token, grounding/invalid-id,
  ambiguous date (abstain), and unsupported query intent (abstain).
- Locked by `packages/ai-evaluation/fixtures/digests.json` (SHA-256 over canonical JSON) and
  validated by the fixture linter (rejects account/email/key/money-shaped values).

## Measured fake-provider baseline

Run in-process (no model, no network), so latency reflects harness overhead only:

| Provider | Accuracy (answerable) | Abstention recall | Invalid-output rate | Grounding violations | Privacy violations |
| --- | --- | --- | --- | --- | --- |
| perfect | 1.0 | n/a | 0 | 0 | 0 |
| abstaining | n/a | 1.0 | 0 | 0 | 0 |
| malformed | 0 | n/a | > 0 | 0 | 0 |
| leaky | — | — | 0 | 0 | > 0 (gate fails) |

## Threshold policy (v1.0.0)

Safety gates (hard, cannot be averaged away by accuracy):

- allowed-ID grounding violations: **0**;
- privacy/redaction violations: **0**;
- unexpected network destinations: **0** (in-process harness; enforced structurally today);
- invalid-output rate: **≤ 2%**.

Quality/latency gates (provisional, fake-derived; bind a real provider from #33):

- accuracy ≥ **0.80**;
- abstention recall ≥ **0.70**;
- latency p95 ≤ **2000 ms**.

Rationale: the safety gates encode non-negotiable correctness/privacy invariants and are set at their
only defensible values. The quality/latency numbers are placeholders chosen to be clearly achievable
by a competent classifier and clearly failed by a broken one; they will be re-derived from the first
real browser-local model's measured results in #33 and recorded here, per the "do not invent final
accuracy numbers before running the baseline" rule.

## Browser-local provider (`ai-local`, #33)

The `gemma-3n-e2b-q4-classifier-v1` profile (transformers.js 4.2.0, ONNX Runtime Web; see
[ADR-020](adr/ADR-020-Browser-Local-AI-Runtime.md)) is **pinned** from the #33 runtime/model spike.

### Spike findings (manual, single-example)

Run in-browser on WebGPU with `@huggingface/transformers@4.2.0` loading
`onnx-community/gemma-3n-E2B-it-ONNX` at revision `d3068b2ea2b9e9de85b33cb356121c4ca0510c0c`:

| Observation | Result |
| --- | --- |
| `q4f16` dtype | ❌ ORT Web session-creation crash — float16/float32 mismatch in Gemma 3n's AltUp block |
| `q4` dtype | ✅ loads (first download ~3.28 GB; cached load ~3–4 s) |
| Classification (chat-templated) | ✅ correct category, sensible confidence + rationale, ~3–4 s inference |
| Output format | JSON wrapped in a ```` ```json ```` fence; the provider now strips fences before parsing |
| Token budget | 64 tokens truncated the rationale mid-sentence; raised to 256 with a one-sentence-rationale prompt |

This was a **single-example manual spike**, not a corpus run — it establishes viability and pins the
profile, not a support verdict.

### Still pending

A full evaluation of the pinned model through the #32 corpus (accuracy, abstention precision/recall,
invalid-output rate, latency percentiles) has not been run. It requires driving the real WebGPU engine
over the corpus on the maintainer's hardware; the numbers and a support record are recorded here after
that run.

| Metric | Value |
| --- | --- |
| Model repo / revision | `onnx-community/gemma-3n-E2B-it-ONNX` @ `d3068b2` |
| dtype | `q4` |
| Corpus accuracy / abstention / latency p95 | PENDING full #32 evaluation run |
| Support status | not yet evaluated (single-example viability only) |

## Support records

None yet. A provider is marked `supported`, `experimental`, or `failed` per task and device tier,
with reviewer and date, only after it is measured against this corpus and clears the gates. The
browser-local Gemma 3n profile is pinned and loads, but has not completed a corpus evaluation.
