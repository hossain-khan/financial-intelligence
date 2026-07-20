import { Money } from "@financial-intelligence/domain";
import type { CashFlowFilter, CashFlowReport } from "./cash-flow";

export interface SavingsRateMonthRow {
  readonly month: string;
  readonly income: string;
  readonly spending: string;
  readonly netSavings: string;
  readonly savingsRate: string; // decimal fraction string e.g. "0.35" or "notApplicable"
  readonly incomplete: boolean;
}

export interface SavingsRateCurrencyReport {
  readonly currency: string;
  readonly income: string;
  readonly spending: string;
  readonly netSavings: string;
  readonly savingsRate: string; // decimal fraction string e.g. "0.35" or "notApplicable"
  readonly months: readonly SavingsRateMonthRow[];
  readonly status: "normal" | "notApplicable" | "incomplete";
  readonly takeaway: string;
}

export interface SavingsRateReport {
  readonly filter: CashFlowFilter;
  readonly filterSummary: string;
  readonly currencies: readonly SavingsRateCurrencyReport[];
}

function calculateRateString(incomeMoney: Money, spendingMoney: Money): string {
  if (incomeMoney.isZero() || !incomeMoney.isInflow()) {
    return "notApplicable";
  }
  return incomeMoney.subtract(spendingMoney).ratioTo(incomeMoney, 4);
}

export function analyzeSavingsRate(cashFlowReport: CashFlowReport): SavingsRateReport {
  const currencies: SavingsRateCurrencyReport[] = cashFlowReport.currencies.map((curr) => {
    const incomeMoney = Money.from(curr.income, curr.currency);
    const spendingMoney = Money.from(curr.spending, curr.currency);
    const netSavingsMoney = incomeMoney.subtract(spendingMoney);

    const mainRateStr = calculateRateString(incomeMoney, spendingMoney);

    const monthRows: SavingsRateMonthRow[] = curr.months.map((m) => {
      const mInc = Money.from(m.income, curr.currency);
      const mSpe = Money.from(m.spending, curr.currency);
      const mNet = mInc.subtract(mSpe);
      const mRate = calculateRateString(mInc, mSpe);

      return {
        month: m.month,
        income: m.income,
        spending: m.spending,
        netSavings: mNet.toJSON().amount,
        savingsRate: mRate,
        incomplete: m.incomplete,
      };
    });

    const hasIncompleteMonth = monthRows.some((m) => m.incomplete);
    const isNotApplicable = mainRateStr === "notApplicable";

    const status: "normal" | "notApplicable" | "incomplete" = isNotApplicable
      ? "notApplicable"
      : hasIncompleteMonth
        ? "incomplete"
        : "normal";

    const pctText =
      mainRateStr === "notApplicable"
        ? "N/A (no net positive income)"
        : `${(Number(mainRateStr) * 100).toFixed(1)}%`;

    const takeaway = isNotApplicable
      ? `Income is zero or non-positive for ${curr.currency}. Savings rate is not applicable.`
      : hasIncompleteMonth
        ? `Savings rate is ${pctText} for ${curr.currency} (includes incomplete period).`
        : `Savings rate is ${pctText} for ${curr.currency}.`;

    return {
      currency: curr.currency,
      income: curr.income,
      spending: curr.spending,
      netSavings: netSavingsMoney.toJSON().amount,
      savingsRate: mainRateStr,
      months: monthRows,
      status,
      takeaway,
    };
  });

  return {
    filter: cashFlowReport.filter,
    filterSummary: cashFlowReport.filterSummary,
    currencies,
  };
}
