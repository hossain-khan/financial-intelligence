/**
 * A single positioned text run extracted from a page. Coordinates are in PDF user space with the
 * origin at the bottom-left of the page. `x`/`y` are quantized to the configured grid for
 * deterministic matching; `rawX`/`rawY` retain the original bounded position for provenance.
 */
export interface PdfTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rawX: number;
  readonly rawY: number;
}

/** One immutable extracted page. Item order follows the PDF content stream, not visual order. */
export interface PdfTextPage {
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
  readonly items: readonly PdfTextItem[];
}

/**
 * The full extracted document handed to layout adapters. `producer`/`creator` are bounded,
 * non-sensitive metadata hints usable for detection; `textCharacterCount` is the total across all
 * pages, used to classify image-only documents.
 */
export interface PdfTextDocument {
  readonly pageCount: number;
  readonly pages: readonly PdfTextPage[];
  readonly textCharacterCount: number;
  readonly producer?: string;
  readonly creator?: string;
}
