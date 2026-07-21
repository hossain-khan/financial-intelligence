import { describe, expect, it } from "vitest";

import { FixtureLintError, lintCase } from "./fixture-linter";

const valid = {
  id: "merchant-noise-1",
  task: "merchant.resolve.v1",
  schemaVersion: "1.0.0",
  locale: "en-CA",
  input: { tokens: ["sq", "coffee"] },
  allowedVocabulary: ["square-coffee"],
  expected: { kind: "exact", value: "square-coffee" },
  ambiguity: "clear",
  expectedAbstention: false,
  privacyAssertions: { mustNotEcho: [] },
  tags: ["merchant-noise"],
};

describe("lintCase", () => {
  it("accepts a well-formed synthetic case", () => {
    expect(lintCase(valid).id).toBe("merchant-noise-1");
  });

  it("rejects an unknown field", () => {
    expect(() => lintCase({ ...valid, secretNote: "x" })).toThrow(FixtureLintError);
  });

  it("rejects a value that looks like an account number", () => {
    expect(() => lintCase({ ...valid, tags: ["4111111111111111"] })).toThrow(FixtureLintError);
  });

  it("rejects an email-shaped value", () => {
    expect(() => lintCase({ ...valid, tags: ["a@b.com"] })).toThrow(FixtureLintError);
  });

  it("rejects a money-like value", () => {
    expect(() => lintCase({ ...valid, tags: ["-12.34"] })).toThrow(FixtureLintError);
  });
});
