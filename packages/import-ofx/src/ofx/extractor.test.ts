import { describe, expect, it } from "vitest";

import { buildOfxTree } from "./dialect";
import { tokenizeOfx } from "./lexer";
import { DEFAULT_OFX_LIMITS } from "../options";
import { extractStatements } from "./extractor";

const KNOWN_LEAFS = new Set([
  "OFXHEADER",
  "VERSION",
  "SECURITY",
  "ENCODING",
  "OLDFILEUID",
  "NEWFILEUID",
  "DTPOSTED",
  "DTUSER",
  "DTAVAIL",
  "TRNAMT",
  "FITID",
  "NAME",
  "MEMO",
  "TRNTYPE",
  "CHECKNUM",
  "REFNUM",
  "SIC",
  "BANKID",
  "ACCTID",
  "ACCTTYPE",
  "CURDEF",
  "BALAMT",
  "DTASOF",
  "TRNUID",
  "STATUS",
  "SEVERITY",
  "MESSAGE",
  "LANGUAGE",
  "ORG",
  "FID",
  "DTSTART",
  "DTEND",
]);

function parseOfx(text: string) {
  const tokens = tokenizeOfx(text, {
    maxElementCount: DEFAULT_OFX_LIMITS.maxElementCount,
    maxFieldLength: DEFAULT_OFX_LIMITS.maxFieldLength,
    maxOutputCharacters: DEFAULT_OFX_LIMITS.maxOutputCharacters,
  });
  return buildOfxTree(tokens, DEFAULT_OFX_LIMITS.maxElementDepth, KNOWN_LEAFS);
}

describe("extractStatements", () => {
  it("extracts bank and credit-card statements", () => {
    const tree = parseOfx(`OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>CAD</CURDEF>
        <BANKACCTFROM><ACCTID>1234567890</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260701</DTSTART>
          <DTEND>20260719</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260718000000</DTPOSTED>
            <TRNAMT>-4.25</TRNAMT>
            <FITID>1</FITID>
            <NAME>COFFEE</NAME>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL><BALAMT>100.00</BALAMT><DTASOF>20260719</DTASOF></LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <CURDEF>USD</CURDEF>
        <CCACCTFROM><ACCTID>5555666677778888</ACCTID></CCACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260718000000</DTPOSTED>
            <TRNAMT>-50.00</TRNAMT>
            <FITID>2</FITID>
            <NAME>RESTAURANT</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`);

    const result = extractStatements(tree, DEFAULT_OFX_LIMITS);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]).toMatchObject({
      accountType: "checking",
      currency: "CAD",
      accountHint: "******7890",
      ledgerBalance: { amount: "100.00", date: "2026-07-19" },
    });
    expect(result.statements[1]).toMatchObject({
      accountType: "credit-card",
      currency: "USD",
      accountHint: "************8888",
    });
    expect(result.unsupportedSections).toEqual([]);
  });

  it("reports unsupported sections as warnings", () => {
    const tree = parseOfx(`OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
  <INVSTMTMSGSRSV1>
    <INVESTMENT>unsupported</INVESTMENT>
  </INVSTMTMSGSRSV1>
</OFX>`);

    const result = extractStatements(tree, DEFAULT_OFX_LIMITS);
    expect(result.statements).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_SECTION", severity: "warning" }),
        expect.objectContaining({ code: "NO_STATEMENTS", severity: "error" }),
      ]),
    );
    expect(result.unsupportedSections).toContain("INVSTMTMSGSRSV1");
  });

  it("masks short account hints entirely", () => {
    const tree = parseOfx(`OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>CAD</CURDEF>
        <BANKACCTFROM><ACCTID>123</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
        <BANKTRANLIST></BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`);

    const result = extractStatements(tree, DEFAULT_OFX_LIMITS);
    expect(result.statements[0]?.accountHint).toBe("***");
  });
});
