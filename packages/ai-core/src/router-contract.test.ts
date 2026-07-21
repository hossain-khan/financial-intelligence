import { describe, expect, it } from "vitest";

import { AiRouter, type RouterDeps } from "./router";
import { FakeProvider } from "./testing/fake-provider";

const good = { ok: true as const, output: { categoryId: "dining", confidence: 0.8, rationale: "ok" } };
const bad = { ok: true as const, output: { categoryId: 5 } };
const base = {
  task: "category.classify.v1" as const,
  payload: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] },
  allowedIds: ["dining"],
};
const deps = (provider: FakeProvider, allowRepair = false): RouterDeps => ({
  provider,
  now: () => 0,
  newRequestId: () => "r",
  digest: () => "d",
  allowRepair,
});

describe("router repair policy", () => {
  it("repairs once then accepts on the retry", async () => {
    const provider = new FakeProvider({ responses: [bad, good] });
    const router = new AiRouter(deps(provider, true));
    const { suggestion } = await router.execute(base);
    expect(suggestion?.output).toEqual(good.output);
    expect(provider.calls).toHaveLength(2);
    expect((provider.calls[1]?.payload as { repairHints?: unknown }).repairHints).toBeDefined();
  });

  it("abstains after a second invalid result", async () => {
    const provider = new FakeProvider({ responses: [bad, bad] });
    const router = new AiRouter(deps(provider, true));
    const { suggestion, audit } = await router.execute(base);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("invalid_output");
    expect(provider.calls).toHaveLength(2);
  });

  it("does not repair when allowRepair is false", async () => {
    const provider = new FakeProvider({ responses: [bad, good] });
    const router = new AiRouter(deps(provider, false));
    const { suggestion } = await router.execute(base);
    expect(suggestion).toBeNull();
    expect(provider.calls).toHaveLength(1);
  });

  it("maps a thrown provider error to provider_error", async () => {
    const provider = new FakeProvider({ responses: [], throwOnExecute: true });
    const router = new AiRouter(deps(provider));
    const { audit } = await router.execute(base);
    expect(audit.errorCode).toBe("provider_error");
  });
});
