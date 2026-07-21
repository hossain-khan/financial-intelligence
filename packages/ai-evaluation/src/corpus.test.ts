import { describe, expect, it } from "vitest";

import { CorpusDigestError, assertCorpusDigests, type EvalCase } from "./corpus";

const caseA = { id: "a", task: "merchant.resolve.v1" } as unknown as EvalCase;

describe("assertCorpusDigests", () => {
  it("passes when digests match", async () => {
    const cases = new Map([["a", caseA]]);
    await expect(
      assertCorpusDigests(cases, { a: "digest-a" }, () => Promise.resolve("digest-a")),
    ).resolves.toBeUndefined();
  });

  it("throws on digest drift", async () => {
    const cases = new Map([["a", caseA]]);
    await expect(
      assertCorpusDigests(cases, { a: "digest-a" }, () => Promise.resolve("other")),
    ).rejects.toBeInstanceOf(CorpusDigestError);
  });

  it("throws when the case set differs from the lock", async () => {
    const cases = new Map([["a", caseA]]);
    await expect(
      assertCorpusDigests(cases, { a: "x", b: "y" }, () => Promise.resolve("x")),
    ).rejects.toBeInstanceOf(CorpusDigestError);
  });
});
