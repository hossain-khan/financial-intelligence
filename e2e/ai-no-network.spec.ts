import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

// With no AI provider configured (the default kind:none profile), the rules-only path must issue
// zero AI/model/API network traffic. The local network guard aborts any request to another origin,
// so exercising the core surfaces and asserting the guard stayed clean proves the default path is
// network-free.
test("rules-only default path issues no AI network traffic across core surfaces", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);

  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("No-AI household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await page.goto("/import");
  await page.waitForLoadState("networkidle");
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  network.assertClean();
});
