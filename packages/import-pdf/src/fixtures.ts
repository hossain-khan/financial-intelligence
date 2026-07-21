/**
 * Synthetic PDF builders for tests and Playwright flows. These emit minimal but valid PDFs with
 * real text-showing operators so pdfjs-dist extracts positioned text from them. No real statement
 * data is ever used; every value here is invented.
 */

export interface SyntheticTextRun {
  readonly text: string;
  /** Left position in PDF user-space points. */
  readonly x: number;
  /** Baseline position from the bottom of the page in points. */
  readonly y: number;
  /** Font size; also the item height PDF.js reports. Defaults to 10. */
  readonly size?: number;
}

export interface SyntheticPage {
  readonly runs: readonly SyntheticTextRun[];
}

export interface SyntheticPdfOptions {
  readonly pages: readonly SyntheticPage[];
  readonly width?: number;
  readonly height?: number;
  /** When set, marks the document encrypted so pdfjs treats it as password protected. */
  readonly encrypted?: boolean;
}

/** Build a synthetic multi-page text PDF as bytes. */
export function buildSyntheticPdf(options: SyntheticPdfOptions): Uint8Array {
  const width = options.width ?? 612;
  const height = options.height ?? 792;
  const objects: string[] = [];
  const reserve = (): number => {
    objects.push("");
    return objects.length; // 1-based object number
  };

  const catalogNo = reserve();
  const pagesNo = reserve();
  const fontNo = reserve();
  const pageNos: number[] = [];
  const contentNos: number[] = [];

  for (const page of options.pages) {
    const contentNo = reserve();
    const pageNo = reserve();
    contentNos.push(contentNo);
    pageNos.push(pageNo);
    const stream = page.runs.map((run) => textOperator(run)).join("\n");
    objects[contentNo - 1] = `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`;
    objects[pageNo - 1] =
      `<< /Type /Page /Parent ${pagesNo} 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /Font << /F1 ${fontNo} 0 R >> >> /Contents ${contentNo} 0 R >>`;
  }

  objects[catalogNo - 1] = `<< /Type /Catalog /Pages ${pagesNo} 0 R >>`;
  objects[pagesNo - 1] =
    `<< /Type /Pages /Kids [${pageNos.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNos.length} >>`;
  objects[fontNo - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  return assemble(objects, catalogNo, options.encrypted === true);
}

/**
 * Build an "image-only" style PDF: a valid page with no text-showing operators (as a scanned
 * statement would extract). pdfjs returns zero text items, exercising image-only classification.
 */
export function buildImageOnlyPdf(): Uint8Array {
  return buildSyntheticPdf({ pages: [{ runs: [] }] });
}

function textOperator(run: SyntheticTextRun): string {
  const size = run.size ?? 10;
  const escaped = run.text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  return `BT /F1 ${size} Tf ${run.x} ${run.y} Td (${escaped}) Tj ET`;
}

function assemble(objects: readonly string[], rootNo: number, encrypted: boolean): Uint8Array {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  const encryptEntry = encrypted ? ` /Encrypt << /Filter /Standard /V 1 /R 2 >>` : "";
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${rootNo} 0 R${encryptEntry} >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
