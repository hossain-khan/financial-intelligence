import { readFile } from "node:fs/promises";

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
  await expect(page.locator('form input[autocomplete="username"]')).toHaveCount(3);
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

test("restores a backup into a fresh profile as a new workspace", async ({ browser }) => {
  // Create + download a backup in one profile.
  const sourceContext = await browser.newContext();
  const sourceNetwork = await installLocalNetworkGuard(sourceContext, LOCAL_ORIGIN);
  const sourcePage = await sourceContext.newPage();
  await sourcePage.goto("/");
  await sourcePage.getByRole("textbox", { name: "Workspace name" }).fill("Restore round-trip");
  await sourcePage.getByRole("button", { name: "Create workspace" }).click();
  await sourcePage.getByRole("link", { name: "Settings" }).click();
  await sourcePage.getByLabel("Passphrase", { exact: true }).first().fill(PASSPHRASE);
  await sourcePage.getByLabel("Confirm passphrase").fill(PASSPHRASE);
  const downloadPromise = sourcePage.waitForEvent("download");
  await sourcePage.getByRole("button", { name: "Create and download" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();
  // Read the bytes before closing the source context, whose download temp file is cleaned up on close.
  const backupBytes = await readFile(backupPath!);
  const backupName = download.suggestedFilename();
  sourceNetwork.assertClean();
  await sourceContext.close();

  // Restore it into a brand-new profile with empty local storage.
  const freshContext = await browser.newContext();
  const freshNetwork = await installLocalNetworkGuard(freshContext, LOCAL_ORIGIN);
  const freshPage = await freshContext.newPage();
  await freshPage.goto("/settings");
  await freshPage.getByLabel("Backup file to restore").setInputFiles({
    name: backupName,
    mimeType: "application/vnd.financial-intelligence.encrypted-backup+json",
    buffer: backupBytes,
  });
  await freshPage.getByLabel("Backup passphrase", { exact: true }).fill(PASSPHRASE);
  await freshPage.getByRole("button", { name: "Verify and plan restore" }).click();

  await expect(freshPage.getByLabel("Restore plan")).toContainText("Restore round-trip");
  await freshPage.getByRole("button", { name: "Restore now" }).click();
  await expect(freshPage.getByText(/Your original data is safe/)).toBeVisible();

  await freshPage.getByRole("link", { name: "Overview" }).click();
  await expect(
    freshPage
      .getByRole("list", { name: "Local workspaces" })
      .getByText("Restore round-trip", { exact: true }),
  ).toHaveCount(1);
  freshNetwork.assertClean();
  await freshContext.close();
});
