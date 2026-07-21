import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

test("Settings shows storage usage, install guidance, and cache inventory", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Storage and installation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caches on this device" })).toBeVisible();
  // The app-shell namespace is always reported and always protected from clearing.
  await expect(page.getByText("Application shell")).toBeVisible();
  await expect(page.getByText(/Kept for offline recovery/i).first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  network.assertClean();
});

test("clearing a disposable cache never removes canonical IndexedDB data", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Cache Storage seeding via addAll is exercised on Chromium; other engines are covered in release evidence.",
  );
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Cache household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Cache household"),
  ).toBeVisible();

  // Seed a disposable model cache the app recognizes as clearable.
  await page.evaluate(async () => {
    const cache = await caches.open("financial-intelligence-model-test");
    await cache.put("https://127.0.0.1:4173/model.bin", new Response("x".repeat(2048)));
  });

  await page.goto("/settings");
  await expect(page.getByText("AI model files")).toBeVisible();
  const clearButton = page.getByRole("button", { name: "Clear" }).first();
  await clearButton.click();
  await page.getByRole("button", { name: "Confirm clear" }).click();
  await expect(page.getByText(/Cleared 1 cache/)).toBeVisible();

  // The model cache is gone…
  expect(await page.evaluate(() => caches.has("financial-intelligence-model-test"))).toBe(false);
  // …but the workspace in IndexedDB is untouched.
  await page.goto("/");
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Cache household"),
  ).toBeVisible();

  network.assertClean();
});

test("core ledger opens after a browser restart while offline", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Playwright offline emulation bypasses the service-worker navigation path outside Chromium; vendor browsers are verified in release evidence.",
  );
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Restart household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Restart household"),
  ).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);

  // Simulate a cold start in a brand-new page while offline.
  await context.setOffline(true);
  const restarted = await context.newPage();
  await restarted.goto("/transactions", { waitUntil: "domcontentloaded" });
  await expect(restarted.getByRole("heading", { level: 1 })).toBeVisible();
  await restarted.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(restarted.getByRole("heading", { name: "Privacy and storage" })).toBeVisible();
  await context.setOffline(false);

  network.assertClean();
});
