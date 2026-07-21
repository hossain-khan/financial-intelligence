export interface OfxToken {
  readonly type: "text" | "open" | "close" | "empty" | "processing" | "comment";
  readonly name: string;
  readonly value: string;
  readonly raw: string;
  readonly line: number;
}

export interface TokenizeOptions {
  readonly maxElementCount: number;
  readonly maxFieldLength: number;
  readonly maxOutputCharacters: number;
}

export function tokenizeOfx(text: string, options: TokenizeOptions): readonly OfxToken[] {
  const tokens: OfxToken[] = [];
  let line = 1;
  let index = 0;
  let elementCount = 0;
  let outputCharacters = 0;

  while (index < text.length) {
    if (elementCount >= options.maxElementCount) {
      throw new OfxLexerError("ELEMENT_COUNT_EXCEEDED", "OFX element count limit exceeded");
    }
    if (outputCharacters >= options.maxOutputCharacters) {
      throw new OfxLexerError("OUTPUT_LIMIT_EXCEEDED", "OFX output character limit exceeded");
    }

    const character = text[index];
    if (character === "<") {
      const tagEnd = findTagEnd(text, index);
      const tagText = text.slice(index, tagEnd);
      const token = parseTag(tagText, line);
      if (token.type !== "comment" && token.type !== "processing") {
        elementCount += 1;
      }
      tokens.push(token);
      line += countNewlines(tagText);
      index = tagEnd;
      outputCharacters += token.value.length + token.name.length;
    } else {
      const nextTag = text.indexOf("<", index);
      const textEnd = nextTag === -1 ? text.length : nextTag;
      const value = text.slice(index, textEnd);
      if (value.length > 0) {
        outputCharacters += value.length;
        tokens.push({
          type: "text",
          name: "",
          value: value.replaceAll(/\r\n|\r|\n/gu, ""),
          raw: value,
          line,
        });
        line += countNewlines(value);
      }
      index = textEnd;
    }
  }

  return tokens;
}

export class OfxLexerError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OfxLexerError";
  }
}

function findTagEnd(text: string, start: number): number {
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === ">") return index + 1;
    if (character === "<") return index;
  }
  return text.length;
}

function parseTag(tagText: string, line: number): OfxToken {
  const trimmed = tagText.slice(1).trimStart();

  if (trimmed.startsWith("!")) {
    return { type: "comment", name: "", value: tagText, raw: tagText, line };
  }
  if (trimmed.startsWith("?")) {
    return { type: "processing", name: "", value: tagText, raw: tagText, line };
  }

  const isClosing = trimmed.startsWith("/");
  const isEmpty = trimmed.endsWith("/");
  const inner = trimmed
    .slice(isClosing ? 1 : 0, isEmpty ? -1 : undefined)
    .replace(/>$/u, "")
    .trim();
  const name = inner.split(/\s+/u)[0] ?? "";

  if (isClosing) {
    return { type: "close", name, value: "", raw: tagText, line };
  }
  if (isEmpty) {
    return { type: "empty", name, value: "", raw: tagText, line };
  }
  return { type: "open", name, value: "", raw: tagText, line };
}

function countNewlines(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") count += 1;
  }
  return count;
}

export const KNOWN_OFX_LEAF_TAGS = new Set([
  "OFXHEADER",
  "VERSION",
  "SECURITY",
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
  "CCACCTTO",
  "BANKACCTTO",
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
  "LEDGERBAL",
  "AVAILBAL",
  "BANKACCTFROM",
  "CCACCTFROM",
  "STMTTRN",
  "STMTRS",
  "STMTTRNRS",
  "BANKMSGSRSV1",
  "CREDITCARDMSGSRSV1",
  "CCSTMTRS",
  "CCSTMTTRNRS",
  "SIGNONMSGSRSV1",
  "SONRS",
]);
