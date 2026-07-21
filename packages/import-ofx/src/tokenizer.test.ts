import { describe, expect, it } from "vitest";

import { decodeOfx } from "./decoder";
import { OfxImportError } from "./errors";
import { DEFAULT_OFX_LIMITS } from "./options";
import { tokenizeOfx, type OfxNode } from "./tokenizer";

const SGML_SAMPLE = [
  "OFXHEADER:100",
  "DATA:OFXSGML",
  "VERSION:102",
  "ENCODING:USASCII",
  "CHARSET:1252",
  "",
  "<OFX>",
  "<BANKMSGSRSV1><STMTTRNRS><STMTRS>",
  "<CURDEF>USD",
  "<BANKACCTFROM><BANKID>021000021<ACCTID>000123456789<ACCTTYPE>CHECKING</BANKACCTFROM>",
  "<BANKTRANLIST>",
  "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115120000<TRNAMT>-42.50<FITID>A1<NAME>COFFEE BAR</STMTTRN>",
  "</BANKTRANLIST>",
  "</STMTRS></STMTTRNRS></BANKMSGSRSV1>",
  "</OFX>",
].join("\n");

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CURDEF>CAD</CURDEF>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20240220</DTPOSTED><TRNAMT>19.99</TRNAMT><FITID>X9</FITID><NAME>REFUND &amp; CO</NAME></STMTTRN>
</BANKTRANLIST>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

function encode(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function findFirst(node: OfxNode, tag: string): OfxNode | undefined {
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const found = findFirst(child, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe("decodeOfx + tokenizeOfx", () => {
  it("parses OFX 1.x SGML with unclosed leaf elements", () => {
    const decoded = decodeOfx(encode(SGML_SAMPLE), DEFAULT_OFX_LIMITS.maxDecodedCharacters);
    expect(decoded.dialect).toBe("ofx-sgml");
    expect(decoded.headers.VERSION).toBe("102");
    const root = tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS);
    const txn = findFirst(root, "STMTTRN");
    expect(txn?.children.map((c) => [c.tag, c.value])).toEqual([
      ["TRNTYPE", "DEBIT"],
      ["DTPOSTED", "20240115120000"],
      ["TRNAMT", "-42.50"],
      ["FITID", "A1"],
      ["NAME", "COFFEE BAR"],
    ]);
    expect(findFirst(root, "CURDEF")?.value).toBe("USD");
    expect(findFirst(root, "ACCTID")?.value).toBe("000123456789");
  });

  it("parses OFX 2.x XML and decodes standard entities", () => {
    const decoded = decodeOfx(encode(XML_SAMPLE), DEFAULT_OFX_LIMITS.maxDecodedCharacters);
    expect(decoded.dialect).toBe("ofx-xml");
    const root = tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS);
    const txn = findFirst(root, "STMTTRN");
    expect(findFirst(txn as OfxNode, "NAME")?.value).toBe("REFUND & CO");
    expect(findFirst(root, "CURDEF")?.value).toBe("CAD");
  });

  it("rejects a DTD", () => {
    const doc = XML_SAMPLE.replace("<OFX>", "<!DOCTYPE OFX><OFX>");
    const decoded = decodeOfx(encode(doc), DEFAULT_OFX_LIMITS.maxDecodedCharacters);
    expect(() => tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS)).toThrow(
      OfxImportError,
    );
  });

  it("rejects a custom entity reference", () => {
    const doc = XML_SAMPLE.replace("REFUND &amp; CO", "&xxe;");
    expect(() => decodeOfx(encode(doc), DEFAULT_OFX_LIMITS.maxDecodedCharacters)).not.toThrow();
    const decoded = decodeOfx(encode(doc), DEFAULT_OFX_LIMITS.maxDecodedCharacters);
    expect(() => tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS)).toThrow(/entity/u);
  });

  it("rejects an unknown encoding", () => {
    const doc = XML_SAMPLE.replace("UTF-8", "EBCDIC-500");
    expect(() => decodeOfx(encode(doc), DEFAULT_OFX_LIMITS.maxDecodedCharacters)).toThrow(
      /encoding/iu,
    );
  });

  it("enforces the nesting-depth limit", () => {
    const decoded = decodeOfx(encode(SGML_SAMPLE), DEFAULT_OFX_LIMITS.maxDecodedCharacters);
    expect(() =>
      tokenizeOfx(decoded.text, decoded.dialect, { ...DEFAULT_OFX_LIMITS, maxNestingDepth: 2 }),
    ).toThrow(/depth/iu);
  });
});
