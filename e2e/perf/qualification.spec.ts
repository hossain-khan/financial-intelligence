import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "../network-guard";
import { BUDGETS, buildMetric, digestLabel, perfReader, writePerfResult } from "./harness";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
// PR-smoke tier: kept small so the run is a fast regression signal, not a load test. The 10k/50k
// tiers are documented scheduled/release workloads (docs/22-QUALIFICATION-MATRIX.md), not per-PR.
const ROW_COUNT = Number(process.env.PERF_ROWS ?? 1_000);
const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 5);

/**
 * Deterministic synthetic CSV; all values invented, amounts fixed to 2dp. Header names mirror the
 * known-good csv-mapping spec so column mapping auto-suggests and only account/date-format/direction
 * need selecting.
 */
function syntheticCsv(rows: number): string {
  const lines = ["Transfer date,Description,Amount,Balance"];
  for (let index = 0; index < rows; index += 1) {
    const cents = ((index * 37) % 50_000) + 1;
    const amount = `${index % 7 === 0 ? "" : "-"}${(cents / 100).toFixed(2)}`;
    const day = (index % 28) + 1;
    lines.push(`2025-01-${String(day).padStart(2, "0")},Merchant ${index + 1},${amount},0.00`);
  }
  return lines.join("\n");
}

test("qualification smoke: import, ledger, and dashboard budgets on a synthetic workload", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);

  // Seed a workspace + account through the supported UI, then import the synthetic CSV.
  await page.goto("/?perf=1");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Perf workload");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await page.goto("/import?perf=1");
  const csv = syntheticCsv(ROW_COUNT);
  const importStart = Date.now();
  await page.getByLabel("Select CSV files, or a single OFX/QFX or PDF statement").setInputFiles({
    name: "perf-workload.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/Parsed 1 source file/)).toBeVisible({ timeout: 60_000 });
  const parseSeconds = (Date.now() - importStart) / 1000;
  const csvRowsPerSecond = ROW_COUNT / Math.max(parseSeconds, 0.001);

  // Map + commit the import so the ledger/dashboard have data to render. Column mapping
  // auto-suggests from the headers; only account, date format, and positive-amount meaning remain.
  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD" });
  await page.getByRole("combobox", { name: "Date format" }).selectOption("YYYY-MM-DD");
  await page
    .getByRole("combobox", { name: "What does a positive amount mean?" })
    .selectOption("inflow");
  const commit = page.getByRole("button", { name: "Commit accepted transactions" });
  await expect(commit).toBeEnabled({ timeout: 30_000 });
  await commit.click();
  await expect(page.getByText(/Committed .* transactions atomically/)).toBeVisible({
    timeout: 60_000,
  });

  const reader = perfReader(page);

  // Ledger: measure repeated loads (initial render + refilter path is the same instrumented call).
  const ledgerSamples: number[] = [];
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    await page.goto("/transactions?perf=1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const durations = await reader.measures("ledger-render");
    const latest = durations.at(-1);
    if (latest !== undefined) ledgerSamples.push(latest);
  }
  const domRows = await reader.domRowCount();

  // Dashboard: repeated query→render.
  const dashboardSamples: number[] = [];
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    await page.goto("/dashboard?perf=1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const durations = await reader.measures("dashboard-query");
    const latest = durations.at(-1);
    if (latest !== undefined) dashboardSamples.push(latest);
  }

  const metrics = [
    buildMetric({
      id: "csv.throughput",
      unit: "rows-per-second",
      mode: "warm",
      samples: [csvRowsPerSecond],
      threshold: BUDGETS.csvRowsPerSecond,
      thresholdKind: "min",
    }),
    buildMetric({
      id: "ledger.render",
      unit: "ms",
      mode: "warm",
      samples: ledgerSamples,
      threshold: BUDGETS.ledgerFilterMs,
      thresholdKind: "max",
    }),
    buildMetric({
      id: "dashboard.query",
      unit: "ms",
      mode: "warm",
      samples: dashboardSamples,
      threshold: BUDGETS.dashboardQueryMs,
      thresholdKind: "max",
    }),
    buildMetric({
      id: "ledger.dom-rows",
      unit: "count",
      mode: "warm",
      samples: [domRows],
      threshold: BUDGETS.maxDomRows,
      thresholdKind: "max",
    }),
  ];

  // Bounded DOM is a hard correctness assertion (NFR-025) regardless of the informational timing.
  expect(domRows, "ledger DOM row count must stay bounded").toBeLessThanOrEqual(BUDGETS.maxDomRows);

  const version = testInfo.project.use.browserName ?? "chromium";
  const result = await writePerfResult({
    outputPath: `perf-results/qualification-${ROW_COUNT}.json`,
    workloadLabel: `smoke${ROW_COUNT}`,
    workloadDigest: await digestLabel(`smoke:${ROW_COUNT}:${csv.length}`),
    browserVersion: String(version),
    metrics,
  });

  // Informational: log the outcome for the CI artifact; timing budgets do not fail the build yet.
  testInfo.attach("perf-result", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  network.assertClean();
});
