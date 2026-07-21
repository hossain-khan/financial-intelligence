import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { computeSourceFileMetadata } from "./metadata";
import { OfxStatementParser } from "./parser";

async function fixture(name: string): Promise<{
  bytes: ArrayBuffer;
  metadata: { fileName: string; mediaType: string; byteSize: number; sha256: string };
}> {
  const fileUrl = new URL(`../fixtures/${name}`, import.meta.url);
  const bytes = await readFile(fileUrl);
  const metadata = await computeSourceFileMetadata({
    fileName: name,
    mediaType: "application/ofx",
    bytes: bytes.buffer,
  });
  return { bytes: bytes.buffer, metadata };
}

const parser = new OfxStatementParser({
  now: () => 0,
  yieldControl: async () => {},
});

describe("OfxStatementParser", () => {
  it("supports OFX and QFX files", () => {
    expect(
      parser.supports({
        fileName: "statement.ofx",
        mediaType: "application/ofx",
        byteSize: 100,
        sha256: "a".repeat(64),
      }),
    ).toBe(true);
    expect(
      parser.supports({
        fileName: "statement.qfx",
        mediaType: "application/vnd.intu.qfx",
        byteSize: 100,
        sha256: "a".repeat(64),
      }),
    ).toBe(true);
  });

  it("does not support unrelated extensions", () => {
    expect(
      parser.supports({
        fileName: "statement.pdf",
        mediaType: "application/pdf",
        byteSize: 100,
        sha256: "a".repeat(64),
      }),
    ).toBe(false);
  });

  it("parses an OFX 1.x SGML bank statement", async () => {
    const { bytes, metadata } = await fixture("bank-sgml.ofx");
    const result = await parser.parse({ metadata, bytes }, new AbortController().signal);

    expect(result.parserId).toBe("financial-intelligence/ofx");
    expect(result.parserVersion).toBe("1.0.0");
    expect(result.rows).toHaveLength(2);
    expect(result.detectedMetadata).toMatchObject({
      dialect: "sgml",
      encoding: "windows-1252",
      accountType: "checking",
      accountHint: "******7890",
      currency: "CAD",
      ledgerBalanceAmount: "1100.00",
      ledgerBalanceDate: "2026-07-19",
    });

    const first = result.rows[0]!;
    expect(first.fields.postedDate).toBe("2026-07-18");
    expect(first.fields.amount).toBe("-4.25");
    expect(first.fields.description).toBe("COFFEE SHOP — Local cafe");
    expect(first.fields.sourceTransactionId).toBe("2026-07-18-001");
    expect(first.fields.DTPOSTED).toBe("20260718000000");

    const second = result.rows[1]!;
    expect(second.fields.amount).toBe("100.00");
    expect(second.fields.description).toBe("EMPLOYER PAYROLL");
  });

  it("parses an OFX 2.x XML bank statement", async () => {
    const { bytes, metadata } = await fixture("bank-xml.ofx");
    const result = await parser.parse({ metadata, bytes }, new AbortController().signal);

    expect(result.detectedMetadata).toMatchObject({
      dialect: "xml",
      accountType: "savings",
      currency: "USD",
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.fields.transactionDate).toBe("2026-07-09");
    expect(result.rows[0]?.fields.DTUSER).toBe("20260709");
  });

  it("parses a credit-card XML statement", async () => {
    const { bytes, metadata } = await fixture("creditcard-xml.ofx");
    const result = await parser.parse({ metadata, bytes }, new AbortController().signal);

    expect(result.detectedMetadata).toMatchObject({
      accountType: "credit-card",
      currency: "CAD",
      accountHint: "************8888",
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.fields.amount).toBe("-75.50");
  });

  it("reports row-level errors for malformed transactions without partial commit data", async () => {
    const { bytes, metadata } = await fixture("malformed.ofx");
    const result = await parser.parse({ metadata, bytes }, new AbortController().signal);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.fields.description).toBe("VALID ROW");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_AMOUNT", severity: "error" }),
      ]),
    );
  });

  it("rejects files that exceed the byte limit", async () => {
    const bytes = new ArrayBuffer(1);
    await expect(
      parser.parse(
        {
          metadata: {
            fileName: "small.ofx",
            mediaType: "application/ofx",
            byteSize: 16 * 1024 * 1024 + 1,
            sha256: "a".repeat(64),
          },
          bytes,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/byte size/i);
  });

  it("respects cancellation", async () => {
    const { bytes, metadata } = await fixture("bank-sgml.ofx");
    const controller = new AbortController();
    controller.abort();
    await expect(parser.parse({ metadata, bytes }, controller.signal)).rejects.toThrow(
      /cancelled/i,
    );
  });
});
