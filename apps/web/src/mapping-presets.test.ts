// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { loadMappingPreset, saveMappingPreset } from "./mapping-presets";

let entries: Map<string, string>;
let storage: Pick<Storage, "getItem" | "setItem">;

beforeEach(() => {
  entries = new Map();
  storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
});

describe("mapping presets", () => {
  it("round-trips compatible non-sensitive mapping settings without account context", () => {
    saveMappingPreset(storage, {
      formatSignature: "csv-1234",
      parserId: "csv",
      parserVersion: "1.0.0",
      now: "2026-07-19T20:00:00.000Z",
      mapping: {
        accountId: "private-account-id",
        accountCurrency: "CAD",
        postedDateColumn: "Date",
        descriptionColumn: "Description",
        amount: { kind: "signed", column: "Amount", positiveDirection: "inflow" },
        ignoredColumns: [],
        dateFormat: "YYYY-MM-DD",
        numberFormat: { decimalSeparator: ".", groupSeparator: "," },
      },
    });

    const raw = [...entries.values()].join("");
    expect(raw).not.toContain("private-account-id");
    expect(loadMappingPreset(storage, "csv-1234", "csv", "1.0.0")?.mapping).toMatchObject({
      postedDateColumn: "Date",
      descriptionColumn: "Description",
    });
  });

  it("ignores presets from a different parser version", () => {
    storage.setItem(
      "financial-intelligence:mapping-preset:2.0.0:csv-1234",
      JSON.stringify({
        schemaVersion: 1,
        mappingVersion: "1.0.0",
        parserId: "csv",
        parserVersion: "1.0.0",
        formatSignature: "csv-1234",
        mapping: {},
      }),
    );
    expect(loadMappingPreset(storage, "csv-1234", "csv", "2.0.0")).toBeUndefined();
  });

  it("ignores malformed compatible-looking presets", () => {
    storage.setItem(
      "financial-intelligence:mapping-preset:1.0.0:csv-1234",
      JSON.stringify({
        schemaVersion: 1,
        mappingVersion: "1.0.0",
        parserId: "csv",
        parserVersion: "1.0.0",
        formatSignature: "csv-1234",
        mapping: { amount: "not-a-mapping" },
      }),
    );
    expect(loadMappingPreset(storage, "csv-1234", "csv", "1.0.0")).toBeUndefined();
  });
});
