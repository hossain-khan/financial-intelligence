export type ImportFormat = "csv" | "ofx";

/** OFX 1.x SGML preamble or OFX 2.x XML root within a bounded prefix. */
const OFX_SIGNATURE = /(^|\s)OFXHEADER\s*[:=]|<\s*OFX[\s>]/iu;

/**
 * Decide which parser a selected file should use. Content signatures are authoritative;
 * extension and MIME are advisory hints. When the extension claims one format but the content
 * carries the other format's signature, that is a mismatch and rejected rather than guessed.
 */
export async function detectImportFormat(file: File): Promise<ImportFormat> {
  const name = file.name.toLowerCase();
  const prefixBytes = await file.slice(0, 4096).arrayBuffer();
  const prefix = new TextDecoder("windows-1252", { fatal: false }).decode(
    new Uint8Array(prefixBytes),
  );
  const looksOfx = OFX_SIGNATURE.test(prefix);
  const extensionOfx = name.endsWith(".ofx") || name.endsWith(".qfx");
  const extensionCsv = name.endsWith(".csv") || name.endsWith(".tsv");

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
 * rejected because CSV allows multiple files while OFX imports one statement file at a time.
 */
export async function detectBatchFormat(files: readonly File[]): Promise<ImportFormat> {
  if (files.length === 0) throw new Error("Choose at least one statement file.");
  const formats = await Promise.all(files.map((file) => detectImportFormat(file)));
  const unique = [...new Set(formats)];
  if (unique.length > 1) {
    throw new Error("Import CSV and OFX files separately; they use different mapping steps.");
  }
  const format = unique[0];
  if (format === "ofx" && files.length > 1) {
    throw new Error(
      "Import one OFX/QFX file at a time; each carries its own account and currency.",
    );
  }
  return format ?? "csv";
}
