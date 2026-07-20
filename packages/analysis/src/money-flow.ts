import { Money, type TransactionId } from "@financial-intelligence/domain";
import type { CashFlowFilter, CashFlowReport } from "./cash-flow";

export interface MoneyFlowNode {
  readonly id: string;
  readonly label: string;
  readonly type: "source" | "destination" | "transfer";
}

export interface MoneyFlowEdge {
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly amount: string;
  readonly percentage: string; // e.g. "35.5%"
  readonly transactionIds: readonly TransactionId[];
}

export interface MoneyFlowCurrencyReport {
  readonly currency: string;
  readonly totalIncome: string;
  readonly totalSpending: string;
  readonly totalTransfers: string;
  readonly nodes: readonly MoneyFlowNode[];
  readonly edges: readonly MoneyFlowEdge[];
  readonly takeaway: string;
}

export interface MoneyFlowReport {
  readonly filter: CashFlowFilter;
  readonly filterSummary: string;
  readonly currencies: readonly MoneyFlowCurrencyReport[];
}

export function analyzeMoneyFlow(report: CashFlowReport): MoneyFlowReport {
  const currencyReports: MoneyFlowCurrencyReport[] = report.currencies.map((curr) => {
    const totalSpendingMoney = Money.from(curr.spending, curr.currency);
    const totalSpendingVal = Number(totalSpendingMoney.toJSON().amount);

    const nodes: MoneyFlowNode[] = [
      { id: "income", label: "Income & Cash Inflow", type: "source" },
    ];

    const edges: MoneyFlowEdge[] = [];

    for (const cat of curr.categories) {
      const nodeId = `cat:${cat.categoryId ?? "uncategorized"}`;
      nodes.push({
        id: nodeId,
        label: cat.categoryName,
        type: "destination",
      });

      const catVal = Number(cat.spending);
      const pct =
        totalSpendingVal > 0 ? ((catVal / totalSpendingVal) * 100).toFixed(1) + "%" : "0.0%";

      edges.push({
        sourceId: "income",
        sourceLabel: "Income & Cash Inflow",
        targetId: nodeId,
        targetLabel: cat.categoryName,
        amount: cat.spending,
        percentage: pct,
        transactionIds: cat.transactionIds,
      });
    }

    // Add internal transfers edge if non-zero
    const transfersMoney = Money.from(curr.transfers, curr.currency);
    if (transfersMoney.compareTo(Money.zero(curr.currency)) > 0) {
      nodes.push({ id: "transfers", label: "Account Transfers", type: "transfer" });
      edges.push({
        sourceId: "income",
        sourceLabel: "Income & Cash Inflow",
        targetId: "transfers",
        targetLabel: "Account Transfers",
        amount: curr.transfers,
        percentage: "N/A (Internal)",
        transactionIds: curr.transferTransactionIds,
      });
    }

    const takeaway = `Money flow for ${curr.currency}: Income ${curr.income} mapped to ${curr.categories.length} expense categories (${curr.spending} total spending) and ${curr.transfers} internal transfers.`;

    return {
      currency: curr.currency,
      totalIncome: curr.income,
      totalSpending: curr.spending,
      totalTransfers: curr.transfers,
      nodes,
      edges,
      takeaway,
    };
  });

  return {
    filter: report.filter,
    filterSummary: report.filterSummary,
    currencies: currencyReports,
  };
}
