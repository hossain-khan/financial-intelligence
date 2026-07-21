import { describe, expect, it } from "vitest";

import { sha256Hex } from "./digest";

describe("sha256Hex", () => {
  it("returns the known SHA-256 of an empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
