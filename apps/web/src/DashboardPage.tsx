import React, { useEffect, useState } from "react";
import type {
  CashFlowFilter,
  MerchantRankingReport,
  MoneyFlowReport,
  RecurringSummaryReport,
  SavingsRateReport,
} from "@financial-intelligence/analysis";
import type { Account } from "@financial-intelligence/domain";

import type { ApplicationServices } from "./infrastructure";

export interface DashboardPageProps {
  readonly services: ApplicationServices;
  readonly onNavigateToLedger?: (transactionIds: readonly string[]) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ services, onNavigateToLedger }) => {
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [savingsReport, setSavingsReport] = useState<SavingsRateReport>();
  const [merchantReport, setMerchantReport] = useState<MerchantRankingReport>();
  const [recurringReport, setRecurringReport] = useState<RecurringSummaryReport>();
  const [moneyFlowReport, setMoneyFlowReport] = useState<MoneyFlowReport>();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const workspaces = await services.listWorkspaces.execute();
        const workspace = workspaces[0];
        const loadedAccounts =
          workspace === undefined ? [] : await services.listAccounts.execute(workspace.id);
        const activeAccounts = loadedAccounts.filter((a) => !a.archived);

        const filter: CashFlowFilter = {
          ...(accountId ? { accountIds: [accountId] } : {}),
          ...(currency ? { currencies: [currency] } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
        };

        const [savingsRes, merchantRes, recurringRes, moneyFlowRes] = await Promise.all([
          services.querySavingsRateUseCase.execute(filter),
          services.queryMerchantRankingUseCase.execute(filter),
          services.queryRecurringSummaryUseCase.execute(),
          services.queryMoneyFlowUseCase.execute(filter),
        ]);

        if (!cancelled) {
          setAccounts(activeAccounts);
          setSavingsReport(savingsRes);
          setMerchantReport(merchantRes);
          setRecurringReport(recurringRes);
          setMoneyFlowReport(moneyFlowRes);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage((err as Error).message);
          setStatus("error");
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [services, accountId, currency, fromDate, toDate, refreshKey]);

  const handleDrilldown = (transactionIds: readonly string[]) => {
    if (onNavigateToLedger) {
      onNavigateToLedger(transactionIds);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="border-b border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>📊 Intelligence Dashboards</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Reconciled spending analytics, savings rate trends, merchant rankings, and money-flow
              breakdowns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors self-start sm:self-auto"
          >
            ↻ Refresh Analytics
          </button>
        </div>
      </header>

      {/* Filter Toolbar */}
      <section aria-labelledby="dashboard-filters-title" className="card p-4">
        <h2 id="dashboard-filters-title" className="sr-only">
          Dashboard Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="filter-account"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Account
            </label>
            <select
              id="filter-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-white p-2"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-currency"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Currency
            </label>
            <select
              id="filter-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-white p-2"
            >
              <option value="">All Currencies</option>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-from-date"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              From Date
            </label>
            <input
              id="filter-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-white p-2"
            />
          </div>

          <div>
            <label
              htmlFor="filter-to-date"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              To Date
            </label>
            <input
              id="filter-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-white p-2"
            />
          </div>
        </div>
      </section>

      {/* Loading / Error States */}
      {status === "loading" && (
        <div className="card p-8 text-center text-slate-400">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <span className="text-2xl">⏳</span>
            <span>Calculating reconciled dashboard reports...</span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="card border-l-4 border-l-rose-500 p-4 bg-rose-950/20 text-rose-300">
          <h2 className="font-semibold">Error Loading Dashboard Data</h2>
          <p className="text-sm mt-1">{errorMessage}</p>
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-6">
          {/* Section 1: Savings Rate & Cash Flow Overview */}
          <section aria-labelledby="savings-overview-heading" className="card p-4">
            <h2
              id="savings-overview-heading"
              className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
            >
              <span>💰 Savings Rate & Cash Flow</span>
            </h2>

            {savingsReport?.currencies.map((curr) => {
              const rateNum =
                curr.savingsRate === "notApplicable" ? 0 : Number(curr.savingsRate) * 100;
              const rateDisplay =
                curr.savingsRate === "notApplicable" ? "N/A" : `${rateNum.toFixed(1)}%`;

              return (
                <div key={curr.currency} className="space-y-4 mb-6 last:mb-0">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-xs text-slate-400 block">
                        Total Income ({curr.currency})
                      </span>
                      <span className="text-xl font-bold text-emerald-400">
                        {curr.currency} {curr.income}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Total Spending</span>
                      <span className="text-xl font-bold text-rose-400">
                        {curr.currency} {curr.spending}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Net Savings</span>
                      <span className="text-xl font-bold text-cyan-400">
                        {curr.currency} {curr.netSavings}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Savings Rate</span>
                      <span className="text-xl font-bold text-amber-400 flex items-center gap-2">
                        {rateDisplay}
                        {curr.status === "incomplete" && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Incomplete
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
                    {curr.takeaway}
                  </p>

                  {/* Monthly Trend Table */}
                  {curr.months.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                            <th className="py-2 px-3">Month</th>
                            <th className="py-2 px-3">Income</th>
                            <th className="py-2 px-3">Spending</th>
                            <th className="py-2 px-3">Net Savings</th>
                            <th className="py-2 px-3">Savings Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {curr.months.map((m) => (
                            <tr key={m.month} className="hover:bg-slate-900/40">
                              <td className="py-2 px-3 font-medium text-white flex items-center gap-2">
                                {m.month}
                                {m.incomplete && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                    Incomplete
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-emerald-400">
                                {curr.currency} {m.income}
                              </td>
                              <td className="py-2 px-3 text-rose-400">
                                {curr.currency} {m.spending}
                              </td>
                              <td className="py-2 px-3 text-cyan-400">
                                {curr.currency} {m.netSavings}
                              </td>
                              <td className="py-2 px-3 font-semibold text-amber-400">
                                {m.savingsRate === "notApplicable"
                                  ? "N/A"
                                  : `${(Number(m.savingsRate) * 100).toFixed(1)}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Section 2: Top Merchants Ranking */}
          <section aria-labelledby="merchant-ranking-heading" className="card p-4">
            <h2
              id="merchant-ranking-heading"
              className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
            >
              <span>🛍️ Merchant Spend Ranking</span>
            </h2>

            {merchantReport?.currencies.map((curr) => (
              <div key={curr.currency} className="space-y-3 mb-6 last:mb-0">
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
                  <span>{curr.takeaway}</span>
                  {curr.unresolvedCount > 0 && (
                    <span className="text-amber-400 font-medium">
                      ⚠️ {curr.unresolvedCount} unresolved transactions ({curr.currency}{" "}
                      {curr.unresolvedSpending})
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Merchant</th>
                        <th className="py-2 px-3">Total Spend</th>
                        <th className="py-2 px-3">Transactions</th>
                        <th className="py-2 px-3">Monthly Trend</th>
                        <th className="py-2 px-3 text-right">Drilldown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {curr.rows.map((row, idx) => (
                        <tr key={row.merchantId ?? `row-${idx}`} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-white">{row.merchantName}</td>
                          <td className="py-2 px-3 font-bold text-rose-400">
                            {curr.currency} {row.totalSpending}
                          </td>
                          <td className="py-2 px-3 text-slate-300">{row.transactionCount}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {row.monthlyTrend.slice(-4).map((t) => (
                                <span
                                  key={t.month}
                                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
                                >
                                  {t.month}: {curr.currency} {t.spending}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDrilldown(row.transactionIds)}
                              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition-colors"
                            >
                              View Txs ({row.transactionCount})
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          {/* Section 3: Recurring Payments & Subscriptions */}
          <section aria-labelledby="recurring-summary-heading" className="card p-4">
            <h2
              id="recurring-summary-heading"
              className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
            >
              <span>↺ Recurring Subscriptions & Scheduled Payments</span>
            </h2>

            {recurringReport?.currencies.map((curr) => (
              <div key={curr.currency} className="space-y-3 mb-6 last:mb-0">
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
                  <span>{curr.takeaway}</span>
                  <span className="text-cyan-400 font-medium">
                    Total Confirmed: {curr.currency} {curr.totalConfirmedMonthlySpend} / occurrence
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                        <th className="py-2 px-3">Series Name</th>
                        <th className="py-2 px-3">Cadence</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Next Expected</th>
                        <th className="py-2 px-3">Occurrences</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {curr.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-semibold text-white">{row.name}</td>
                          <td className="py-2 px-3">
                            <span className="capitalize text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {row.cadence}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-rose-400">
                            {row.amountStats.isVariable
                              ? `${row.currency} ${row.amountStats.min} – ${row.amountStats.max}`
                              : `${row.currency} ${row.amountStats.median}`}
                          </td>
                          <td className="py-2 px-3 text-emerald-400 font-medium">
                            {row.nextExpectedDate}
                          </td>
                          <td className="py-2 px-3 text-slate-300">{row.memberCount}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded capitalize ${
                                row.status === "confirmed"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : row.status === "proposed"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          {/* Section 4: Money Flow */}
          <section aria-labelledby="money-flow-heading" className="card p-4">
            <h2
              id="money-flow-heading"
              className="text-lg font-semibold text-white mb-3 flex items-center gap-2"
            >
              <span>🌊 Money Flow Breakdown</span>
            </h2>

            {moneyFlowReport?.currencies.map((curr) => (
              <div key={curr.currency} className="space-y-3 mb-6 last:mb-0">
                <p className="text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
                  {curr.takeaway}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                        <th className="py-2 px-3">Source</th>
                        <th className="py-2 px-3">Destination</th>
                        <th className="py-2 px-3">Flow Amount</th>
                        <th className="py-2 px-3">% of Spending</th>
                        <th className="py-2 px-3 text-right">Drilldown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {curr.edges.map((edge, idx) => (
                        <tr
                          key={`${edge.sourceId}-${edge.targetId}-${idx}`}
                          className="hover:bg-slate-900/40"
                        >
                          <td className="py-2 px-3 text-emerald-400 font-medium">
                            {edge.sourceLabel}
                          </td>
                          <td className="py-2 px-3 font-semibold text-white">{edge.targetLabel}</td>
                          <td className="py-2 px-3 font-bold text-rose-400">
                            {curr.currency} {edge.amount}
                          </td>
                          <td className="py-2 px-3 font-medium text-amber-400">
                            {edge.percentage}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDrilldown(edge.transactionIds)}
                              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition-colors"
                            >
                              View Txs ({edge.transactionIds.length})
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
};
