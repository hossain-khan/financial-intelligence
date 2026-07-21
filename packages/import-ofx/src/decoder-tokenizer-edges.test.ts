import { describe, expect, it } from "vitest";

import { decodeOfx } from "./decoder";
import { OfxImportError } from "./errors";
import { DEFAULT_OFX_LIMITS } from "./options";
import { tokenizeOfx, type OfxNode } from "./tokenizer";

const MAX = DEFAULT_OFX_LIMITS.maxDecodedCharacters;

function bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function utf16le(text: string): ArrayBuffer {
  const buffer = new ArrayBuffer(2 + text.length * 2);
  const view = new DataView(buffer);
  view.setUint8(0, 0xff);
  view.setUint8(1, 0xfe); // UTF-16LE BOM
  for (let index = 0; index < text.length; index += 1) {
    view.setUint16(2 + index * 2, text.charCodeAt(index), true);
  }
  return buffer;
}

function findFirst(node: OfxNode, tag: string): OfxNode | undefined {
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const found = findFirst(child, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

const MINIMAL_XML = `<?xml version="1.0" encoding="UTF-8"?><OFX><CURDEF>USD</CURDEF></OFX>`;
const MINIMAL_SGML = "OFXHEADER:100\nENCODING:UTF-8\n\n<OFX><CURDEF>USD</OFX>";

describe("decoder encoding branches", () => {
  it("decodes a UTF-16LE BOM XML document", () => {
    // No encoding attribute in the declaration, so the BOM decides the encoding.
    const decoded = decodeOfx(utf16le(`<?xml version="1.0"?><OFX><CURDEF>USD</CURDEF></OFX>`), MAX);
    expect(decoded.dialect).toBe("ofx-xml");
    expect(decoded.encoding).toBe("utf-16le");
  });

  it("accepts a Windows-1252 ENCODING header", () => {
    const decoded = decodeOfx(bytes("OFXHEADER:100\nENCODING:WINDOWS-1252\n\n<OFX></OFX>"), MAX);
    expect(decoded.encoding).toBe("windows-1252");
  });

  it("rejects an unsupported CHARSET under USASCII", () => {
    expect(() =>
      decodeOfx(bytes("OFXHEADER:100\nENCODING:USASCII\nCHARSET:999\n\n<OFX></OFX>"), MAX),
    ).toThrow(/CHARSET/u);
  });

  it("accepts CHARSET NONE as Windows-1252", () => {
    const decoded = decodeOfx(
      bytes("OFXHEADER:100\nENCODING:USASCII\nCHARSET:NONE\n\n<OFX></OFX>"),
      MAX,
    );
    expect(decoded.encoding).toBe("windows-1252");
  });

  it("rejects an SGML document without OFXHEADER or <OFX>", () => {
    expect(() => decodeOfx(bytes("random text with no markers"), MAX)).toThrow(OfxImportError);
  });

  it("rejects an XML declaration encoding that contradicts the BOM", () => {
    const doc = `<?xml version="1.0" encoding="WINDOWS-1252"?><OFX></OFX>`;
    expect(() => decodeOfx(utf16le(doc), MAX)).toThrow(/contradicts|encoding/iu);
  });

  it("rejects an XML document missing the <OFX> root", () => {
    expect(() => decodeOfx(bytes(`<?xml version="1.0"?><NOTOFX></NOTOFX>`), MAX)).toThrow(
      OfxImportError,
    );
  });

  it("enforces the decoded-character ceiling", () => {
    expect(() => decodeOfx(bytes(MINIMAL_XML), 5)).toThrow(/character limit/u);
  });
});

describe("tokenizer branches", () => {
  it("handles a self-closing aggregate tag", () => {
    const decoded = decodeOfx(
      bytes("<?xml version='1.0'?><OFX><EMPTY/><CURDEF>USD</CURDEF></OFX>"),
      MAX,
    );
    const root = tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS);
    expect(findFirst(root, "CURDEF")?.value).toBe("USD");
  });

  it("ignores comments without honoring their contents", () => {
    const decoded = decodeOfx(
      bytes("<?xml version='1.0'?><OFX><!-- <CURDEF>HACK</CURDEF> --><CURDEF>USD</CURDEF></OFX>"),
      MAX,
    );
    const root = tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS);
    expect(findFirst(root, "CURDEF")?.value).toBe("USD");
  });

  it("decodes decimal and hex numeric character references", () => {
    const decoded = decodeOfx(
      bytes("<?xml version='1.0'?><OFX><CURDEF>USD</CURDEF><MEMO>A&#38;B&#x2f;C</MEMO></OFX>"),
      MAX,
    );
    const root = tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS);
    expect(findFirst(root, "MEMO")?.value).toBe("A&B/C");
  });

  it("drops disallowed control-character references", () => {
    const decoded = decodeOfx(
      bytes("<?xml version='1.0'?><OFX><CURDEF>USD</CURDEF><MEMO>A&#1;B</MEMO></OFX>"),
      MAX,
    );
    const root = tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS);
    expect(findFirst(root, "MEMO")?.value).toBe("AB");
  });

  it("rejects an unexpected XML closing tag", () => {
    const decoded = decodeOfx(
      bytes("<?xml version='1.0'?><OFX><CURDEF>USD</CURDEF></WRONG></OFX>"),
      MAX,
    );
    expect(() => tokenizeOfx(decoded.text, decoded.dialect, DEFAULT_OFX_LIMITS)).toThrow(
      /closing tag/u,
    );
  });

  it("enforces the element-count limit", () => {
    const decoded = decodeOfx(bytes(MINIMAL_SGML), MAX);
    expect(() =>
      tokenizeOfx(decoded.text, decoded.dialect, { ...DEFAULT_OFX_LIMITS, maxElements: 1 }),
    ).toThrow(/element count/u);
  });

  it("rejects processing-instruction-free custom entities in SGML too", () => {
    const decoded = decodeOfx(
      bytes("OFXHEADER:100\nENCODING:UTF-8\n\n<OFX><MEMO>&custom;</OFX>"),
      MAX,
    );
    expect(() =>
      tokenizeOfx("<OFX><MEMO>&custom;</MEMO></OFX>", decoded.dialect, DEFAULT_OFX_LIMITS),
    ).toThrow(/entity/u);
  });
});
