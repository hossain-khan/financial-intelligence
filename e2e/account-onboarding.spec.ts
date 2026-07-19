import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

test("creates, reloads, and archives an account with keyboard-complete onboarding", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");

  const workspaceName = page.getByRole("textbox", { name: "Workspace name" });
  await workspaceName.fill("Account test household");
  await workspaceName.press("Enter");
  await expect(page.getByRole("heading", { name: "Add a financial account" })).toBeVisible();
  await expect(page.getByText("No bank login or full account number is used.")).toBeVisible();

  const accountName = page.getByRole("textbox", { name: "Account name" });
  await accountName.fill("Everyday account");
  await page.getByRole("combobox", { name: "Account type" }).selectOption("checking");
  await page.getByRole("textbox", { name: "Masked identifier (optional)" }).fill("•••• 1234");
  await accountName.press("Enter");

  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  const archive = page.getByRole("button", { name: "Archive" });
  await archive.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < 0 || bounds.right > window.innerWidth;
        })
        .map((element) => element.tagName.toLowerCase()),
    ),
  ).toEqual([]);
  network.assertClean();
});
