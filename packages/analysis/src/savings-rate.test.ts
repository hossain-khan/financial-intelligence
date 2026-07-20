import { describe, expect, it } from "vitest";
import type { CashFlowReport } from "./cash-flow";
import { analyzeSavingsRate } from "./savings-rate";

describe("savings-rate analysis", () => {
  it("calculates decimal-safe savings rate and monthly breakdown", () => {
    const mockReport: CashFlowReport = {
      filter: {},
      filterSummary: "All transactions",
      mixedCurrencies: false,
      currencies: [
        {
          currency: "CAD",
          income: "5000.00",
          spending: "3500.00",
          transfers: "0.00",
          netCashFlow: "1500.00",
          unresolvedReviewCount: 0,
          excludedVoidCount: 0,
          months: [
            {
              month: "2026-06",
              income: "2500.00",
              spending: "1500.00",
              transfers: "0.00",
              netCashFlow: "1000.00",
              incomplete: false,
              transactionIds: [],
            },
            {
              month: "2026-07",
              income: "2500.00",
              spending: "2000.00",
              transfers: "0.00",
              netCashFlow: "500.00",
              incomplete: true,
              transactionIds: [],
            },
          ],
          accounts: [],
          categories: [],
          transactionIds: [],
          incomeTransactionIds: [],
          spendingTransactionIds: [],
          transferTransactionIds: [],
          cashFlowTransactionIds: [],
          takeaway: "CAD summary",
        },
      ],
    };

    const result = analyzeSavingsRate(mockReport);
    expect(result.currencies).toHaveLength(1);

    const cad = result.currencies[0]!;
    expect(cad.income).toBe("5000.00");
    expect(cad.spending).toBe("3500.00");
    expect(cad.netSavings).toBe("1500");
    expect(cad.savingsRate).toBe("0.3000"); // 1500 / 5000 = 0.3
    expect(cad.status).toBe("incomplete");
    expect(cad.months).toHaveLength(2);
    expect(cad.months[0]?.savingsRate).toBe("0.4000"); // 1000 / 2500 = 0.4
    expect(cad.months[1]?.savingsRate).toBe("0.2000"); // 500 / 2500 = 0.2
  });

  it("handles zero or non-positive income with notApplicable status", () => {
    const mockReport: CashFlowReport = {
      filter: {},
      filterSummary: "All transactions",
      mixedCurrencies: false,
      currencies: [
        {
          currency: "USD",
          income: "0.00",
          spending: "1200.00",
          transfers: "0.00",
          netCashFlow: "-1200.00",
          unresolvedReviewCount: 0,
          excludedVoidCount: 0,
          months: [],
          accounts: [],
          categories: [],
          transactionIds: [],
          incomeTransactionIds: [],
          spendingTransactionIds: [],
          transferTransactionIds: [],
          cashFlowTransactionIds: [],
          takeaway: "USD summary",
        },
      ],
    };

    const result = analyzeSavingsRate(mockReport);
    const usd = result.currencies[0]!;
    expect(usd.savingsRate).toBe("notApplicable");
    expect(usd.status).toBe("notApplicable");
    expect(usd.takeaway).toContain("not applicable");
  });
});
