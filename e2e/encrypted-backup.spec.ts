import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
const PASSPHRASE = "correct horse battery staple";

test("downloads and verifies an encrypted backup without restoring data", async ({
  context,
  page,
}) => {
  const passwordFormWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Password forms should have")) {
      passwordFormWarnings.push(message.text());
    }
  });
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  const workspaceName = page.getByRole("textbox", { name: "Workspace name" });
  await workspaceName.fill("Backup test household");
  await workspaceName.press("Enter");

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.locator('form input[autocomplete="username"]')).toHaveCount(2);
  await page.getByLabel("Passphrase", { exact: true }).first().fill(PASSPHRASE);
  await page.getByLabel("Confirm passphrase").fill(PASSPHRASE);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create and download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.fintbackup$/u);
  const path = await download.path();
  expect(path).not.toBeNull();

  await page.getByLabel("Encrypted backup file").setInputFiles(path!);
  await page.getByLabel("Passphrase", { exact: true }).last().fill("this is the wrong passphrase");
  await page.getByRole("button", { name: "Verify and preview" }).click();
  await expect(page.getByText("The backup could not be verified.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Verified backup preview")).not.toBeVisible();

  await page.getByLabel("Passphrase", { exact: true }).last().fill(PASSPHRASE);
  await page.getByRole("button", { name: "Verify and preview" }).click();
  await expect(page.getByLabel("Verified backup preview")).toContainText("Backup test household");
  await expect(page.getByText("Nothing was restored or changed.", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Backup test household", {
      exact: true,
    }),
  ).toHaveCount(1);
  network.assertClean();
  expect(passwordFormWarnings).toEqual([]);
});
