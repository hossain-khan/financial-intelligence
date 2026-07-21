import { describe, expect, it } from "vitest";

import { mapOfxResult } from "./candidates";
import { OfxImportError } from "./errors";
import { BANK_SGML, CREDITCARD_XML, XXE_XML, encodeUtf8 } from "./fixtures";
import { OfxStatementParser } from "./parser";

const METADATA = {
  fileName: "s.ofx",
  mediaType: "application/x-ofx",
  byteSize: 0,
  sha256: "c".repeat(64),
};

async function parse(text: string, options?: unknown) {
  const bytes = encodeUtf8(text);
  return new OfxStatementParser().parse(
    { metadata: { ...METADATA, byteSize: bytes.byteLength }, bytes, formatOptions: options },
    new AbortController().signal,
  );
}

describe("OFX security and adversarial handling", () => {
  it("parses the synthetic bank SGML fixture into three candidates", async () => {
    const result = await parse(BANK_SGML);
    const mapped = mapOfxResult(result, {
      accountId: "acct",
      accountCurrency: "USD",
      sourceFileSha256: "c".repeat(64),
    });
    expect(mapped.candidates).toHaveLength(3);
    // The masked hint exposes only the last four digits, never the full account number.
    expect(String(result.detectedMetadata?.maskedAccountHint)).toBe("••••5678");
    expect(JSON.stringify(result)).not.toContain("0000000012345678");
  });

  it("parses the synthetic credit-card XML fixture and decodes entities", async () => {
    const result = await parse(CREDITCARD_XML);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]?.fields.description).toBe("PAYMENT & THANK YOU");
    expect(result.detectedMetadata?.dialect).toBe("ofx-xml");
  });

  it("rejects an XXE document and never resolves the external entity", async () => {
    await expect(parse(XXE_XML)).rejects.toThrow(OfxImportError);
    await expect(parse(XXE_XML)).rejects.toThrow(/DTD|entity/u);
  });

  it("rejects a document without an OFX signature", async () => {
    await expect(parse("<html><body>not ofx</body></html>")).rejects.toThrow(/OFX/u);
  });

  it("enforces the transaction limit", async () => {
    await expect(parse(BANK_SGML, { limits: { maxTransactions: 2 } })).rejects.toThrow(
      /transaction limit/u,
    );
  });

  it("enforces the field-length limit", async () => {
    const huge = BANK_SGML.replace("COFFEE BAR", "X".repeat(20_000));
    await expect(parse(huge, { limits: { maxFieldCharacters: 100 } })).rejects.toThrow(
      /length limit/u,
    );
  });

  it("enforces the decoded-character limit", async () => {
    await expect(parse(BANK_SGML, { limits: { maxDecodedCharacters: 50 } })).rejects.toThrow(
      /character limit/u,
    );
  });

  it("fails closed on a truncated document rather than emitting a partial transaction", async () => {
    // Cut the file mid-transaction, before the first amount, and drop the closing tags.
    const truncated = BANK_SGML.slice(0, BANK_SGML.indexOf("<TRNAMT>-42.50"));
    // Either the document is rejected outright, or it parses with no valid candidate — never a
    // transaction with a fabricated amount.
    try {
      const result = await parse(truncated);
      const mapped = mapOfxResult(result, {
        accountId: "acct",
        accountCurrency: "USD",
        sourceFileSha256: "c".repeat(64),
      });
      expect(mapped.candidates.every((candidate) => /^-?\d+\.\d{2}$/u.test(candidate.amount))).toBe(
        true,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(OfxImportError);
    }
  });

  it("is cancellable before work begins", async () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = encodeUtf8(BANK_SGML);
    await expect(
      new OfxStatementParser().parse(
        { metadata: { ...METADATA, byteSize: bytes.byteLength }, bytes },
        controller.signal,
      ),
    ).rejects.toThrow(/cancelled/iu);
  });

  it("rejects an oversized file before parsing", async () => {
    await expect(parse(BANK_SGML, { limits: { maxFileBytes: 10 } })).rejects.toThrow(/size limit/u);
  });

  it("never emits the amount of an invalid transaction as a committed candidate", async () => {
    const result = await parse(BANK_SGML.replace("-42.50", "1.2.3"));
    const mapped = mapOfxResult(result, {
      accountId: "acct",
      accountCurrency: "USD",
      sourceFileSha256: "c".repeat(64),
    });
    expect(mapped.candidates).toHaveLength(2);
    expect(mapped.canContinue).toBe(false);
  });
});
