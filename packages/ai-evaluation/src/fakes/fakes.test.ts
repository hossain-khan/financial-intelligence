import { describe, expect, it } from "vitest";

import {
  createAbstainingProvider,
  createLeakyProvider,
  createMalformedProvider,
  createPerfectProvider,
  createSlowProvider,
} from "./index";

const req = { task: "category.classify.v1" as const, payload: {} };
const opts = (signal: AbortSignal, deadlineMs = 1000) => ({ signal, deadlineMs });

describe("fake providers", () => {
  it("perfect provider returns the scripted grounded answer", async () => {
    const provider = createPerfectProvider(() => ({
      categoryId: "dining",
      confidence: 0.99,
      rationale: "ok",
    }));
    const result = await provider.execute(req, opts(new AbortController().signal));
    expect(result).toEqual({
      ok: true,
      output: { categoryId: "dining", confidence: 0.99, rationale: "ok" },
    });
  });

  it("abstaining provider returns unsupported", async () => {
    const result = await createAbstainingProvider().execute(
      req,
      opts(new AbortController().signal),
    );
    expect(result.ok).toBe(false);
  });

  it("malformed provider returns a schema-invalid payload", async () => {
    const result = await createMalformedProvider().execute(req, opts(new AbortController().signal));
    expect(result).toEqual({ ok: true, output: { categoryId: 123 } });
  });

  it("leaky provider echoes the forbidden token", async () => {
    const result = await createLeakyProvider("SECRET").execute(
      req,
      opts(new AbortController().signal),
    );
    expect(JSON.stringify(result)).toContain("SECRET");
  });

  it("slow provider settles cancelled when the deadline signal aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await createSlowProvider(10_000).execute(req, opts(controller.signal));
    expect(result.ok).toBe(false);
  });
});
