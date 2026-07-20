import type { Account } from "./account";
import type { AccountId, TransactionId, TransferLinkId } from "./identifiers";
import { Money } from "./money";
import type { DateOnly, UtcTimestamp } from "./temporal";
import type { Transaction } from "./transaction";

export type TransferStatus = "proposed" | "confirmed" | "rejected" | "unlinked";

export interface TransferEvidence {
  readonly code: string;
  readonly weight: number;
  readonly detail: string;
}

export interface TransferProposal {
  readonly id: string;
  readonly outflowTransaction: Transaction;
  readonly inflowTransaction: Transaction;
  readonly score: number;
  readonly evidence: readonly TransferEvidence[];
  readonly feeAmount?: Money;
  readonly isAmbiguous: boolean;
}

export interface TransferLink {
  readonly id: TransferLinkId;
  readonly signature: string;
  readonly outflowTransactionId: TransactionId;
  readonly inflowTransactionId: TransactionId;
  readonly status: TransferStatus;
  readonly score: number;
  readonly evidence: readonly TransferEvidence[];
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface TransferMatchingOptions {
  readonly maxDateDistanceDays?: number;
  readonly maxFeeAbsolute?: string;
}

export function calculateTransferSignature(idA: string, idB: string): string {
  return [idA, idB].sort().join(":");
}

function calculateDateDistance(dateA: DateOnly, dateB: DateOnly): number {
  const tA = new Date(`${dateA}T00:00:00Z`).getTime();
  const tB = new Date(`${dateB}T00:00:00Z`).getTime();
  return Math.abs(Math.round((tA - tB) / (1000 * 60 * 60 * 24)));
}

/**
 * Pure deterministic matcher function over transactions across distinct accounts.
 */
export function findTransferProposals(
  transactions: readonly Transaction[],
  accounts: readonly Account[] = [],
  options: TransferMatchingOptions = {},
): readonly TransferProposal[] {
  const maxDays = options.maxDateDistanceDays ?? 3;
  const accountMap = new Map<AccountId, Account>(accounts.map((a) => [a.id, a]));

  const outflows = transactions.filter((t) => t.status === "posted" && t.money.isOutflow());
  const inflows = transactions.filter((t) => t.status === "posted" && t.money.isInflow());

  const rawProposals: TransferProposal[] = [];

  for (const outflow of outflows) {
    for (const inflow of inflows) {
      // Must be distinct accounts
      if (outflow.accountId === inflow.accountId) continue;

      // Must share currency
      if (outflow.money.currency !== inflow.money.currency) continue;

      const dateDistance = calculateDateDistance(outflow.postedDate, inflow.postedDate);
      if (dateDistance > maxDays) continue;

      const outflowAbs = outflow.money.abs();
      const inflowAbs = inflow.money.abs();

      const evidence: TransferEvidence[] = [
        {
          code: "opposite-direction",
          weight: 3000,
          detail: `Outflow from ${accountMap.get(outflow.accountId)?.name ?? outflow.accountId} vs Inflow to ${accountMap.get(inflow.accountId)?.name ?? inflow.accountId}`,
        },
        {
          code: `date-distance:${dateDistance}`,
          weight: 2000 - dateDistance * 300,
          detail: `Posted ${dateDistance} day(s) apart (${outflow.postedDate} vs ${inflow.postedDate})`,
        },
      ];

      let score = 5000 + (2000 - dateDistance * 300);
      let feeAmount: Money | undefined;

      if (outflowAbs.equals(inflowAbs)) {
        evidence.push({
          code: "equal-amount",
          weight: 5000,
          detail: `Exact matching amount of ${outflow.money.currency} ${outflowAbs.toString()}`,
        });
        score += 5000;
      } else {
        // Fee check
        const diff = outflowAbs.isGreaterThan(inflowAbs)
          ? outflowAbs.subtract(inflowAbs)
          : inflowAbs.subtract(outflowAbs);

        // Accept fee differences up to $10 CAD/USD
        if (diff.isLessThanOrEqual(Money.from("10.00", outflow.money.currency))) {
          feeAmount = diff;
          evidence.push({
            code: "possible-fee",
            weight: 2000,
            detail: `Amount difference of ${diff.toString()} ${outflow.money.currency} flagged as potential transfer fee`,
          });
          score += 2000;
        } else {
          continue; // Amount mismatch beyond fee threshold
        }
      }

      const signature = calculateTransferSignature(outflow.id, inflow.id);

      rawProposals.push({
        id: signature,
        outflowTransaction: outflow,
        inflowTransaction: inflow,
        score,
        evidence,
        ...(feeAmount === undefined ? {} : { feeAmount }),
        isAmbiguous: false,
      });
    }
  }

  // Detect ambiguities (multiple candidates competing for same transaction)
  const txUsageCount = new Map<string, number>();
  for (const prop of rawProposals) {
    txUsageCount.set(
      prop.outflowTransaction.id,
      (txUsageCount.get(prop.outflowTransaction.id) ?? 0) + 1,
    );
    txUsageCount.set(
      prop.inflowTransaction.id,
      (txUsageCount.get(prop.inflowTransaction.id) ?? 0) + 1,
    );
  }

  const proposals: TransferProposal[] = rawProposals.map((prop) => {
    const isAmbiguous =
      (txUsageCount.get(prop.outflowTransaction.id) ?? 0) > 1 ||
      (txUsageCount.get(prop.inflowTransaction.id) ?? 0) > 1;

    return {
      ...prop,
      isAmbiguous,
      evidence: isAmbiguous
        ? [
            ...prop.evidence,
            {
              code: "ambiguous-candidate-count",
              weight: -1000,
              detail: "Multiple potential transfer matches exist for this transaction",
            },
          ]
        : prop.evidence,
    };
  });

  // Sort proposals by score descending, then date distance ascending, then ID
  return proposals.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
}
