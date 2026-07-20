# Learning Engine

## Purpose

Specify how the product becomes more useful from corrections without becoming opaque, irreversible, or dependent on a model.

## Goals

- Reduce repeat classification work.
- Preserve user authority and explain every learned outcome.
- Prefer compact, portable rules over opaque model state.
- Avoid overgeneralizing from a single correction.
- Keep behavior deterministic, versioned, previewable, and reversible.

## Non-goals

- Training a foundation model in the browser.
- Exporting raw histories or embeddings as required learning state.
- Automatically creating broad rules from every edit.
- Inferring personal attributes, creditworthiness, or sensitive life events.

## Sources of knowledge

1. User-created categories and merchants.
2. Explicit reusable rules.
3. Confirmed merchant aliases.
4. Confirmed/dismissed recurring series.
5. Locked transaction-level corrections (local only).
6. Versioned built-in heuristics (application code, not user Brain).
7. Optional AI suggestions (never authoritative learning until confirmed).

## Decision precedence

```text
locked field
  > exact transaction override
  > explicit user rule (priority, then specificity)
  > confirmed merchant mapping
  > built-in heuristic
  > optional AI suggestion
  > unclassified
```

Within user rules, higher explicit priority wins. Equal-priority compatible actions merge; incompatible actions form a conflict. Specificity is a deterministic score based on condition types and count, not model judgment. Rule ID provides stable ordering only for reproducibility and must not hide a conflict.

## Correction workflow

When a user changes a category or merchant, offer:

- **Only this transaction:** lock the field locally; create no reusable rule.
- **Similar transactions:** propose a narrowly scoped rule, with current and future match description.
- **All from this merchant:** use the canonical merchant ID where confirmed.

Before activation, show match count, representative matches, records that would change, locked records that will not change, and conflicts. Default to the narrowest rule that explains the confirmed examples.

## Rule conditions

Initial safe predicates:

- normalized description equals/contains/starts-with token sequence;
- merchant ID equals;
- account ID/type equals;
- direction equals inflow/outflow;
- amount equals or falls in an inclusive decimal range;
- date month/day or weekday, used only with another condition;
- existing tag/category equals.

Avoid arbitrary JavaScript and unbounded backtracking regex. A future regex predicate requires a safe engine, length/time limits, and explicit advanced UI.

## Rule actions

- assign merchant;
- assign category;
- add/remove bounded tags;
- mark reviewed or ignored for selected analysis;
- propose recurring membership.

Rules do not delete transactions, pair transfers, initiate remote AI, or mutate source facts.

## Merchant memory

A canonical merchant has explicit aliases. Aliases use normalized exact/token-prefix matching by default. Location numbers, terminal IDs, dates, and reference numbers may be removed by a versioned normalizer, while original descriptions remain intact. When aliases collide between merchants, classification abstains and routes to review.

## Rule generation

Generation may use heuristics or AI to propose conditions, but the stored rule is a typed deterministic object. The proposal includes rationale and expected scope. No hidden prompt, embedding, or model-specific state is required to execute it later.

## Confidence and review

Deterministic exact matches may have evidence strength rather than artificial probability. Heuristics and AI provide calibrated confidence. Review priority combines uncertainty, amount magnitude, rule conflict, novelty, and effect on major aggregates. Magnitude prioritization must not imply that small transactions are unimportant; users can change sorting.

## Feedback and model use

Confirmed results can be used locally to evaluate classifiers and propose rules. They are never uploaded for provider training by the application. Remote requests follow the provider consent boundary independently. The system tracks classifier version so a model upgrade does not masquerade as unchanged behavior.

## Re-evaluation

Rule create/edit/disable, merchant merge, normalizer upgrade, and classifier change can affect existing records. The engine produces an impact plan, excludes locked fields, and applies accepted changes atomically. Large re-evaluation runs in a worker and is cancelable before commit.

## Version history and undo

Brain-level objects have `createdAt`, `updatedAt`, and stable IDs. Local operation history stores before/after patches for a bounded retention period or count. Exported Brain snapshots declare creation time and application/schema version. Users may keep successive files; v1 does not implement a Git-like distributed history inside one Brain document.

Financial Brain preview is bound to both an input digest and the current learning-store revision.
Apply rejects a changed file, stale revision, unresolved conflict, or unacknowledged semantic
duplicate before mutation. Categories, merchants, rules, recurring knowledge, and the operation
journal then commit atomically. Undo restores additions and updates only when every current record
still equals the recorded after-state.

A correction that also creates a deterministic rule or merchant alias uses the same atomic port as
the transaction correction. UI outcome messages contain object counts and safe conflict guidance,
not transaction descriptions or amounts.

## Brain export

Portable learning includes categories, merchants/aliases, rules, recurring decisions, and safe preferences. It deliberately excludes transaction overrides because they reference raw local records. Export validates against schema and summarizes contents.

## Brain merge

Merge algorithm:

1. Validate both schema versions and migrate in memory when supported.
2. Match identical stable IDs.
3. Detect semantic duplicates (normalized merchant name/alias, category path, canonicalized rule).
4. Auto-merge identical objects and non-overlapping fields.
5. Present incompatible names, parentage, aliases, rule actions, or priorities as conflicts.
6. Preview additions/changes and apply atomically after confirmation.
7. Emit a merge report with no raw transactions.

Never silently choose between conflicting category assignments.

## Quality measurement

Measured locally:

- coverage: share classified before AI/manual review;
- precision from confirmed/rejected outcomes;
- abstention and conflict rates;
- corrections per 100 new transactions;
- rule utilization and stale-rule count;
- incorrect auto-application reversals.

Metrics remain on device unless explicitly exported as redacted diagnostics.

## Failure and abuse controls

- Broad rule: warn on high match count/diverse merchants and require confirmation.
- Conflicting rules: abstain rather than choose by accidental order.
- Poisoned import descriptions: treat as data and enforce bounded typed predicates.
- Bad model suggestions: validate allowed IDs and require confidence/review policy.
- Stale rule: surface rules not matched for a configurable period; never delete automatically.
- Merge collision: preserve both disabled or require explicit resolution.

## Examples

```text
Description: TIM HORTONS #145 OSHAWA ON
User confirms merchant: Tim Hortons
User confirms category: Restaurants

Proposed alias: normalized description starts with "tim hortons"
Proposed action: merchant = Tim Hortons
Merchant default rule: category = Restaurants
Current matches: 18; changes: 16; locked: 2; conflicts: 0
```

The system stores typed alias/rule objects, not the prose above.

## Related documents

- [AI architecture](08-AI-ARCHITECTURE.md)
- [Data model](09-DATA-MODEL.md)
- [Phase 2 implementation and hardening](20-PHASE-2-IMPLEMENTATION.md)
- [Financial Brain schema](../schemas/financial-brain.schema.json)
