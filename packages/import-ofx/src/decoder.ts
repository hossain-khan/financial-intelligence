import { OfxImportError } from "./errors";

export type OfxDialect = "ofx-sgml" | "ofx-xml";

export interface DecodedOfx {
  readonly text: string;
  readonly dialect: OfxDialect;
  /** Canonical encoding label actually used to decode the bytes. */
  readonly encoding: string;
  /** OFX 1.x SGML preamble headers, upper-cased keys; empty for XML documents. */
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Documented, network-free encoding set. OFX 1.x SGML declares ENCODING/CHARSET in its
 * preamble; OFX 2.x XML declares an encoding in its XML declaration. Anything outside this
 * table, or a declaration that contradicts a byte-order mark, is an explicit error rather
 * than a lenient guess.
 */
const SUPPORTED_ENCODINGS: Readonly<Record<string, string>> = Object.freeze({
  "UTF-8": "utf-8",
  UTF8: "utf-8",
  UNICODE: "utf-8",
  "UTF-16": "utf-16",
  "US-ASCII": "windows-1252",
  USASCII: "windows-1252",
  ASCII: "windows-1252",
  "WINDOWS-1252": "windows-1252",
  CP1252: "windows-1252",
  "ISO-8859-1": "iso-8859-1",
  LATIN1: "iso-8859-1",
});

const CHARSET_ENCODINGS: Readonly<Record<string, string>> = Object.freeze({
  "1252": "windows-1252",
  "8859-1": "iso-8859-1",
  "ISO-8859-1": "iso-8859-1",
  NONE: "windows-1252",
});

/**
 * Decode raw OFX bytes into text plus the detected dialect. The maximum decoded-character
 * budget is enforced here so an adversarial multi-byte expansion cannot outgrow the caller's
 * limits before tokenization begins.
 */
export function decodeOfx(bytes: ArrayBuffer, maxDecodedCharacters: number): DecodedOfx {
  const view = new Uint8Array(bytes);
  const bomEncoding = detectByteOrderMark(view);
  const sniff = decodeStrict(view, bomEncoding ?? "utf-8", false).slice(0, 4096);

  if (isXmlDocument(sniff)) {
    return decodeXml(view, bomEncoding, sniff, maxDecodedCharacters);
  }
  return decodeSgml(view, bomEncoding, maxDecodedCharacters);
}

function decodeXml(
  view: Uint8Array,
  bomEncoding: string | null,
  sniff: string,
  maxDecodedCharacters: number,
): DecodedOfx {
  const declared = readXmlDeclarationEncoding(sniff);
  const resolved = resolveEncoding(declared, bomEncoding);
  const text = decodeWithLimit(view, resolved, maxDecodedCharacters);
  if (!/<OFX[\s>]/u.test(text)) {
    throw new OfxImportError("MALFORMED_DOCUMENT", "OFX 2.x document is missing an <OFX> root");
  }
  return { text, dialect: "ofx-xml", encoding: resolved, headers: {} };
}

function decodeSgml(
  view: Uint8Array,
  bomEncoding: string | null,
  maxDecodedCharacters: number,
): DecodedOfx {
  // The preamble is plain ASCII key:value lines; sniff it losslessly before full decoding.
  const preambleText = decodeStrict(view, "windows-1252", false).slice(0, 2048);
  const headers = readSgmlHeaders(preambleText);
  if (headers.OFXHEADER === undefined && !preambleText.toUpperCase().includes("<OFX>")) {
    throw new OfxImportError(
      "MALFORMED_DOCUMENT",
      "OFX 1.x document is missing an OFXHEADER preamble or <OFX> element",
    );
  }
  const declared = resolveSgmlEncoding(headers);
  const resolved = resolveEncoding(declared, bomEncoding);
  const text = decodeWithLimit(view, resolved, maxDecodedCharacters);
  if (!text.toUpperCase().includes("<OFX>")) {
    throw new OfxImportError("MALFORMED_DOCUMENT", "OFX 1.x document is missing an <OFX> element");
  }
  return { text, dialect: "ofx-sgml", encoding: resolved, headers };
}

function resolveSgmlEncoding(headers: Readonly<Record<string, string>>): string | null {
  const encoding = headers.ENCODING;
  if (encoding === undefined) return null;
  const normalizedEncoding = encoding.toUpperCase();
  if (normalizedEncoding === "USASCII" || normalizedEncoding === "US-ASCII") {
    const charset = (headers.CHARSET ?? "NONE").toUpperCase();
    const mapped = CHARSET_ENCODINGS[charset];
    if (mapped === undefined) {
      throw new OfxImportError(
        "UNSUPPORTED_ENCODING",
        `Unsupported OFX CHARSET “${headers.CHARSET ?? ""}”`,
      );
    }
    return mapped;
  }
  const mapped = SUPPORTED_ENCODINGS[normalizedEncoding];
  if (mapped === undefined) {
    throw new OfxImportError("UNSUPPORTED_ENCODING", `Unsupported OFX ENCODING “${encoding}”`);
  }
  return mapped;
}

function resolveEncoding(declared: string | null, bomEncoding: string | null): string {
  if (bomEncoding !== null) {
    const bomFamily = bomEncoding.startsWith("utf-16") ? "utf-16" : bomEncoding;
    if (declared !== null && declared !== bomEncoding && declared !== bomFamily) {
      throw new OfxImportError(
        "UNSUPPORTED_ENCODING",
        `Declared encoding “${declared}” contradicts the byte-order mark (${bomEncoding})`,
      );
    }
    return bomEncoding;
  }
  return declared ?? "utf-8";
}

function decodeWithLimit(view: Uint8Array, encoding: string, maxDecodedCharacters: number): string {
  const text = decodeStrict(view, encoding, true);
  if (text.length > maxDecodedCharacters) {
    throw new OfxImportError(
      "OUTPUT_LIMIT_EXCEEDED",
      "Decoded OFX text exceeds the configured character limit",
    );
  }
  return text.normalize("NFC");
}

function decodeStrict(view: Uint8Array, encoding: string, fatal: boolean): string {
  try {
    return new TextDecoder(encoding, { fatal, ignoreBOM: false }).decode(view);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new OfxImportError("UNSUPPORTED_ENCODING", `Unsupported text encoding “${encoding}”`);
    }
    throw new OfxImportError("DECODE_FAILED", `The OFX file is not valid ${encoding} text`, {
      cause: error,
    });
  }
}

function detectByteOrderMark(view: Uint8Array): string | null {
  if (view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) return "utf-8";
  if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) return "utf-16le";
  if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) return "utf-16be";
  return null;
}

function isXmlDocument(rawSniff: string): boolean {
  // Strip a leading BOM (U+FEFF) the decoder may have preserved, then any whitespace.
  const sniff = rawSniff.charCodeAt(0) === 0xfeff ? rawSniff.slice(1) : rawSniff;
  const trimmed = sniff.trimStart();
  return trimmed.startsWith("<?xml") || trimmed.startsWith("<OFX");
}

function readXmlDeclarationEncoding(sniff: string): string | null {
  const match = /<\?xml\b[^>]*\bencoding\s*=\s*["']([^"']+)["']/iu.exec(sniff);
  if (match === null || match[1] === undefined) return null;
  const declared = match[1];
  const mapped = SUPPORTED_ENCODINGS[declared.toUpperCase()];
  if (mapped === undefined) {
    throw new OfxImportError("UNSUPPORTED_ENCODING", `Unsupported XML encoding “${declared}”`);
  }
  return mapped;
}

function readSgmlHeaders(preamble: string): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  for (const line of preamble.split(/\r\n|\r|\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("<")) break; // Reached the SGML body.
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim().toUpperCase();
    const value = trimmed.slice(separator + 1).trim();
    if (key.length > 0 && /^[A-Z0-9_-]+$/u.test(key)) headers[key] = value;
  }
  return headers;
}
