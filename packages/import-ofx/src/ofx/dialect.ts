import { OfxImportError } from "../errors";
import type { OfxToken } from "./lexer";

export type OfxDialect = "sgml" | "xml";

export function detectDialect(text: string): OfxDialect {
  const header = text.slice(0, 256).toUpperCase();
  if (header.includes("OFXHEADER:")) return "sgml";
  if (header.includes("<?XML") || header.includes("<OFX")) return "xml";
  return "sgml";
}

export interface OfxHeader {
  readonly version: string;
  readonly encoding: string | undefined;
  readonly oldFileUid: string | undefined;
  readonly newFileUid: string | undefined;
}

export function parseOfxHeader(text: string): OfxHeader {
  const lines = text.split(/\r\n|\r|\n/u);
  let version = "";
  let encoding: string | undefined;
  let oldFileUid: string | undefined;
  let newFileUid: string | undefined;

  for (const line of lines) {
    if (line.length === 0) break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toUpperCase();
    const value = line.slice(colon + 1).trim();
    switch (key) {
      case "VERSION":
        version = value;
        break;
      case "ENCODING":
        encoding = value;
        break;
      case "OLDFILEUID":
        oldFileUid = value;
        break;
      case "NEWFILEUID":
        newFileUid = value;
        break;
    }
  }

  return { version, encoding, oldFileUid, newFileUid };
}

export interface OfxElement {
  readonly name: string;
  readonly value: string;
  readonly children: readonly OfxElement[];
  readonly line: number;
  readonly isLeaf: boolean;
}

interface MutableOfxElement {
  name: string;
  value: string;
  children: MutableOfxElement[];
  line: number;
  isLeaf: boolean;
}

export function buildOfxTree(
  tokens: readonly OfxToken[],
  maxDepth: number,
  knownLeafs: ReadonlySet<string>,
): readonly OfxElement[] {
  const root: MutableOfxElement[] = [];
  const stack: { element: MutableOfxElement; isLeaf: boolean }[] = [];

  for (const token of tokens) {
    if (token.type === "comment" || token.type === "processing") continue;
    if (token.type === "text") {
      if (stack.length === 0) continue;
      const current = stack[stack.length - 1];
      if (current !== undefined && current.isLeaf) {
        current.element.value += token.value;
      }
      continue;
    }

    if (token.type === "close") {
      if (stack.length === 0) continue;
      const targetName = token.name.toUpperCase();
      // Forgiving close: pop to the matching open tag, ignoring mismatches.
      while (stack.length > 0) {
        const closing = stack.pop()!;
        const parent = stack[stack.length - 1]?.element;
        if (parent !== undefined) {
          parent.children.push(closing.element);
        } else {
          root.push(closing.element);
        }
        if (closing.element.name.toUpperCase() === targetName) break;
      }
      continue;
    }

    if (stack.length >= maxDepth) {
      throw new OfxImportError("INVALID_OFX_STRUCTURE", "OFX nesting depth limit exceeded");
    }

    const isLeaf = knownLeafs.has(token.name.toUpperCase());
    const element: MutableOfxElement = {
      name: token.name,
      value: "",
      children: [],
      line: token.line,
      isLeaf,
    };

    // SGML forgiveness: close an open non-leaf sibling of the same name before opening a new one.
    if (!isLeaf && stack.length > 0) {
      const top = stack[stack.length - 1];
      if (
        top !== undefined &&
        !top.isLeaf &&
        top.element.name.toUpperCase() === token.name.toUpperCase()
      ) {
        stack.pop();
        const parent = stack[stack.length - 1]?.element;
        if (parent !== undefined) {
          parent.children.push(top.element);
        } else {
          root.push(top.element);
        }
      }
    }

    stack.push({ element, isLeaf });

    if (token.type === "empty") {
      stack.pop();
      const parent = stack[stack.length - 1]?.element;
      if (parent !== undefined) {
        parent.children.push(element);
      } else {
        root.push(element);
      }
    }
  }

  // Drain remaining stack.
  while (stack.length > 0) {
    const closing = stack.pop()!;
    const parent = stack[stack.length - 1]?.element;
    if (parent !== undefined) {
      parent.children.push(closing.element);
    } else {
      root.push(closing.element);
    }
  }

  return root;
}

export function findChild(element: OfxElement, name: string): OfxElement | undefined {
  return element.children.find((child) => child.name.toUpperCase() === name.toUpperCase());
}

export function findChildren(element: OfxElement, name: string): readonly OfxElement[] {
  return element.children.filter((child) => child.name.toUpperCase() === name.toUpperCase());
}

export function getText(element: OfxElement | undefined): string {
  return element?.value ?? "";
}
