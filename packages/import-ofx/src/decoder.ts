import { OfxImportError } from "./errors";
import type { OfxEncoding } from "./options";

export interface DecodedText {
  readonly text: string;
  readonly encoding: Exclude<OfxEncoding, "auto">;
  readonly hadBom: boolean;
}

export function decodeOfx(
  buffer: ArrayBuffer,
  requestedEncoding: OfxEncoding,
  headerEncoding?: string,
): DecodedText {
  const bytes = new Uint8Array(buffer);
  const bom = detectBom(bytes);
  let encoding = requestedEncoding;
  if (encoding === "auto") {
    if (bom !== undefined) {
      encoding = bom.encoding;
    } else if (headerEncoding !== undefined) {
      encoding = normalizeEncoding(headerEncoding);
    } else {
      encoding = "utf-8";
    }
  }

  if (bom !== undefined && bom.encoding !== encoding) {
    throw new OfxImportError(
      "ENCODING_CONFLICT",
      `Byte-order mark indicates ${bom.encoding} but requested encoding is ${encoding}`,
    );
  }

  const offset = bom?.encoding === encoding ? bom.length : 0;

  try {
    return {
      text: new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset)),
      encoding,
      hadBom: bom !== undefined,
    };
  } catch (error) {
    throw new OfxImportError("DECODE_FAILED", `OFX is not valid ${encoding} text`, {
      cause: error,
    });
  }
}

function detectBom(
  bytes: Uint8Array,
): { readonly encoding: "utf-8" | "utf-16le" | "utf-16be"; readonly length: number } | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: "utf-8", length: 3 };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: "utf-16le", length: 2 };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: "utf-16be", length: 2 };
  }
  return undefined;
}

export function normalizeEncoding(value: string): Exclude<OfxEncoding, "auto"> {
  const normalized = value.toLowerCase().replaceAll(/[_\s-]/gu, "");
  if (normalized === "utf8" || normalized === "unicode11utf8") return "utf-8";
  if (normalized === "utf16le" || normalized === "utf16") return "utf-16le";
  if (normalized === "utf16be") return "utf-16be";
  if (
    normalized === "windows1252" ||
    normalized === "cp1252" ||
    normalized === "usascii" ||
    normalized === "iso88591" ||
    normalized === "ansi"
  )
    return "windows-1252";
  throw new OfxImportError("UNSUPPORTED_ENCODING", `OFX encoding "${value}" is not supported`);
}
