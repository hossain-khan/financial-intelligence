import {
  Money,
  type RecurringDecisionRecord,
  type RecurringProposal,
  type TransactionId,
} from "@financial-intelligence/domain";

export interface RecurringSeriesRow {
  readonly id: string; // signature
  readonly name: string;
  readonly cadence: string;
  readonly currency: string;
  readonly amountStats: {
    readonly min: string;
    readonly max: string;
    readonly median: string;
    readonly isVariable: boolean;
  };
  readonly lastSeenDate: string;
  readonly nextExpectedDate: string;
  readonly memberCount: number;
  readonly memberTransactionIds: readonly TransactionId[];
  readonly status: "confirmed" | "proposed" | "dismissed" | "muted";
}

export interface RecurringSummaryCurrencyReport {
  readonly currency: string;
  readonly totalConfirmedMonthlySpend: string;
  readonly confirmedCount: number;
  readonly proposedCount: number;
  readonly dismissedCount: number;
  readonly mutedCount: number;
  readonly rows: readonly RecurringSeriesRow[];
  readonly takeaway: string;
}

export interface RecurringSummaryReport {
  readonly currencies: readonly RecurringSummaryCurrencyReport[];
}

export function summarizeRecurringSeries(
  proposals: readonly RecurringProposal[],
  decisions: readonly RecurringDecisionRecord[] = [],
): RecurringSummaryReport {
  const decisionMap = new Map<string, RecurringDecisionRecord>();
  for (const d of decisions) {
    decisionMap.set(d.signature, d);
  }

  const currencyBuckets = new Map<string, RecurringSeriesRow[]>();

  for (const p of proposals) {
    const d = decisionMap.get(p.id);
    const status: "confirmed" | "proposed" | "dismissed" | "muted" =
      d?.status === "confirmed" || d?.status === "dismissed" || d?.status === "muted"
        ? d.status
        : "proposed";

    const row: RecurringSeriesRow = {
      id: p.id,
      name: p.name,
      cadence: p.cadence,
      currency: p.currency,
      amountStats: p.amountStats,
      lastSeenDate: p.lastSeenDate,
      nextExpectedDate: p.nextExpectedDate,
      memberCount: p.memberTransactions.length,
      memberTransactionIds: p.memberTransactions.map((t) => t.id),
      status,
    };

    let list = currencyBuckets.get(p.currency);
    if (!list) {
      list = [];
      currencyBuckets.set(p.currency, list);
    }
    list.push(row);
  }

  const currencies: RecurringSummaryCurrencyReport[] = [];

  for (const [currency, rows] of currencyBuckets.entries()) {
    let confirmedSpend = Money.zero(currency);
    let confirmedCount = 0;
    let proposedCount = 0;
    let dismissedCount = 0;
    let mutedCount = 0;

    for (const r of rows) {
      if (r.status === "confirmed") {
        confirmedCount++;
        confirmedSpend = confirmedSpend.add(Money.from(r.amountStats.median, currency));
      } else if (r.status === "proposed") {
        proposedCount++;
      } else if (r.status === "dismissed") {
        dismissedCount++;
      } else if (r.status === "muted") {
        mutedCount++;
      }
    }

    const takeaway = `Found ${rows.length} recurring series (${confirmedCount} confirmed, ${proposedCount} proposed) with ${currency} ${confirmedSpend.toJSON().amount} confirmed recurring spend.`;

    currencies.push({
      currency,
      totalConfirmedMonthlySpend: confirmedSpend.toJSON().amount,
      confirmedCount,
      proposedCount,
      dismissedCount,
      mutedCount,
      rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
      takeaway,
    });
  }

  return { currencies };
}
