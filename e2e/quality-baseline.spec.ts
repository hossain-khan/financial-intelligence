import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("boots under the production CSP without runtime code generation", async ({ page }) => {
  const pageErrors: string[] = [];
  const policyViolations: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      policyViolations.push(message.text());
    }
  });

  const response = await page.goto("/");

  expect(response?.headers()["content-security-policy"]).toContain(
    "script-src 'self' 'wasm-unsafe-eval'",
  );
  expect(response?.headers()["content-security-policy"]).not.toContain("'unsafe-eval'");
  await expect(page.getByText("No workspace exists on this device yet.")).toBeVisible();
  await page.getByRole("button", { name: "Create workspace" }).click();
  expect(pageErrors).toEqual([]);
  expect(policyViolations).toEqual([]);
});

test("serves complete install metadata and brand icons", async ({ request, page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  });

  for (const asset of [
    "/favicon.svg",
    "/favicon-32x32.png",
    "/apple-touch-icon.png",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
  ]) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBe(true);
  }
});

test("creates and reloads a workspace without unexpected network access", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await expect(page.getByText("No workspace exists on this device yet.")).toBeVisible();
  await assertNoAxeViolations(page);

  await page.getByRole("textbox", { name: "Workspace name" }).fill("Browser test household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Browser test household"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Browser test household"),
  ).toBeVisible();

  network.assertClean();
});

test("reloads the installed application while offline", async ({ browserName, context, page }) => {
  test.skip(
    browserName !== "chromium",
    "Playwright offline emulation bypasses the service-worker navigation path outside Chromium; verify vendor browsers in release evidence.",
  );
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Offline household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Offline household"),
  ).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Offline household"),
  ).toBeVisible();
  await context.setOffline(false);

  network.assertClean();
});

test("critical initial, error, and settings states pass axe checks", async ({ browser }) => {
  const standardContext = await browser.newContext();
  const standardNetwork = await installLocalNetworkGuard(standardContext, LOCAL_ORIGIN);
  const standardPage = await standardContext.newPage();
  await standardPage.goto("/");
  await assertNoAxeViolations(standardPage);
  await standardPage.goto("/settings");
  await expect(standardPage.getByRole("heading", { name: "Privacy and storage" })).toBeVisible();
  await assertNoAxeViolations(standardPage);
  standardNetwork.assertClean();
  await standardContext.close();

  const errorContext = await browser.newContext();
  await errorContext.addInitScript(() => {
    Object.defineProperty(indexedDB, "open", {
      configurable: true,
      value: () => {
        throw new DOMException("Synthetic storage failure", "UnknownError");
      },
    });
  });
  const errorNetwork = await installLocalNetworkGuard(errorContext, LOCAL_ORIGIN);
  const errorPage = await errorContext.newPage();
  await errorPage.goto("/");
  await expect(errorPage.getByRole("alert")).toContainText("could not be opened");
  await assertNoAxeViolations(errorPage);
  errorNetwork.assertClean();
  await errorContext.close();
});

test("supports keyboard focus, narrow reflow, and reduced motion", async ({
  browserName,
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  if (browserName === "webkit") {
    // WebKit follows the host macOS full-keyboard-access preference, which is unavailable in CI.
    await skipLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS("outline-style", "solid");
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < 0 || bounds.right > window.innerWidth;
        })
        .map((element) => ({
          element: element.tagName.toLowerCase(),
          className: element.className,
          bounds: element.getBoundingClientRect().toJSON(),
        })),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
});

test("network guard fails closed for an unexpected endpoint", async ({ context, page }) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.goto("https://unexpected.invalid/collect").catch(() => undefined);

  expect(network.unexpectedRequests).toEqual(["https://unexpected.invalid/collect"]);
  expect(() => network.assertClean()).toThrow("Unexpected local-mode network requests");
});

async function assertNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}
