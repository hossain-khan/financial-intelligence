import { describe, expect, it } from "vitest";

import { decodeOfx, normalizeEncoding } from "./decoder";
import { OfxImportError } from "./errors";

function encode(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function encodeWindows1252(text: string): ArrayBuffer {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[i] = code < 256 ? code : 0x3f;
  }
  return bytes.buffer;
}

describe("decodeOfx", () => {
  it("decodes UTF-8 when requested", () => {
    const result = decodeOfx(encode("hello"), "utf-8");
    expect(result.text).toBe("hello");
    expect(result.encoding).toBe("utf-8");
    expect(result.hadBom).toBe(false);
  });

  it("auto-detects UTF-8 BOM", () => {
    const text = "hello";
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]);
    const result = decodeOfx(bytes.buffer, "auto");
    expect(result.text).toBe(text);
    expect(result.encoding).toBe("utf-8");
    expect(result.hadBom).toBe(true);
  });

  it("auto-detects header encoding when no BOM", () => {
    const result = decodeOfx(encodeWindows1252("hello"), "auto", "windows-1252");
    expect(result.text).toBe("hello");
    expect(result.encoding).toBe("windows-1252");
  });

  it("falls back to UTF-8 when no BOM or header encoding", () => {
    const result = decodeOfx(encode("hello"), "auto");
    expect(result.encoding).toBe("utf-8");
  });

  it("throws on encoding conflict between BOM and request", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("hello")]);
    expect(() => decodeOfx(bytes.buffer, "windows-1252")).toThrow(OfxImportError);
  });

  it("throws when decoding fails", () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff]);
    expect(() => decodeOfx(bytes.buffer, "utf-8")).toThrow(OfxImportError);
  });
});

describe("normalizeEncoding", () => {
  it("normalizes UTF-8 variants", () => {
    expect(normalizeEncoding("UTF-8")).toBe("utf-8");
    expect(normalizeEncoding("unicode-1-1-utf-8")).toBe("utf-8");
  });

  it("normalizes UTF-16 variants", () => {
    expect(normalizeEncoding("UTF-16LE")).toBe("utf-16le");
    expect(normalizeEncoding("UTF-16")).toBe("utf-16le");
    expect(normalizeEncoding("UTF-16BE")).toBe("utf-16be");
  });

  it("normalizes Windows-1252 variants", () => {
    expect(normalizeEncoding("WINDOWS-1252")).toBe("windows-1252");
    expect(normalizeEncoding("CP1252")).toBe("windows-1252");
    expect(normalizeEncoding("US-ASCII")).toBe("windows-1252");
    expect(normalizeEncoding("ISO-8859-1")).toBe("windows-1252");
    expect(normalizeEncoding("ANSI")).toBe("windows-1252");
  });

  it("rejects unsupported encodings", () => {
    expect(() => normalizeEncoding("BIG5")).toThrow(OfxImportError);
  });
});
