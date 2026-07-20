import type { CashFlowFilter } from "@financial-intelligence/analysis";
import type { Account, Merchant, TransactionReviewState } from "@financial-intelligence/domain";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { ApplicationServices } from "./infrastructure";

export interface DashboardFilterState {
  readonly accountId: string;
  readonly currency: string;
  readonly merchantId: string;
  readonly tag: string;
  readonly reviewState: "" | TransactionReviewState;
  readonly recurringStatus: "" | "confirmed" | "proposed" | "dismissed" | "muted";
  readonly fromDate: string;
  readonly toDate: string;
}

const EMPTY_FILTERS: DashboardFilterState = {
  accountId: "",
  currency: "",
  merchantId: "",
  tag: "",
  reviewState: "",
  recurringStatus: "",
  fromDate: "",
  toDate: "",
};

export interface DashboardPageProps {
  readonly services: ApplicationServices;
  readonly initialFilters?: DashboardFilterState;
  readonly onFiltersChange?: (filters: DashboardFilterState) => void;
  readonly onNavigateToLedger?: (transactionIds: readonly string[]) => void;
}

export function DashboardPage({
  services,
  initialFilters = EMPTY_FILTERS,
  onFiltersChange,
  onNavigateToLedger,
}: DashboardPageProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [merchants, setMerchants] = useState<readonly Merchant[]>([]);
  const [report, setReport] =
    useState<Awaited<ReturnType<ApplicationServices["queryDashboardUseCase"]["execute"]>>>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  const initialFilterKey = JSON.stringify(initialFilters);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters(initialFilters), 0);
    return () => window.clearTimeout(timer);
    // The serialized key changes only when URL/back-navigation state changes. Deferring avoids a
    // synchronous effect update while still reconciling browser history into local form state.
  }, [initialFilterKey, initialFilters]);

  const queryFilter = useMemo<CashFlowFilter>(
    () => ({
      ...(filters.accountId ? { accountIds: [filters.accountId] } : {}),
      ...(filters.currency ? { currencies: [filters.currency] } : {}),
      ...(filters.merchantId ? { merchantIds: [filters.merchantId] } : {}),
      ...(filters.tag.trim() ? { tags: [filters.tag.trim()] } : {}),
      ...(filters.reviewState ? { reviewStates: [filters.reviewState] } : {}),
      ...(filters.recurringStatus ? { recurringStatuses: [filters.recurringStatus] } : {}),
      ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
      ...(filters.toDate ? { toDate: filters.toDate } : {}),
    }),
    [filters],
  );

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  useEffect(() => {
    let current = true;
    void Promise.all([
      services.listWorkspaces.execute(),
      services.listMerchants.execute(),
      services.queryDashboardUseCase.execute(queryFilter),
    ])
      .then(async ([workspaces, loadedMerchants, dashboard]) => {
        const workspace = workspaces[0];
        const loadedAccounts =
          workspace === undefined ? [] : await services.listAccounts.execute(workspace.id);
        if (!current) return;
        setAccounts(loadedAccounts.filter((account) => !account.archived));
        setMerchants(loadedMerchants.filter((merchant) => !merchant.archived));
        setReport(dashboard);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!current) return;
        setErrorMessage(error instanceof Error ? error.message : "Dashboard data could not load.");
        setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [queryFilter, refreshKey, services]);

  const currencies = [...new Set(accounts.map((account) => account.currency))].sort();
  const recurringCurrencies = report?.recurring.currencies;

  const updateFilter = <Key extends keyof DashboardFilterState>(
    key: Key,
    value: DashboardFilterState[Key],
  ) => {
    setStatus("loading");
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Reconciled intelligence</p>
          <h1>See how money moves through your life.</h1>
          <p>
            Every total is calculated locally and traces back to the exact ledger entries behind it.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          {report && (
            <span className="storage-chip">Revision {report.sourceRevision.slice(-8)}</span>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setStatus("loading");
              setRefreshKey((v) => v + 1);
            }}
          >
            Refresh reports
          </button>
        </div>
      </header>

      <section className="dashboard-filter-panel" aria-labelledby="dashboard-filter-heading">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">One filter, every report</p>
            <h2 id="dashboard-filter-heading">Focus the dashboard</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setStatus("loading");
              setFilters(EMPTY_FILTERS);
            }}
          >
            Clear filters
          </button>
        </div>
        <div className="dashboard-filter-grid">
          <DashboardSelect
            label="Account"
            value={filters.accountId}
            onChange={(value) => updateFilter("accountId", value)}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </option>
            ))}
          </DashboardSelect>
          <DashboardSelect
            label="Currency"
            value={filters.currency}
            onChange={(value) => updateFilter("currency", value)}
          >
            <option value="">All currencies</option>
            {currencies.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </DashboardSelect>
          <DashboardSelect
            label="Merchant"
            value={filters.merchantId}
            onChange={(value) => updateFilter("merchantId", value)}
          >
            <option value="">All merchants</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </DashboardSelect>
          <DashboardSelect
            label="Review state"
            value={filters.reviewState}
            onChange={(value) =>
              updateFilter("reviewState", value as DashboardFilterState["reviewState"])
            }
          >
            <option value="">All review states</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="needsReview">Needs review</option>
            <option value="reviewed">Reviewed</option>
          </DashboardSelect>
          <label className="dashboard-field">
            Tag
            <input
              value={filters.tag}
              maxLength={80}
              onChange={(event) => updateFilter("tag", event.target.value)}
              placeholder="e.g. family"
            />
          </label>
          <label className="dashboard-field">
            From
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => updateFilter("fromDate", event.target.value)}
            />
          </label>
          <label className="dashboard-field">
            To
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => updateFilter("toDate", event.target.value)}
            />
          </label>
          <DashboardSelect
            label="Recurring state"
            value={filters.recurringStatus}
            onChange={(value) =>
              updateFilter("recurringStatus", value as DashboardFilterState["recurringStatus"])
            }
          >
            <option value="">All series</option>
            <option value="confirmed">Confirmed</option>
            <option value="proposed">Proposed</option>
            <option value="dismissed">Dismissed</option>
            <option value="muted">Muted</option>
          </DashboardSelect>
        </div>
      </section>

      {status === "loading" && (
        <div className="dashboard-state" role="status">
          Calculating reconciled reports…
        </div>
      )}
      {status === "error" && (
        <div className="dashboard-state error-message" role="alert">
          <strong>Reports could not load.</strong>
          <span>{errorMessage}</span>
        </div>
      )}

      {status === "ready" && report && (
        <div className="dashboard-sections">
          <section className="dashboard-panel" aria-labelledby="savings-heading">
            <PanelHeading eyebrow="Cash-flow health" title="Savings rate" id="savings-heading" />
            {report.savings.currencies.length === 0 ? (
              <EmptyReport />
            ) : (
              report.savings.currencies.map((currencyReport) => (
                <div className="dashboard-currency" key={currencyReport.currency}>
                  <div className="metric-grid">
                    <Metric
                      label="Income"
                      value={`${currencyReport.currency} ${currencyReport.income}`}
                      tone="positive"
                    />
                    <Metric
                      label="Spending"
                      value={`${currencyReport.currency} ${currencyReport.spending}`}
                      tone="negative"
                    />
                    <Metric
                      label="Net saved"
                      value={`${currencyReport.currency} ${currencyReport.netSavings}`}
                    />
                    <Metric
                      label="Savings rate"
                      value={
                        currencyReport.savingsRate === "notApplicable"
                          ? "Not available"
                          : `${(Number(currencyReport.savingsRate) * 100).toFixed(1)}%`
                      }
                    />
                  </div>
                  <p className="dashboard-takeaway">{currencyReport.takeaway}</p>
                  <div
                    className="trend-chart"
                    aria-label={`${currencyReport.currency} monthly income and spending chart`}
                  >
                    {currencyReport.months.map((month) => {
                      const largest = Math.max(Number(month.income), Number(month.spending), 1);
                      return (
                        <div className="trend-column" key={month.month}>
                          <span>{month.month}</span>
                          <div className="trend-bars">
                            <i
                              className="income-bar"
                              style={{
                                height: `${Math.max(8, (Number(month.income) / largest) * 100)}%`,
                              }}
                              title={`Income ${month.income}`}
                            />
                            <i
                              className="spending-bar"
                              style={{
                                height: `${Math.max(8, (Number(month.spending) / largest) * 100)}%`,
                              }}
                              title={`Spending ${month.spending}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <SavingsTable currency={currencyReport.currency} rows={currencyReport.months} />
                </div>
              ))
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="merchant-heading">
            <PanelHeading
              eyebrow="Where spending lands"
              title="Merchant ranking"
              id="merchant-heading"
            />
            {report.merchant.currencies.length === 0 ? (
              <EmptyReport />
            ) : (
              report.merchant.currencies.map((currencyReport) => {
                const largest = Math.max(
                  ...currencyReport.rows.map((row) => Number(row.totalSpending)),
                  1,
                );
                return (
                  <div className="dashboard-currency" key={currencyReport.currency}>
                    <p className="dashboard-takeaway">{currencyReport.takeaway}</p>
                    <div
                      className="merchant-chart"
                      aria-label={`${currencyReport.currency} merchant spending chart`}
                    >
                      {currencyReport.rows.slice(0, 8).map((row) => (
                        <button
                          type="button"
                          key={row.merchantId ?? row.merchantName}
                          onClick={() => onNavigateToLedger?.(row.transactionIds)}
                        >
                          <span>{row.merchantName}</span>
                          <i
                            style={{
                              width: `${Math.max(3, (Number(row.totalSpending) / largest) * 100)}%`,
                            }}
                          />
                          <strong>
                            {currencyReport.currency} {row.totalSpending}
                          </strong>
                        </button>
                      ))}
                    </div>
                    <div className="dashboard-table-wrap">
                      <table>
                        <caption>
                          Merchant totals; select a row to inspect exact transactions.
                        </caption>
                        <thead>
                          <tr>
                            <th>Merchant</th>
                            <th>Spend</th>
                            <th>Transactions</th>
                            <th>Ledger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currencyReport.rows.map((row) => (
                            <tr key={row.merchantId ?? row.merchantName}>
                              <td>{row.merchantName}</td>
                              <td>
                                {currencyReport.currency} {row.totalSpending}
                              </td>
                              <td>{row.transactionCount}</td>
                              <td>
                                <button
                                  type="button"
                                  className="table-action"
                                  onClick={() => onNavigateToLedger?.(row.transactionIds)}
                                >
                                  View {row.transactionCount}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="recurring-heading">
            <PanelHeading
              eyebrow="Commitments over time"
              title="Recurring payments"
              id="recurring-heading"
            />
            {recurringCurrencies?.length === 0 ? (
              <EmptyReport />
            ) : (
              recurringCurrencies?.map((currencyReport) => (
                <div className="dashboard-currency" key={currencyReport.currency}>
                  <p className="dashboard-takeaway">{currencyReport.takeaway}</p>
                  <div className="dashboard-table-wrap">
                    <table>
                      <caption>Detected recurring series and their review state.</caption>
                      <thead>
                        <tr>
                          <th>Series</th>
                          <th>Cadence</th>
                          <th>Typical amount</th>
                          <th>Next expected</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currencyReport.rows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td>{row.cadence}</td>
                            <td>
                              {row.currency} {row.amountStats.median}
                            </td>
                            <td>{row.nextExpectedDate}</td>
                            <td>
                              <span className={`status-pill status-${row.status}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="flow-heading">
            <PanelHeading eyebrow="Income to destinations" title="Money flow" id="flow-heading" />
            {report.moneyFlow.currencies.length === 0 ? (
              <EmptyReport />
            ) : (
              report.moneyFlow.currencies.map((currencyReport) => (
                <div className="dashboard-currency" key={currencyReport.currency}>
                  <p className="dashboard-takeaway">{currencyReport.takeaway}</p>
                  <div
                    className="flow-chart"
                    aria-label={`${currencyReport.currency} money flow chart`}
                  >
                    {currencyReport.edges.map((edge) => (
                      <button
                        type="button"
                        key={`${edge.sourceId}:${edge.targetId}`}
                        onClick={() => onNavigateToLedger?.(edge.transactionIds)}
                      >
                        <span>{edge.sourceLabel}</span>
                        <i aria-hidden="true" />
                        <strong>
                          {edge.targetLabel}
                          <small>
                            {currencyReport.currency} {edge.amount} · {edge.percentage}
                          </small>
                        </strong>
                      </button>
                    ))}
                  </div>
                  <div className="dashboard-table-wrap">
                    <table>
                      <caption>Money-flow edges; chart and table use identical values.</caption>
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Destination</th>
                          <th>Amount</th>
                          <th>Share</th>
                          <th>Ledger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currencyReport.edges.map((edge) => (
                          <tr key={`${edge.sourceId}:${edge.targetId}`}>
                            <td>{edge.sourceLabel}</td>
                            <td>{edge.targetLabel}</td>
                            <td>
                              {currencyReport.currency} {edge.amount}
                            </td>
                            <td>{edge.percentage}</td>
                            <td>
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => onNavigateToLedger?.(edge.transactionIds)}
                              >
                                View {edge.transactionIds.length}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function DashboardSelect({
  label,
  value,
  onChange,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
}) {
  return (
    <label className="dashboard-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function PanelHeading({
  eyebrow,
  title,
  id,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly id: string;
}) {
  return (
    <div className="section-heading compact-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyReport() {
  return <p className="dashboard-empty">No transactions match these filters yet.</p>;
}

function SavingsTable({
  currency,
  rows,
}: {
  readonly currency: string;
  readonly rows: readonly {
    readonly month: string;
    readonly income: string;
    readonly spending: string;
    readonly netSavings: string;
    readonly savingsRate: string;
    readonly incomplete: boolean;
  }[];
}) {
  return (
    <div className="dashboard-table-wrap">
      <table>
        <caption>Monthly savings values represented by the chart.</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Spending</th>
            <th>Net saved</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>
                {row.month}
                {row.incomplete && <span className="status-pill status-proposed">Partial</span>}
              </td>
              <td>
                {currency} {row.income}
              </td>
              <td>
                {currency} {row.spending}
              </td>
              <td>
                {currency} {row.netSavings}
              </td>
              <td>
                {row.savingsRate === "notApplicable"
                  ? "—"
                  : `${(Number(row.savingsRate) * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
