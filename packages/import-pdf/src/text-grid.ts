import type { PdfTextItem, PdfTextPage } from "./model";

/**
 * A visual line: text items sharing (approximately) the same baseline on one page, sorted left to
 * right. Grouping items into lines is the first step every tabular layout needs, so it lives here
 * rather than in a specific adapter.
 */
export interface TextLine {
  readonly pageNumber: number;
  readonly y: number;
  readonly items: readonly PdfTextItem[];
  readonly text: string;
  readonly minItemIndex: number;
  readonly maxItemIndex: number;
}

/**
 * Group a page's items into baseline-aligned lines. Items are already quantized, but rendering can
 * still leave a small vertical spread within one visual line, so items within `tolerance` of a
 * line's baseline join it. Lines are returned top to bottom (descending y, since PDF y grows
 * upward).
 */
export function groupLines(page: PdfTextPage, tolerance: number): readonly TextLine[] {
  const indexed = page.items.map((item, index) => ({ item, index }));
  const buckets: { y: number; entries: { item: PdfTextItem; index: number }[] }[] = [];

  for (const entry of indexed) {
    const bucket = buckets.find((candidate) => Math.abs(candidate.y - entry.item.y) <= tolerance);
    if (bucket === undefined) {
      buckets.push({ y: entry.item.y, entries: [entry] });
    } else {
      bucket.entries.push(entry);
    }
  }

  const lines = buckets.map((bucket) => {
    const entries = [...bucket.entries].sort((a, b) => a.item.x - b.item.x);
    const items = entries.map((entry) => entry.item);
    const indices = entries.map((entry) => entry.index);
    return {
      pageNumber: page.pageNumber,
      y: bucket.y,
      items,
      text: joinItems(items),
      minItemIndex: Math.min(...indices),
      maxItemIndex: Math.max(...indices),
    };
  });

  return lines.sort((a, b) => b.y - a.y);
}

/**
 * Join items on a line into a single string, inserting a space where a horizontal gap suggests a
 * column break, and none where items visually abut (kerned fragments of one word).
 */
function joinItems(items: readonly PdfTextItem[]): string {
  let text = "";
  let previousRight: number | undefined;
  for (const item of items) {
    if (previousRight !== undefined) {
      const gap = item.x - previousRight;
      if (gap > Math.max(1, item.height * 0.25)) text += " ";
    }
    text += item.text;
    previousRight = item.x + item.width;
  }
  return text.replaceAll(/\s+/gu, " ").trim();
}

/** Source-location token for a line, e.g. `page:2/items:41-47`. */
export function lineLocation(line: TextLine): string {
  return `page:${line.pageNumber}/items:${line.minItemIndex}-${line.maxItemIndex}`;
}
