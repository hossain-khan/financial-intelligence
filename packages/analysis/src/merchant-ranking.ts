import {
  matchDescriptionToMerchants,
  Money,
  type Merchant,
  type MerchantId,
  type Transaction,
  type TransactionId,
} from "@financial-intelligence/domain";

import { filterCashFlowTransactions, type CashFlowFilter } from "./cash-flow";

export interface MerchantRankingInput {
  readonly transactions: readonly Transaction[];
  readonly merchants: readonly Merchant[];
  readonly filter?: CashFlowFilter;
  readonly confirmedTransferTransactionIds?: ReadonlySet<string>;
}

export interface MerchantMonthlyTrend {
  readonly month: string;
  readonly spending: string;
}

export interface MerchantRankingRow {
  readonly merchantId?: MerchantId;
  readonly merchantName: string;
  readonly totalSpending: string;
  readonly transactionCount: number;
  readonly transactionIds: readonly TransactionId[];
  readonly monthlyTrend: readonly MerchantMonthlyTrend[];
}

export interface MerchantRankingCurrencyReport {
  readonly currency: string;
  readonly totalSpending: string;
  readonly unresolvedSpending: string;
  readonly unresolvedCount: number;
  readonly rows: readonly MerchantRankingRow[];
  readonly takeaway: string;
}

export interface MerchantRankingReport {
  readonly filter: CashFlowFilter;
  readonly filterSummary: string;
  readonly currencies: readonly MerchantRankingCurrencyReport[];
}

export function analyzeMerchantRanking(input: MerchantRankingInput): MerchantRankingReport {
  const filteredTxs = filterCashFlowTransactions(input.transactions, input.filter);
  const confirmedTransfers = input.confirmedTransferTransactionIds;

  // Active non-archived merchants map
  const merchantMap = new Map<string, Merchant>();
  for (const m of input.merchants) {
    merchantMap.set(m.id, m);
  }

  // Helper to resolve redirects
  const resolveMerchant = (id: MerchantId): Merchant | undefined => {
    let current = merchantMap.get(id);
    const visited = new Set<string>();
    while (current?.redirectToId && !visited.has(current.id)) {
      visited.add(current.id);
      const next = merchantMap.get(current.redirectToId);
      if (!next) break;
      current = next;
    }
    return current;
  };

  // Group by currency -> merchantId ("unresolved" or actual ID)
  const currencyBuckets = new Map<
    string,
    Map<
      string,
      {
        merchantId?: MerchantId;
        merchantName: string;
        transactions: Transaction[];
      }
    >
  >();

  for (const tx of filteredTxs) {
    if (tx.status !== "posted" || !tx.money.isOutflow()) continue;
    if (confirmedTransfers !== undefined && confirmedTransfers.has(tx.id)) continue;

    const currency = tx.money.currency;
    let cMap = currencyBuckets.get(currency);
    if (!cMap) {
      cMap = new Map();
      currencyBuckets.set(currency, cMap);
    }

    const matches = matchDescriptionToMerchants(tx.description, input.merchants);
    const bestMatch = matches[0];
    const resolvedMerchant = bestMatch ? resolveMerchant(bestMatch.merchantId) : undefined;

    const key = resolvedMerchant ? resolvedMerchant.id : "unresolved";
    const name = resolvedMerchant ? resolvedMerchant.name : "Unresolved Merchants";

    let bucket = cMap.get(key);
    if (!bucket) {
      bucket = {
        ...(resolvedMerchant ? { merchantId: resolvedMerchant.id } : {}),
        merchantName: name,
        transactions: [],
      };
      cMap.set(key, bucket);
    }
    bucket.transactions.push(tx);
  }

  const currencyReports: MerchantRankingCurrencyReport[] = [];

  for (const [currency, cMap] of currencyBuckets.entries()) {
    let grandTotal = Money.zero(currency);
    let unresolvedTotal = Money.zero(currency);
    let unresolvedCount = 0;

    const rows: MerchantRankingRow[] = [];

    for (const [key, group] of cMap.entries()) {
      let groupTotal = Money.zero(currency);
      const monthMap = new Map<string, Money>();
      const txIds: TransactionId[] = [];

      for (const tx of group.transactions) {
        const absMoney = tx.money.abs();
        groupTotal = groupTotal.add(absMoney);
        txIds.push(tx.id);

        const monthKey = tx.postedDate.slice(0, 7);
        const currentMonthVal = monthMap.get(monthKey) ?? Money.zero(currency);
        monthMap.set(monthKey, currentMonthVal.add(absMoney));
      }

      grandTotal = grandTotal.add(groupTotal);

      if (key === "unresolved") {
        unresolvedTotal = unresolvedTotal.add(groupTotal);
        unresolvedCount = group.transactions.length;
      }

      const monthlyTrend: MerchantMonthlyTrend[] = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, val]) => ({ month, spending: val.toJSON().amount }));

      rows.push({
        ...(group.merchantId ? { merchantId: group.merchantId } : {}),
        merchantName: group.merchantName,
        totalSpending: groupTotal.toJSON().amount,
        transactionCount: group.transactions.length,
        transactionIds: txIds,
        monthlyTrend,
      });
    }

    // Sort rows by totalSpending descending, ties by merchantName
    rows.sort((a, b) => {
      const mA = Money.from(a.totalSpending, currency);
      const mB = Money.from(b.totalSpending, currency);
      const cmp = mB.compareTo(mA);
      if (cmp !== 0) return cmp;
      return a.merchantName.localeCompare(b.merchantName);
    });

    const topMerchant = rows[0]?.merchantName ?? "None";
    const takeaway = `Top spending merchant in ${currency} is ${topMerchant} across ${rows.length} merchant groups.`;

    currencyReports.push({
      currency,
      totalSpending: grandTotal.toJSON().amount,
      unresolvedSpending: unresolvedTotal.toJSON().amount,
      unresolvedCount,
      rows,
      takeaway,
    });
  }

  return {
    filter: input.filter ?? {},
    filterSummary: "Merchant ranking analysis",
    currencies: currencyReports,
  };
}
