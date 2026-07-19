# Design Principles

## Purpose

Translate the vision into rules for product, design, architecture, and implementation decisions.

## Principles

### 1. Privacy is the default state

Opening, importing, classifying, searching, and visualizing data must not require a server. Network features are visibly separate, disabled by default, and disclose the destination and payload class before use. Privacy must not depend on reading a policy.

### 2. The user owns both records and learning

Transactions, categories, rules, corrections, preferences, and model-independent learning can be exported. Formats are documented and versioned. Export is not reserved for paid accounts, and deletion is available without contacting a service operator.

### 3. Determinism earns trust

Exact mappings, user rules, transfer matches, arithmetic, and validation run before probabilistic systems. The same deterministic input and configuration produce the same result. A model never silently overrides a locked user decision.

### 4. Automation remains reviewable

Every inferred field records method, confidence, and supporting evidence. Uncertain or materially important decisions enter a review queue. Bulk actions show scope and are undoable within the current data history.

### 5. Preserve provenance

Normalized records retain import ID, source row or page reference, original description, original amount representation, and transformations. A user can move from a chart aggregate to a transaction and then to its source evidence.

### 6. Learn deliberately

Not every edit should become a permanent rule. The interface distinguishes one-time corrections from reusable learning. New rules are specific by default, show expected matches, detect conflicts, and can be disabled or deleted.

### 7. Degrade gracefully

The product works without WebGPU, without a model, without a network, and with a partial statement parser. Unsupported capabilities explain what is missing and offer safe alternatives such as CSV mapping or rules-only classification.

### 8. Make the safe path easy

Defaults favor local processing, encrypted backups, minimal plugin permissions, session-only API keys, conservative deduplication, and explicit confirmation for destructive operations. Advanced controls remain discoverable without overwhelming first-time users.

### 9. Separate facts, inferences, and opinions

Posted amount and date are facts from a source. Merchant identity and category may be inferences. Recommendations are opinions. The UI and data model label each accordingly and never describe an estimate as a guarantee.

### 10. Design for diverse financial realities

Support multiple accounts, currencies, date formats, income patterns, category systems, assistive technologies, and household structures. Do not assume monthly salaries, US institutions, or a single checking account.

### 11. Performance is a feature

Import and analysis must remain responsive for realistic household histories. Long work runs off the main UI path, reports progress, supports cancellation, and commits atomically.

### 12. Open contracts, replaceable components

Domain contracts must not depend on one framework, AI model, provider, or statement vendor. Parsers, classifiers, storage adapters, visualizations, and plugins use versioned boundaries that can be tested independently.

## Decision test

When alternatives are otherwise comparable, choose the option that:

1. sends less data to fewer places;
2. is easier for a user to explain and reverse;
3. preserves more source evidence and portability;
4. works without AI or a network;
5. has the smaller permanent compatibility surface.

Trade-offs that violate a principle require an ADR, a user-visible mitigation, and a clear exit path.

## Examples

| Situation | Preferred decision |
| --- | --- |
| A merchant was previously confirmed | Apply a versioned rule; do not ask a model |
| A remote model might improve an insight | Show a data preview and obtain opt-in first |
| Two imports may overlap | Flag likely duplicates; preserve both until confirmed |
| Browser storage is nearing quota | Pause safely and guide export/cleanup; do not evict silently |
| An edit affects 500 transactions | Preview count and examples, then make the action undoable |

## Related documents

- [Vision](00-VISION.md)
- [System architecture](07-SYSTEM-ARCHITECTURE.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
- [UX guidelines](13-UX-GUIDELINES.md)
