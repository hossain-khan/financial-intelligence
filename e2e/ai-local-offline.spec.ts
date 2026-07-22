import { test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

// Offline invariant: even though the CSP now permits an explicit model *download* from Hugging Face
// (ADR-021), everything except that one deliberate action stays network-free. This spec seeds a fake
// model cache entry and confirms that opening the app + navigating to Settings (capability preflight
// + model-cache read + inference path) issues zero external requests. The one-click download itself
// and real WebGPU generation are validated manually (the maintainer spike), not in headless CI.
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
