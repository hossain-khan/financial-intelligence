# ADR-022: AI-assisted suggestions persisted separately, with provenance

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

ADR-018 established a provider-neutral AI core with task contracts and a no-AI default; ADR-019 the
evaluation harness and release thresholds; ADR-020/021 the browser-local runtime and one-click model
acquisition. Those decisions built the machinery to run a local model but stopped short of a feature
that consumes it. Issue #36 adds the first consumer: the model proposes a merchant or category for
unresolved transactions, and the user reviews each proposal.

This raises questions the earlier ADRs deliberately left open. Where do proposals live before the
user acts on them? How does accepting one interact with the deterministic classification precedence
(`docs/10-LEARNING-ENGINE.md`) and the existing atomic correction path? How is an AI-sourced
decision distinguished from a user decision afterwards? And how do we avoid re-proposing something
the user already rejected — without persisting raw prompts or model transcripts, which the privacy
rules forbid?

## Decision

- **Suggestions are persisted separately from canonical classifications.** A new additive IndexedDB
  store (`aiSuggestions`, schema v11) holds `PersistedSuggestion` records with status
  `pending | accepted | rejected | stale | invalid`. AI output never mutates a canonical transaction
  record directly. A suggestion carries only bounded, user-facing provenance — task/prompt/minimizer/
  classifier versions, a redacted request-audit id, evidence codes, a short rationale, and the
  provider identity — **never raw prompts, responses, or hidden reasoning**.
- **Accept flows through the existing atomic correction path.** `ApplyReviewCorrectionUseCase` is
  extended with an optional `provenance`. Accepting a suggestion re-checks eligibility (the target
  still exists, its `updatedAt` is unchanged, and precedence still leaves it unresolved), then applies
  the edit — optionally creating a rule or merchant alias — recording `method: localAi` (or
  `remoteAi`) with the classifier id/version, confidence, and evidence. The applied classification is
  **unlocked and reviewable**: a user or a higher-precedence rule can still override it.
- **Review-only default; nothing auto-applies.** Every proposal defaults to review. Auto-apply is a
  future change gated on a #32-backed corpus support verdict plus explicit user opt-in; the pinned
  model is `experimental` until then.
- **Precedence is reused, not reimplemented.** Eligibility and the accept-time recheck both call the
  existing `deriveReviewQueueItem` oracle, so locks, exact overrides, explicit rules, and confirmed
  merchant mappings always win over an AI suggestion, exactly as documented.
- **Rejection memory is keyed to `(normalized-description digest, classifierVersion)`.** A rejected
  record suppresses re-proposing the identical candidate until the classifier version changes. The
  digest is the same normalized description the model saw; no raw content is stored to achieve this.
- **Staleness anchors on `updatedAt`, not a numeric revision.** Transactions have no per-record
  numeric revision, so a suggestion pins the target's `updatedAt`; any later edit (which bumps
  `updatedAt`) or a newly-resolving rule/mapping makes the suggestion `stale` and unappliable.

## Consequences

- The accept path now carries optional provenance; without it, the path behaves exactly as before
  (user decision, locked as today). Existing callers are unaffected.
- A v11 additive migration adds the `aiSuggestions` store; prior versions upgrade without data loss
  (matrix + v10→v11 preservation tests).
- Suggestions survive reload, powering durable staleness and rejection memory without holding model
  output in memory.
- Auto-apply remains a deliberate future step behind an evaluation gate and opt-in, not an incremental
  default.
- CI exercises the whole pipeline with fake/scripted providers; real on-device generation is verified
  manually (headless WebGPU is out of CI scope).

## Alternatives considered

- **Accept as a plain user correction (no provenance):** rejected — it discards the fact that a
  decision was AI-assisted, defeating explainability and any future audit or opt-in auto-apply.
- **Hold suggestions only in memory:** rejected — loses staleness and rejection memory across reloads
  and re-imports, so the same rejected candidate would keep reappearing.
- **Let AI write canonical classifications directly (with a flag):** rejected — violates the
  review-only default and the precedence contract, and makes accidental auto-apply one bug away.
- **Persist the prompt/response for richer rationale:** rejected — the privacy rules forbid storing
  model transcripts; bounded evidence codes and a short rationale are sufficient and safe.

## Validation

- Application-layer unit tests: eligibility reuses `deriveReviewQueueItem` (locks/rules/mappings
  excluded, conflicts stay eligible); batching dedup + orchestrator (grounding, confidence gate,
  injection-as-data); accept staleness recheck + `localAi` provenance; reject; rejection memory.
- Storage tests: v11 migration matrix, v10→v11 preservation, and `IndexedDbAiSuggestionRepository`
  CRUD + rejection-key reconstruction.
- Web section tests (injected fake controller) and an accept-to-rule **repeat-import** e2e: accept
  "for similar" creates a rule → a later import is classified by the rule with no new suggestion, and
  the flow issues zero external network requests.

## Related decisions

- [ADR-018: Provider-neutral AI core, task contracts, and no-AI default](ADR-018-Provider-Neutral-AI-Core.md)
- [ADR-019: AI evaluation harness and release thresholds](ADR-019-AI-Evaluation-Harness.md)
- [ADR-020: Browser-local AI runtime](ADR-020-Browser-Local-AI-Runtime.md)
- [ADR-021: One-click browser-local model download](ADR-021-One-Click-Model-Download.md)
- [ADR-008: Atomic operation journals and revision-consistent snapshots](ADR-008-Atomic-Operation-Journals-And-Revision-Snapshots.md)
- `docs/10-LEARNING-ENGINE.md` — classification precedence this decision reuses.
