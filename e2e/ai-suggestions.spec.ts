import { expect, test, type Page } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
const RESTAURANTS_CATEGORY_ID = "3f791740-0a5b-52a6-9ae1-f46258c30b04";

// Real WebGPU inference cannot run headless, so this drives the flow through the app's test seam
// (`globalThis.__FI_AI_TEST__`, honoured only when set — never in production). The seam supplies a
// scripted provider so the REAL orchestrator, IndexedDB persistence, and accept-to-rule path run.
// The generation step (turning a description into a category) is what's faked; everything the
// feature actually persists and applies is exercised. Real-LLM generation is verified manually.
async function installScriptedProvider(page: Page): Promise<void> {
  await page.addInitScript(
    ({ categoryId }) => {
      const provider = {
        profile: {
          profileId: "test:scripted",
          adapterId: "ai-local",
          adapterVersion: "1.0.0",
          executionLocation: "local",
          reportedModel: "scripted-test-model",
          supportedTasks: ["merchant.resolve.v1", "category.classify.v1"],
          structuredOutput: true,
          contextLimit: 4096,
          outputLimit: 512,
        },
        health: () => Promise.resolve({ ok: true }),
        execute: (request: { task: string }) => {
          if (request.task === "merchant.resolve.v1") {
            return Promise.resolve({
              ok: true,
              output: { label: "Bistro", confidence: 0.9, evidence: ["matched_alias"] },
            });
          }
          return Promise.resolve({
            ok: true,
            output: { categoryId, confidence: 0.95, rationale: "Looks like a restaurant." },
          });
        },
      };
      (globalThis as { __FI_AI_TEST__?: unknown }).__FI_AI_TEST__ = { provider, ready: true };
    },
    { categoryId: RESTAURANTS_CATEGORY_ID },
  );
}

// A scripted provider whose category pass is slow, so a run stays in "running" long enough to
// observe the progress bar and Cancel control before it would settle.
async function installSlowScriptedProvider(page: Page): Promise<void> {
  await page.addInitScript(
    ({ categoryId }) => {
      const provider = {
        profile: {
          profileId: "test:scripted-slow",
          adapterId: "ai-local",
          adapterVersion: "1.0.0",
          executionLocation: "local",
          reportedModel: "scripted-test-model",
          supportedTasks: ["merchant.resolve.v1", "category.classify.v1"],
          structuredOutput: true,
          contextLimit: 4096,
          outputLimit: 512,
        },
        health: () => Promise.resolve({ ok: true }),
        execute: async (request: { task: string }) => {
          if (request.task === "merchant.resolve.v1") {
            return {
              ok: true,
              output: { label: "Bistro", confidence: 0.9, evidence: ["matched_alias"] },
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return {
            ok: true,
            output: { categoryId, confidence: 0.95, rationale: "Looks like a restaurant." },
          };
        },
      };
      (globalThis as { __FI_AI_TEST__?: unknown }).__FI_AI_TEST__ = { provider, ready: true };
    },
    { categoryId: RESTAURANTS_CATEGORY_ID },
  );
}

async function clickSuggest(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Suggest categories & merchants" }).dispatchEvent("click");
}

async function importSingleTransaction(
  page: Page,
  fileName: string,
  description: string,
  row: { readonly date: string; readonly amount: string } = {
    date: "2026-01-15",
    amount: "-$24.50",
  },
): Promise<void> {
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Map every transaction before it enters your ledger." }),
  ).toBeVisible();
  await page.getByLabel("Select CSV files, or a single OFX/QFX or PDF statement").setInputFiles({
    name: fileName,
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Transfer date,Description,Amount,Balance",
        `${row.date},${description},${row.amount},$1000.00`,
      ].join("\n"),
    ),
  });
  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD" });
  await page
    .getByRole("combobox", { name: "Date format (must be confirmed)" })
    .selectOption("YYYY-MM-DD");
  await page
    .getByRole("combobox", { name: "What does a positive amount mean?" })
    .selectOption("inflow");
  await expect(page.getByRole("button", { name: "Commit accepted transactions" })).toBeEnabled();
  await page.getByRole("button", { name: "Commit accepted transactions" }).click();
  await expect(page.getByText(/Committed 1 transaction/)).toBeVisible();
}

test("accept-to-rule from an AI suggestion classifies future imports without a new suggestion", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await installScriptedProvider(page);

  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("AI suggestions household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await importSingleTransaction(page, "first.csv", "THE CORNER BISTRO");

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();

  // Run the (scripted) model and accept the category proposal for similar transactions → rule.
  // These buttons are dispatched via `dispatchEvent` rather than `click()`: the real React handler
  // runs, but Playwright's actionability mouse-move stalls against the dev-server here even though
  // the button is fully unobstructed, so we skip that check without weakening the assertion.
  await clickSuggest(page);
  const acceptSimilar = page.getByRole("button", {
    name: /Accept and create a rule for similar transactions: Restaurants/i,
  });
  await expect(acceptSimilar).toBeVisible();
  await acceptSimilar.dispatchEvent("click");
  await expect(page.getByText(/created a rule/i).first()).toBeVisible();

  // Re-import a transaction sharing the description but on a different date/amount (so it is not a
  // duplicate); the rule created above must classify it deterministically at import.
  await importSingleTransaction(page, "second.csv", "THE CORNER BISTRO", {
    date: "2026-03-22",
    amount: "-$41.00",
  });
  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();

  // No new AI suggestion for the rule-resolved transaction.
  await clickSuggest(page);
  await expect(
    page.getByText(/No new suggestions|No suggestions to review/i).first(),
  ).toBeVisible();

  // The whole flow stayed on-device: no external network request.
  network.assertClean();
});

test("shows progress and a Cancel control while a suggestion run is in progress", async ({
  page,
}) => {
  await installSlowScriptedProvider(page);

  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("AI progress household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await importSingleTransaction(page, "first.csv", "THE CORNER BISTRO");
  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();

  // The slow provider keeps the run in progress; the progress bar and Cancel must be visible.
  await clickSuggest(page);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancel suggestion run/i })).toBeVisible();
});
