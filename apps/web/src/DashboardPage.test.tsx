// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMerchantId, parseTransactionId } from "@financial-intelligence/domain";

import type { ApplicationServices } from "./infrastructure";
import { DashboardPage } from "./DashboardPage";

afterEach(cleanup);

function fixtureServices(): ApplicationServices {
  return {
    listWorkspaces: {
      execute: vi.fn(async () => [
        {
          id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda999",
          name: "Main Workspace",
          createdAt: "2026-07-20T10:00:00Z",
          updatedAt: "2026-07-20T10:00:00Z",
        },
      ]),
    },
    listAccounts: {
      execute: vi.fn(async () => [
        {
          id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda111",
          workspaceId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda999",
          name: "Checking",
          type: "checking",
          currency: "CAD",
          archived: false,
          createdAt: "2026-07-20T10:00:00Z",
          updatedAt: "2026-07-20T10:00:00Z",
        },
      ]),
    },
    querySavingsRateUseCase: {
      execute: vi.fn(async () => ({
        filter: {},
        filterSummary: "All",
        currencies: [
          {
            currency: "CAD",
            income: "5000.00",
            spending: "3500.00",
            netSavings: "1500.00",
            savingsRate: "0.3000",
            months: [
              {
                month: "2026-07",
                income: "5000.00",
                spending: "3500.00",
                netSavings: "1500.00",
                savingsRate: "0.3000",
                incomplete: false,
              },
            ],
            status: "normal",
            takeaway: "Savings rate is 30.0% for CAD.",
          },
        ],
      })),
    },
    queryMerchantRankingUseCase: {
      execute: vi.fn(async () => ({
        filter: {},
        filterSummary: "All",
        currencies: [
          {
            currency: "CAD",
            totalSpending: "3500.00",
            unresolvedSpending: "0.00",
            unresolvedCount: 0,
            rows: [
              {
                merchantId: parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
                merchantName: "Grocery Store",
                totalSpending: "2000.00",
                transactionCount: 4,
                transactionIds: [parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda101")],
                monthlyTrend: [{ month: "2026-07", spending: "2000.00" }],
              },
            ],
            takeaway: "Top spending merchant in CAD is Grocery Store.",
          },
        ],
      })),
    },
    queryRecurringSummaryUseCase: {
      execute: vi.fn(async () => ({
        currencies: [
          {
            currency: "CAD",
            totalConfirmedMonthlySpend: "16.99",
            confirmedCount: 1,
            proposedCount: 0,
            dismissedCount: 0,
            mutedCount: 0,
            rows: [
              {
                id: "netflix:CAD:monthly",
                name: "NETFLIX",
                cadence: "monthly",
                currency: "CAD",
                amountStats: { min: "16.99", max: "16.99", median: "16.99", isVariable: false },
                lastSeenDate: "2026-07-15",
                nextExpectedDate: "2026-08-14",
                memberCount: 3,
                memberTransactionIds: [parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda102")],
                status: "confirmed",
              },
            ],
            takeaway: "Found 1 recurring series.",
          },
        ],
      })),
    },
    queryMoneyFlowUseCase: {
      execute: vi.fn(async () => ({
        filter: {},
        filterSummary: "All",
        currencies: [
          {
            currency: "CAD",
            totalIncome: "5000.00",
            totalSpending: "3500.00",
            totalTransfers: "0.00",
            nodes: [
              { id: "income", label: "Income & Cash Inflow", type: "source" },
              { id: "cat-1", label: "Groceries", type: "destination" },
            ],
            edges: [
              {
                sourceId: "income",
                sourceLabel: "Income & Cash Inflow",
                targetId: "cat-1",
                targetLabel: "Groceries",
                amount: "2000.00",
                percentage: "57.1%",
                transactionIds: [parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda101")],
              },
            ],
            takeaway: "Money flow mapped to 1 category.",
          },
        ],
      })),
    },
  } as unknown as ApplicationServices;
}

describe("DashboardPage component", () => {
  it("renders all four dashboard sections with accessible data tables", async () => {
    const services = fixtureServices();
    render(<DashboardPage services={services} />);

    await waitFor(() => {
      expect(screen.getByText(/Intelligence Dashboards/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Savings Rate & Cash Flow/i)).toBeInTheDocument();
    expect(screen.getByText(/Merchant Spend Ranking/i)).toBeInTheDocument();
    expect(screen.getByText(/Recurring Subscriptions & Scheduled Payments/i)).toBeInTheDocument();
    expect(screen.getByText(/Money Flow Breakdown/i)).toBeInTheDocument();

    expect(screen.getByText("Grocery Store")).toBeInTheDocument();
    expect(screen.getByText("NETFLIX")).toBeInTheDocument();
  });
});
