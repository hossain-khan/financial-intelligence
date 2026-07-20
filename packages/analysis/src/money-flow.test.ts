import { describe, expect, it } from "vitest";
import { parseCategoryId, parseTransactionId } from "@financial-intelligence/domain";
import type { CashFlowReport } from "./cash-flow";
import { analyzeMoneyFlow } from "./money-flow";

describe("money-flow analysis", () => {
  it("generates nodes and edges that reconcile to cash flow category totals", () => {
    const mockReport: CashFlowReport = {
      filter: {},
      filterSummary: "All transactions",
      mixedCurrencies: false,
      currencies: [
        {
          currency: "CAD",
          income: "4000.00",
          spending: "2000.00",
          transfers: "500.00",
          netCashFlow: "1500.00",
          unresolvedReviewCount: 0,
          excludedVoidCount: 0,
          months: [],
          accounts: [],
          categories: [
            {
              categoryId: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
              categoryName: "Groceries",
              spending: "1500.00",
              transactionIds: [parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda101")],
            },
            {
              categoryId: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
              categoryName: "Utilities",
              spending: "500.00",
              transactionIds: [parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda102")],
            },
          ],
          transactionIds: [],
          incomeTransactionIds: [],
          spendingTransactionIds: [],
          transferTransactionIds: [parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda103")],
          cashFlowTransactionIds: [],
          takeaway: "CAD summary",
        },
      ],
    };

    const flow = analyzeMoneyFlow(mockReport);
    expect(flow.currencies).toHaveLength(1);

    const cad = flow.currencies[0]!;
    expect(cad.nodes).toHaveLength(4); // income, groceries, utilities, transfers
    expect(cad.edges).toHaveLength(3); // income->groceries, income->utilities, income->transfers

    const groceriesEdge = cad.edges.find(
      (e) => e.targetId === "cat:018f6b80-0d62-7d2c-9a5c-7f5f59cda001",
    );
    expect(groceriesEdge?.amount).toBe("1500.00");
    expect(groceriesEdge?.percentage).toBe("75.0%");

    const utilitiesEdge = cad.edges.find(
      (e) => e.targetId === "cat:018f6b80-0d62-7d2c-9a5c-7f5f59cda002",
    );
    expect(utilitiesEdge?.amount).toBe("500.00");
    expect(utilitiesEdge?.percentage).toBe("25.0%");

    const transfersEdge = cad.edges.find((e) => e.targetId === "transfers");
    expect(transfersEdge?.amount).toBe("500.00");
  });
});
