import type { RecurringDecisionRecord } from "./financial-brain";
import type { MerchantId } from "./identifiers";
import type { DateOnly } from "./temporal";
import type { Transaction } from "./transaction";

export type RecurringCadence =
  "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "irregular";

export type RecurringStatus = "proposed" | "confirmed" | "dismissed" | "muted";

export interface RecurringEvidence {
  readonly code: string;
  readonly detail: string;
}

export interface RecurringProposal {
  readonly id: string;
  readonly name: string;
  readonly merchantId?: MerchantId;
  readonly cadence: RecurringCadence;
  readonly currency: string;
  readonly memberTransactions: readonly Transaction[];
  readonly lastSeenDate: DateOnly;
  readonly nextExpectedDate: DateOnly;
  readonly amountStats: {
    readonly min: string;
    readonly max: string;
    readonly median: string;
    readonly isVariable: boolean;
  };
  readonly confidence: number;
  readonly evidence: readonly RecurringEvidence[];
}

export interface RecurringDetectionOptions {
  readonly excludedTransactionIds?: ReadonlySet<string>;
  readonly existingDecisions?: readonly RecurringDecisionRecord[];
}

export function calculateRecurringSignature(
  groupingKey: string,
  currency: string,
  cadence: RecurringCadence,
): string {
  return [groupingKey.toLowerCase().trim(), currency.toUpperCase(), cadence].join(":");
}

function calculateDaysBetween(dateA: DateOnly, dateB: DateOnly): number {
  const tA = new Date(`${dateA}T00:00:00Z`).getTime();
  const tB = new Date(`${dateB}T00:00:00Z`).getTime();
  return Math.abs(Math.round((tA - tB) / (1000 * 60 * 60 * 24)));
}

function addDaysToDate(date: DateOnly, days: number): DateOnly {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) as DateOnly;
}

function detectCadence(intervalDays: readonly number[]): RecurringCadence {
  if (intervalDays.length === 0) return "irregular";
  const avg = intervalDays.reduce((sum, val) => sum + val, 0) / intervalDays.length;

  if (avg >= 5 && avg <= 9) return "weekly";
  if (avg >= 11 && avg <= 17) return "biweekly";
  if (avg >= 26 && avg <= 35) return "monthly";
  if (avg >= 80 && avg <= 100) return "quarterly";
  if (avg >= 340 && avg <= 390) return "yearly";

  return "irregular";
}

function computeCadenceInterval(cadence: RecurringCadence): number {
  switch (cadence) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "quarterly":
      return 91;
    case "yearly":
      return 365;
    default:
      return 30;
  }
}

function normalizeDescription(description: string): string {
  return description.toUpperCase().replace(/[0-9]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Pure deterministic detector over non-void outflows.
 */
export function findRecurringProposals(
  transactions: readonly Transaction[],
  options: RecurringDetectionOptions = {},
): readonly RecurringProposal[] {
  const excluded = options.excludedTransactionIds;

  const validOutflows = transactions.filter(
    (t) =>
      t.status === "posted" &&
      t.money.isOutflow() &&
      (excluded === undefined || !excluded.has(t.id)),
  );

  // Group by normalized description + currency
  const groups = new Map<string, Transaction[]>();

  for (const tx of validOutflows) {
    const key = normalizeDescription(tx.description) + ":" + tx.money.currency;
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [tx]);
    } else {
      bucket.push(tx);
    }
  }

  const proposals: RecurringProposal[] = [];

  for (const [groupKey, txs] of groups.entries()) {
    if (txs.length < 3) continue;

    // Sort by postedDate ascending
    const sortedTxs = [...txs].sort((a, b) => a.postedDate.localeCompare(b.postedDate));

    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sortedTxs.length; i++) {
      intervals.push(calculateDaysBetween(sortedTxs[i - 1]!.postedDate, sortedTxs[i]!.postedDate));
    }

    const cadence = detectCadence(intervals);
    if (cadence === "irregular") continue;

    const currency = sortedTxs[0]!.money.currency;
    const firstTx = sortedTxs[0]!;
    const name = normalizeDescription(firstTx.description);

    const amounts = sortedTxs.map((t) => t.money.abs());
    const sortedAmounts = [...amounts].sort((a, b) => a.compareTo(b));
    const minAmount = sortedAmounts[0]!.toJSON().amount;
    const maxAmount = sortedAmounts[sortedAmounts.length - 1]!.toJSON().amount;
    const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)]!.toJSON().amount;

    const lastSeenDate = sortedTxs[sortedTxs.length - 1]!.postedDate;
    const nextExpectedDate = addDaysToDate(lastSeenDate, computeCadenceInterval(cadence));
    const signature = calculateRecurringSignature(groupKey, currency, cadence);

    const evidence: RecurringEvidence[] = [
      {
        code: `cadence:${cadence}`,
        detail: `Detected ${cadence} cadence across ${sortedTxs.length} occurrences`,
      },
      {
        code: "amount-stability",
        detail:
          minAmount === maxAmount
            ? "Exact fixed amount"
            : `Variable amount range: ${currency} ${minAmount} - ${maxAmount}`,
      },
    ];

    proposals.push({
      id: signature,
      name,
      cadence,
      currency,
      memberTransactions: sortedTxs,
      lastSeenDate,
      nextExpectedDate,
      amountStats: {
        min: minAmount,
        max: maxAmount,
        median: medianAmount,
        isVariable: minAmount !== maxAmount,
      },
      confidence: minAmount === maxAmount ? 0.95 : 0.85,
      evidence,
    });
  }

  return proposals.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}
