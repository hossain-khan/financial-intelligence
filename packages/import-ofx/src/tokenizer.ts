import type { OfxDialect } from "./decoder";
import { OfxImportError } from "./errors";
import type { OfxParseLimits } from "./options";

/**
 * A parsed OFX aggregate (a node with children) or leaf (a node with a text value). OFX
 * distinguishes the two by position, not syntax: in SGML, leaf elements are frequently left
 * unclosed, so a tag followed by text and then another tag is a leaf. The tokenizer therefore
 * relies on a known leaf-tag table rather than closing tags.
 */
export interface OfxNode {
  readonly tag: string;
  readonly children: OfxNode[];
  value?: string;
}

/**
 * Known OFX leaf (element) tags across the v1-supported message sets. A tag in this set never
 * has children; its content is text up to the next tag. Unknown tags are treated as aggregates
 * so that unsupported sections are still structurally bounded and reported, never executed.
 */
const LEAF_TAGS: ReadonlySet<string> = new Set([
  "CODE",
  "SEVERITY",
  "MESSAGE",
  "DTSERVER",
  "LANGUAGE",
  "DTPROFUP",
  "FID",
  "ORG",
  "TRNUID",
  "CURDEF",
  "BANKID",
  "BRANCHID",
  "ACCTID",
  "ACCTTYPE",
  "ACCTKEY",
  "DTSTART",
  "DTEND",
  "TRNTYPE",
  "DTPOSTED",
  "DTUSER",
  "DTAVAIL",
  "TRNAMT",
  "FITID",
  "CORRECTFITID",
  "CORRECTACTION",
  "SRVRTID",
  "CHECKNUM",
  "REFNUM",
  "SIC",
  "PAYEEID",
  "NAME",
  "MEMO",
  "BALAMT",
  "DTASOF",
  "MKTGINFO",
  "CURRATE",
  "CURSYM",
]);

const TAG_PATTERN = /<\s*(\/?)\s*([A-Za-z0-9._]+)\s*([^<>]*?)\/?\s*>/gu;
const KNOWN_ENTITIES: ReadonlySet<string> = new Set(["amp", "lt", "gt", "quot", "apos"]);

/**
 * Tokenize decoded OFX text into a bounded node tree. The same tag grammar covers OFX 1.x SGML
 * (unclosed leaves) and OFX 2.x XML. Declarations that could trigger entity expansion or
 * external resource resolution are rejected outright: DTDs, entity/notation declarations,
 * processing instructions, and CDATA sections are never honored.
 */
export function tokenizeOfx(text: string, dialect: OfxDialect, limits: OfxParseLimits): OfxNode {
  rejectDangerousMarkup(text);
  const body = stripDeclarations(text, dialect);

  const root: OfxNode = { tag: "#document", children: [] };
  const stack: OfxNode[] = [root];
  /** The most recently opened leaf still awaiting its text value, if any. */
  let openLeaf: OfxNode | null = null;
  let elements = 0;
  let depth = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const flushText = (raw: string): void => {
    if (openLeaf === null) return; // Whitespace/noise between aggregates is ignored.
    const value = decodeEntities(raw.trim());
    if (value.length > limits.maxFieldCharacters) {
      throw new OfxImportError(
        "FIELD_LIMIT_EXCEEDED",
        `OFX field “${openLeaf.tag}” exceeds the configured length limit`,
      );
    }
    if (value.length > 0) openLeaf.value = value;
    openLeaf = null;
  };

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(body)) !== null) {
    flushText(body.slice(cursor, match.index));
    cursor = TAG_PATTERN.lastIndex;
    const whole = match[0];
    const closingMark = match[1] ?? "";
    const tag = (match[2] ?? "").toUpperCase();

    if (closingMark === "/") {
      if (!LEAF_TAGS.has(tag)) depth = closeAggregate(stack, tag, dialect, depth);
      continue;
    }

    elements += 1;
    if (elements > limits.maxElements) {
      throw new OfxImportError(
        "ELEMENT_LIMIT_EXCEEDED",
        "OFX document element count exceeds the configured limit",
      );
    }

    const parent = stack[stack.length - 1] ?? root;
    if (LEAF_TAGS.has(tag)) {
      const leaf: OfxNode = { tag, children: [], value: "" };
      parent.children.push(leaf);
      openLeaf = leaf; // Its value is the text run up to the next tag.
      continue;
    }

    const aggregate: OfxNode = { tag, children: [] };
    parent.children.push(aggregate);
    if (!/\/\s*>$/u.test(whole)) {
      depth += 1;
      if (depth > limits.maxNestingDepth) {
        throw new OfxImportError(
          "DEPTH_LIMIT_EXCEEDED",
          "OFX document nesting exceeds the configured depth limit",
        );
      }
      stack.push(aggregate);
    }
  }

  if (dialect === "ofx-xml" && stack.length !== 1) {
    throw new OfxImportError("MALFORMED_DOCUMENT", "OFX XML document has unbalanced elements");
  }
  return root;
}

function closeAggregate(stack: OfxNode[], tag: string, dialect: OfxDialect, depth: number): number {
  for (let index = stack.length - 1; index >= 1; index -= 1) {
    if (stack[index]?.tag === tag) {
      const removed = stack.length - index;
      stack.length = index;
      return depth - removed;
    }
  }
  if (dialect === "ofx-xml") {
    throw new OfxImportError("MALFORMED_DOCUMENT", `Unexpected closing tag </${tag}>`);
  }
  return depth;
}

function rejectDangerousMarkup(text: string): void {
  if (/<!DOCTYPE/iu.test(text)) {
    throw new OfxImportError("UNSUPPORTED_MARKUP", "OFX documents must not declare a DTD");
  }
  if (/<!ENTITY/iu.test(text) || /<!NOTATION/iu.test(text)) {
    throw new OfxImportError(
      "UNSUPPORTED_MARKUP",
      "OFX documents must not declare entities or notations",
    );
  }
  if (/<!\[CDATA\[/iu.test(text)) {
    throw new OfxImportError("UNSUPPORTED_MARKUP", "OFX documents must not contain CDATA sections");
  }
  // A custom general entity reference could only resolve via a declaration we reject above, so
  // treat any non-standard entity as unsupported markup rather than silently dropping it.
  const entity = /&([A-Za-z][A-Za-z0-9]*);/gu;
  let match: RegExpExecArray | null;
  while ((match = entity.exec(text)) !== null) {
    const name = match[1] ?? "";
    if (!KNOWN_ENTITIES.has(name.toLowerCase())) {
      throw new OfxImportError(
        "UNSUPPORTED_MARKUP",
        `OFX documents must not reference the entity “&${name};”`,
      );
    }
  }
}

function stripDeclarations(text: string, dialect: OfxDialect): string {
  let body = text;
  if (dialect === "ofx-xml") {
    body = body.replace(/<\?[^?]*\?>/gu, " "); // XML declaration + OFX processing instructions.
  } else {
    const rootIndex = body.toUpperCase().indexOf("<OFX>");
    if (rootIndex > 0) body = body.slice(rootIndex); // Drop the SGML preamble.
  }
  return body.replace(/<!--[\s\S]*?-->/gu, " "); // Never honor comment contents.
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#x([0-9a-fA-F]+);/gu, (_, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => safeCodePoint(Number.parseInt(dec, 10)))
    .replaceAll("&amp;", "&");
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
  if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}
