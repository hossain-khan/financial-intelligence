import type { TransactionId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";
import type { Transaction } from "./transaction";

export type DuplicateKind = "exact" | "likely";
export type DuplicateEvidenceCode =
  "source-transaction-id" | "fingerprint" | "amount" | "posted-date" | "description";

export interface DuplicateFingerprint {
  readonly transactionId: TransactionId;
  readonly value: string;
}

export interface DuplicateEvidence {
  readonly code: DuplicateEvidenceCode;
  readonly weight: number;
  readonly detail: string;
}

export interface DuplicateCandidate {
  /** Stable for a given pair, independent of input ordering. */
  readonly id: string;
  readonly existingTransactionId: TransactionId;
  readonly incomingTransactionId: TransactionId;
  readonly kind: DuplicateKind;
  /** Integer basis points in the inclusive range 0..10,000. */
  readonly score: number;
  readonly evidence: readonly DuplicateEvidence[];
}

export interface DetectDuplicateCandidatesInput {
  readonly existing: readonly Transaction[];
  readonly incoming: readonly Transaction[];
  readonly fingerprints?: readonly DuplicateFingerprint[];
  readonly likelyDateWindowDays?: number;
  readonly likelyMinimumDescriptionSimilarity?: number;
}

const DAY_MILLISECONDS = 86_400_000;

/**
 * Produces account-scoped duplicate candidates without using time, locale, or
 * collection iteration order as hidden inputs.
 */
export function detectDuplicateCandidates(
  input: DetectDuplicateCandidatesInput,
): readonly DuplicateCandidate[] {
  const dateWindow = input.likelyDateWindowDays ?? 3;
  const minimumSimilarity = input.likelyMinimumDescriptionSimilarity ?? 0.5;
  if (!Number.isInteger(dateWindow) || dateWindow < 0 || dateWindow > 31) {
    throw new RangeError("Likely duplicate date window must be an integer from 0 to 31");
  }
  if (minimumSimilarity < 0 || minimumSimilarity > 1) {
    throw new RangeError("Likely duplicate description similarity must be between 0 and 1");
  }

  const fingerprints = new Map(
    (input.fingerprints ?? []).map(({ transactionId, value }) => [transactionId, value]),
  );
  const existingBySourceId = new Map<string, Transaction[]>();
  const existingByFingerprint = new Map<string, Transaction[]>();
  const existingByAmount = new Map<string, Transaction[]>();
  for (const existing of input.existing) {
    if (existing.sourceTransactionId !== undefined) {
      addToBucket(
        existingBySourceId,
        `${existing.accountId}\u0000${existing.sourceTransactionId}`,
        existing,
      );
    }
    const fingerprint = fingerprints.get(existing.id);
    if (fingerprint !== undefined) {
      addToBucket(existingByFingerprint, `${existing.accountId}\u0000${fingerprint}`, existing);
    }
    addToBucket(existingByAmount, amountBucket(existing), existing);
  }
  const candidates: DuplicateCandidate[] = [];
  for (const incoming of input.incoming) {
    const comparisons = new Map<TransactionId, Transaction>();
    if (incoming.sourceTransactionId !== undefined) {
      for (const existing of existingBySourceId.get(
        `${incoming.accountId}\u0000${incoming.sourceTransactionId}`,
      ) ?? []) {
        comparisons.set(existing.id, existing);
      }
    }
    const incomingFingerprint = fingerprints.get(incoming.id);
    if (incomingFingerprint !== undefined) {
      for (const existing of existingByFingerprint.get(
        `${incoming.accountId}\u0000${incomingFingerprint}`,
      ) ?? []) {
        comparisons.set(existing.id, existing);
      }
    }
    for (const existing of existingByAmount.get(amountBucket(incoming)) ?? []) {
      comparisons.set(existing.id, existing);
    }
    for (const existing of comparisons.values()) {
      if (incoming.id === existing.id) continue;
      const exactEvidence = exactMatchEvidence(existing, incoming, fingerprints);
      if (exactEvidence.length > 0) {
        candidates.push(candidate(existing.id, incoming.id, "exact", 10_000, exactEvidence));
        continue;
      }

      const likely = likelyMatch(existing, incoming, dateWindow, minimumSimilarity);
      if (likely !== undefined) candidates.push(likely);
    }
  }
  return candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.existingTransactionId.localeCompare(right.existingTransactionId) ||
      left.incomingTransactionId.localeCompare(right.incomingTransactionId),
  );
}

function amountBucket(transaction: Transaction): string {
  const money = transaction.money.toJSON();
  return `${transaction.accountId}\u0000${money.currency}\u0000${money.amount}`;
}

function addToBucket(
  buckets: Map<string, Transaction[]>,
  key: string,
  transaction: Transaction,
): void {
  const values = buckets.get(key);
  if (values === undefined) buckets.set(key, [transaction]);
  else values.push(transaction);
}

export function normalizeDuplicateDescription(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replaceAll(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replaceAll(/\s+/gu, " ");
}

function exactMatchEvidence(
  existing: Transaction,
  incoming: Transaction,
  fingerprints: ReadonlyMap<TransactionId, string>,
): readonly DuplicateEvidence[] {
  const evidence: DuplicateEvidence[] = [];
  if (
    existing.sourceTransactionId !== undefined &&
    existing.sourceTransactionId === incoming.sourceTransactionId
  ) {
    evidence.push({
      code: "source-transaction-id",
      weight: 10_000,
      detail: `Same source transaction ID: ${existing.sourceTransactionId}`,
    });
  }
  const existingFingerprint = fingerprints.get(existing.id);
  const incomingFingerprint = fingerprints.get(incoming.id);
  if (existingFingerprint !== undefined && existingFingerprint === incomingFingerprint) {
    evidence.push({
      code: "fingerprint",
      weight: 10_000,
      detail: "Same canonical transaction fingerprint",
    });
  }
  return evidence;
}

function likelyMatch(
  existing: Transaction,
  incoming: Transaction,
  dateWindow: number,
  minimumSimilarity: number,
): DuplicateCandidate | undefined {
  const existingMoney = existing.money.toJSON();
  const incomingMoney = incoming.money.toJSON();
  if (
    existingMoney.currency !== incomingMoney.currency ||
    existingMoney.amount !== incomingMoney.amount
  ) {
    return undefined;
  }
  const dayDistance =
    Math.abs(
      Date.parse(`${existing.postedDate}T00:00:00Z`) -
        Date.parse(`${incoming.postedDate}T00:00:00Z`),
    ) / DAY_MILLISECONDS;
  if (dayDistance > dateWindow) return undefined;

  const similarity = descriptionSimilarity(existing.description, incoming.description);
  if (similarity < minimumSimilarity) return undefined;
  const dateWeight = Math.max(0, 2_500 - dayDistance * 500);
  const descriptionWeight = Math.round(similarity * 3_500);
  const score = Math.round(4_000 + dateWeight + descriptionWeight);
  return candidate(existing.id, incoming.id, "likely", score, [
    {
      code: "amount",
      weight: 4_000,
      detail: `Same amount: ${existingMoney.currency} ${existingMoney.amount}`,
    },
    {
      code: "posted-date",
      weight: dateWeight,
      detail: dayDistance === 0 ? "Same posted date" : `Posted dates are ${dayDistance} days apart`,
    },
    {
      code: "description",
      weight: descriptionWeight,
      detail: `Normalized description similarity: ${similarity.toFixed(3)}`,
    },
  ]);
}

function descriptionSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeDuplicateDescription(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeDuplicateDescription(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function candidate(
  existingTransactionId: TransactionId,
  incomingTransactionId: TransactionId,
  kind: DuplicateKind,
  score: number,
  evidence: readonly DuplicateEvidence[],
): DuplicateCandidate {
  return {
    id: `${existingTransactionId}:${incomingTransactionId}`,
    existingTransactionId,
    incomingTransactionId,
    kind,
    score,
    evidence,
  };
}

export type DuplicateResolutionAction = "keep-existing" | "keep-new" | "keep-both" | "manual-link";

export interface DuplicateDecision {
  readonly type: "decision";
  readonly id: string;
  readonly candidateId: string;
  readonly evidenceSignature: string;
  readonly action: DuplicateResolutionAction;
  readonly occurredAt: UtcTimestamp;
}

export interface DuplicateDecisionUndo {
  readonly type: "undo";
  readonly id: string;
  readonly decisionId: string;
  readonly occurredAt: UtcTimestamp;
}

export type DuplicateResolutionEvent = DuplicateDecision | DuplicateDecisionUndo;

export class DuplicateResolutionConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DuplicateResolutionConflictError";
  }
}

export function activeDuplicateDecisions(
  events: readonly DuplicateResolutionEvent[],
): ReadonlyMap<string, DuplicateDecision> {
  const decisions = new Map<string, DuplicateDecision>();
  const undone = new Set<string>();
  for (const event of events) {
    if (event.type === "decision") {
      if (decisions.has(event.id)) {
        throw new DuplicateResolutionConflictError(`Duplicate decision event ID: ${event.id}`);
      }
      decisions.set(event.id, event);
    } else {
      if (undone.has(event.decisionId)) {
        throw new DuplicateResolutionConflictError(`Decision already undone: ${event.decisionId}`);
      }
      if (!decisions.has(event.decisionId)) {
        throw new DuplicateResolutionConflictError(
          `Cannot undo unknown decision: ${event.decisionId}`,
        );
      }
      undone.add(event.decisionId);
    }
  }
  const active = new Map<string, DuplicateDecision>();
  for (const decision of decisions.values()) {
    if (undone.has(decision.id)) continue;
    if (active.has(decision.candidateId)) {
      throw new DuplicateResolutionConflictError(
        `Candidate already has an active decision: ${decision.candidateId}`,
      );
    }
    active.set(decision.candidateId, decision);
  }
  return active;
}

export interface DuplicateResolutionEffects {
  readonly suppressedExistingTransactionIds: ReadonlySet<TransactionId>;
  readonly suppressedIncomingTransactionIds: ReadonlySet<TransactionId>;
  readonly manuallyLinkedCandidateIds: ReadonlySet<string>;
}

export function duplicateEvidenceSignature(candidate: DuplicateCandidate): string {
  return [
    "duplicate-evidence-v1",
    candidate.kind,
    ...candidate.evidence.map(({ code, weight, detail }) => `${code}:${String(weight)}:${detail}`),
  ].join("\u0000");
}

/** Remembered decisions are applicable only while all defining evidence is unchanged. */
export function applicableDuplicateDecisions(
  candidates: readonly DuplicateCandidate[],
  events: readonly DuplicateResolutionEvent[],
): ReadonlyMap<string, DuplicateDecision> {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const applicable = new Map<string, DuplicateDecision>();
  for (const [candidateId, decision] of activeDuplicateDecisions(events)) {
    const current = candidatesById.get(candidateId);
    if (
      current !== undefined &&
      decision.evidenceSignature === duplicateEvidenceSignature(current)
    ) {
      applicable.set(candidateId, decision);
    }
  }
  return applicable;
}

/** Projects persistence effects without mutating either side of the comparison. */
export function projectDuplicateResolutionEffects(
  candidates: readonly DuplicateCandidate[],
  events: readonly DuplicateResolutionEvent[],
): DuplicateResolutionEffects {
  const candidateById = new Map(candidates.map((value) => [value.id, value]));
  const suppressedExisting = new Set<TransactionId>();
  const suppressedIncoming = new Set<TransactionId>();
  const manuallyLinked = new Set<string>();
  for (const [candidateId, decision] of applicableDuplicateDecisions(candidates, events)) {
    const candidate = candidateById.get(candidateId);
    if (candidate === undefined) {
      throw new DuplicateResolutionConflictError(
        `Decision references unknown candidate: ${candidateId}`,
      );
    }
    if (decision.action === "keep-existing") {
      suppressedIncoming.add(candidate.incomingTransactionId);
    } else if (decision.action === "keep-new") {
      suppressedExisting.add(candidate.existingTransactionId);
    } else if (decision.action === "manual-link") {
      manuallyLinked.add(candidateId);
    }
  }
  return {
    suppressedExistingTransactionIds: suppressedExisting,
    suppressedIncomingTransactionIds: suppressedIncoming,
    manuallyLinkedCandidateIds: manuallyLinked,
  };
}
