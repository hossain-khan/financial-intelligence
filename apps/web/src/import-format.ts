export type ImportFormat = "csv" | "ofx" | "pdf";

/** OFX 1.x SGML preamble or OFX 2.x XML root within a bounded prefix. */
const OFX_SIGNATURE = /(^|\s)OFXHEADER\s*[:=]|<\s*OFX[\s>]/iu;
/** `%PDF-` at the start of the file (a leading BOM is stripped before matching). */
const PDF_SIGNATURE = /^%PDF-/u;

/**
 * Decide which parser a selected file should use. Content signatures are authoritative; extension
 * and MIME are advisory hints. When the extension claims one format but the content carries a
 * different format's signature, that is a mismatch and rejected rather than guessed.
 */
export async function detectImportFormat(file: File): Promise<ImportFormat> {
  const name = file.name.toLowerCase();
  const prefixBytes = await file.slice(0, 4096).arrayBuffer();
  const decoded = new TextDecoder("windows-1252", { fatal: false }).decode(
    new Uint8Array(prefixBytes),
  );
  // Strip a leading BOM (as a code point, not a literal in a regex) before signature checks.
  const prefix = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;
  const looksPdf = PDF_SIGNATURE.test(prefix);
  const looksOfx = OFX_SIGNATURE.test(prefix);
  const extensionPdf = name.endsWith(".pdf");
  const extensionOfx = name.endsWith(".ofx") || name.endsWith(".qfx");
  const extensionCsv = name.endsWith(".csv") || name.endsWith(".tsv");

  if (looksPdf) {
    if (extensionCsv || extensionOfx) {
      throw new Error(
        `“${file.name}” has a ${extensionOfx ? "OFX/QFX" : "CSV"} extension but contains PDF content. Rename it to .pdf or export the expected format.`,
      );
    }
    return "pdf";
  }
  if (extensionPdf) {
    throw new Error(
      `“${file.name}” has a PDF extension but does not contain a recognizable PDF document.`,
    );
  }
  if (looksOfx) {
    if (extensionCsv) {
      throw new Error(
        `“${file.name}” has a CSV extension but contains OFX content. Rename it to .ofx or export a CSV.`,
      );
    }
    return "ofx";
  }
  if (extensionOfx) {
    throw new Error(
      `“${file.name}” has an OFX extension but does not contain a recognizable OFX document.`,
    );
  }
  return "csv";
}

/**
 * Classify a batch of dropped/selected files into a single format. Mixed formats in one drop are
 * rejected because CSV allows multiple files while OFX and PDF import one statement file at a time.
 */
export async function detectBatchFormat(files: readonly File[]): Promise<ImportFormat> {
  if (files.length === 0) throw new Error("Choose at least one statement file.");
  const formats = await Promise.all(files.map((file) => detectImportFormat(file)));
  const unique = [...new Set(formats)];
  if (unique.length > 1) {
    throw new Error("Import CSV, OFX, and PDF files separately; they use different mapping steps.");
  }
  const format = unique[0];
  if (format === "ofx" && files.length > 1) {
    throw new Error(
      "Import one OFX/QFX file at a time; each carries its own account and currency.",
    );
  }
  if (format === "pdf" && files.length > 1) {
    throw new Error("Import one PDF statement at a time; each carries its own account.");
  }
  return format ?? "csv";
}
