import { describe, expect, it } from "vitest";

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
  "<BANKTRANLIST><DTSTART>20240101<DTEND>20240131",
  "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115<TRNAMT>-42.50<FITID>A1<NAME>COFFEE<MEMO>Latte</STMTTRN>",
  "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240116<TRNAMT>1000.00<FITID>A2<NAME>PAYROLL</STMTTRN>",
  "</BANKTRANLIST>",
  "<LEDGERBAL><BALAMT>957.50<DTASOF>20240131</LEDGERBAL>",
  "</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
].join("\n");

async function parse(text: string) {
  const bytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
  const metadata = {
    fileName: "statement.ofx",
    mediaType: "application/x-ofx",
    byteSize: bytes.byteLength,
    sha256: "0".repeat(64),
  };
  return new OfxStatementParser().parse({ metadata, bytes }, new AbortController().signal);
}

describe("OfxStatementParser", () => {
  it("produces canonical source rows from an SGML bank statement", async () => {
    const result = await parse(SGML);
    expect(result.parserId).toBe("ofx");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.sourceLocation).toBe("statement:1/transaction:1");
    expect(result.rows[0]?.fields).toMatchObject({
      posted_date: "2024-01-15",
      amount: "-42.50",
      fitid: "A1",
      trntype: "DEBIT",
      description: "COFFEE — Latte",
    });
    expect(result.rows[1]?.fields.amount).toBe("1000.00");
    expect(result.detectedMetadata).toMatchObject({
      dialect: "ofx-sgml",
      currency: "USD",
      statementCount: 1,
      transactionCount: 2,
      accountType: "CHECKING",
      maskedAccountHint: "••••4567",
    });
  });

  it("rejects a file without an OFX signature", async () => {
    await expect(parse("just,a,csv\n1,2,3")).rejects.toThrow(/OFX/u);
  });

  it("reports an invalid amount as an error without emitting the row", async () => {
    const result = await parse(SGML.replace("-42.50", "4x.50"));
    expect(result.rows).toHaveLength(1);
    expect(result.issues.some((issue) => issue.code === "INVALID_AMOUNT")).toBe(true);
  });

  it("warns on an unsupported investment section", async () => {
    const result = await parse(
      SGML.replace("<BANKMSGSRSV1>", "<INVSTMTMSGSRSV1></INVSTMTMSGSRSV1><BANKMSGSRSV1>"),
    );
    expect(result.issues.some((issue) => issue.code === "UNSUPPORTED_SECTION")).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it("supports() recognizes .ofx and .qfx by name", () => {
    const parser = new OfxStatementParser();
    const base = { mediaType: "", byteSize: 1, sha256: "0".repeat(64) };
    expect(parser.supports({ ...base, fileName: "a.ofx" })).toBe(true);
    expect(parser.supports({ ...base, fileName: "a.qfx" })).toBe(true);
    expect(parser.supports({ ...base, fileName: "a.csv" })).toBe(false);
  });
});
