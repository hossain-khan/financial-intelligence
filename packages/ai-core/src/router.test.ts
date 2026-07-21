import { describe, expect, it } from "vitest";

import { AiRouter, type RouterDeps } from "./router";
import { FakeProvider } from "./testing/fake-provider";

function deps(provider: FakeProvider, overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    provider,
    now: () => 1000,
    newRequestId: () => "req-1",
    digest: () => "digest",
    ...overrides,
  };
}

const validResponse = {
  ok: true as const,
  output: { categoryId: "dining", confidence: 0.9, rationale: "coffee" },
};
const req = {
  task: "category.classify.v1" as const,
  payload: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] },
  allowedIds: ["dining"],
};

describe("AiRouter", () => {
  it("returns a validated suggestion and a success audit", async () => {
    const router = new AiRouter(deps(new FakeProvider({ responses: [validResponse] })));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion?.output).toEqual(validResponse.output);
    expect(audit.outcome).toBe("accepted");
    expect(audit.task).toBe("category.classify.v1");
    expect(audit).not.toHaveProperty("output");
  });

  it("abstains when the model returns a category outside the allowed set", async () => {
    const bad = { ok: true as const, output: { categoryId: "hacking", confidence: 0.9, rationale: "x" } };
    const router = new AiRouter(deps(new FakeProvider({ responses: [bad] })));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion).toBeNull();
    expect(audit.outcome).toBe("abstained");
    expect(audit.errorCode).toBe("invalid_output");
  });

  it("returns unsupported when the provider does not support the task", async () => {
    const provider = new FakeProvider({ profile: { supportedTasks: [] }, responses: [validResponse] });
    const router = new AiRouter(deps(provider));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("unsupported");
  });

  it("settles cancelled with no success audit when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const router = new AiRouter(deps(new FakeProvider({ responses: [validResponse] })));
    const { suggestion, audit } = await router.execute({ ...req, signal: controller.signal });
    expect(suggestion).toBeNull();
    expect(audit.outcome).toBe("cancelled");
  });

  it("rejects malformed output as invalid_output without mutation", async () => {
    const malformed = { ok: true as const, output: { categoryId: 123 } };
    const router = new AiRouter(deps(new FakeProvider({ responses: [malformed] })));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("invalid_output");
  });
});
