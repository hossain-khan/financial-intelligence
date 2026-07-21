import { describe, expect, it } from "vitest";

import { canonicalJson } from "./canonical-json";

describe("canonicalJson", () => {
  it("sorts object keys at every level, preserving array order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });
});
