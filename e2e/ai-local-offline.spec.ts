import { test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

// The browser-local AI provider must never reach the network: models are sideloaded from disk and
// served from Cache Storage. This spec seeds a fake model cache entry and confirms that opening the
// app + navigating to Settings (which runs the capability preflight and reads the model cache)
// issues zero external requests. Real WebGPU generation is validated by the maintainer's spike, not
// headless CI; here we assert the acquisition + no-network guarantee.
test("local AI settings and a seeded model cache make no external requests", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);

  await page.goto("/");
  await page.evaluate(async () => {
    const cache = await caches.open("financial-intelligence-model-local-classifier-v1");
    await cache.put("model.onnx", new Response(new Uint8Array([1, 2, 3])));
  });

  await page.goto("/settings");
  await page.getByRole("heading", { name: /Local AI/i }).waitFor();
  await page.waitForLoadState("networkidle");

  network.assertClean();
});
