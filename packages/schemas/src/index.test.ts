import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { validateFinancialBrain } from "./index";

describe("Financial Brain schema", () => {
  it("accepts the maintained synthetic example", async () => {
    const source = await readFile(
      new URL("../../../examples/sample-brain.json", import.meta.url),
      "utf8",
    );

    expect(validateFinancialBrain(JSON.parse(source))).toEqual({ valid: true, errors: [] });
  });

  it("rejects raw transaction history", () => {
    expect(
      validateFinancialBrain({
        schemaVersion: "1.0.0",
        transactions: [],
      }).valid,
    ).toBe(false);
  });
});
