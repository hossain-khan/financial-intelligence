import { describe, expect, it } from "vitest";

import { mapOfxResult } from "./candidates";
import { OfxStatementParser } from "./parser";

const SGML = [
  "OFXHEADER:100",
  "DATA:OFXSGML",
  "VERSION:102",
  "ENCODING:USASCII",
  "",
  "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>",
  "<CURDEF>USD",
  "<BANKACCTFROM><BANKID>021<ACCTID>0001234567<ACCTTYPE>CHECKING</BANKACCTFROM>",
  "<BANKTRANLIST>",
  "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115<TRNAMT>-42.50<FITID>A1<NAME>COFFEE</STMTTRN>",
  "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240116<TRNAMT>1000.00<FITID>A2<NAME>PAYROLL</STMTTRN>",
  "</BANKTRANLIST>",
  "</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
].join("\n");

async function parse(text: string) {
  const bytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
  return new OfxStatementParser().parse(
    {
      metadata: {
        fileName: "s.ofx",
        mediaType: "application/x-ofx",
        byteSize: bytes.byteLength,
        sha256: "a".repeat(64),
      },
      bytes,
    },
    new AbortController().signal,
  );
}

describe("mapOfxResult", () => {
  it("maps parsed rows into canonical candidates with provenance", async () => {
    const result = await parse(SGML);
    const mapped = mapOfxResult(result, {
      accountId: "acct-1",
      accountCurrency: "USD",
      sourceFileSha256: "a".repeat(64),
    });
    expect(mapped.canContinue).toBe(true);
    expect(mapped.candidates).toHaveLength(2);
    expect(mapped.candidates[0]).toMatchObject({
      accountId: "acct-1",
      postedDate: "2024-01-15",
      amount: "-42.50",
      currency: "USD",
      sourceTransactionId: "A1",
    });
    expect(mapped.candidates[0]?.provenance).toMatchObject({
      parserId: "ofx",
      sourceLocation: "statement:1/transaction:1",
    });
    expect(mapped.totals).toMatchObject({ inflow: "1000.00", outflow: "42.50", validRows: 2 });
  });

  it("flags a statement/account currency mismatch as an error", async () => {
    const result = await parse(SGML);
    const mapped = mapOfxResult(result, {
      accountId: "acct-1",
      accountCurrency: "CAD",
      sourceFileSha256: "a".repeat(64),
    });
    expect(mapped.canContinue).toBe(false);
    expect(mapped.candidates).toHaveLength(0);
    expect(mapped.issues.some((issue) => issue.field === "currency")).toBe(true);
  });

  it("requires a target account", async () => {
    const result = await parse(SGML);
    const mapped = mapOfxResult(result, {
      accountId: "   ",
      accountCurrency: "USD",
      sourceFileSha256: "a".repeat(64),
    });
    expect(mapped.issues.some((issue) => issue.code === "ACCOUNT_REQUIRED")).toBe(true);
    expect(mapped.canContinue).toBe(false);
  });
});
