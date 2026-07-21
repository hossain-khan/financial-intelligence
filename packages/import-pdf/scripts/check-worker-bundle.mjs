import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

// Only our own worker code is bundled here; pdfjs-dist is external (see vite.config.ts). The
// forbidden-string check therefore applies to code we control. The single expected dynamic import
// of the pdfjs legacy build is allowed by exempting the `pdfjs-dist/...` specifier before scanning.
const bundleUrl = new URL("../dist/pdf-import-worker.js", import.meta.url);
const bundle = await readFile(bundleUrl, "utf8");
const scannable = bundle.replaceAll(/pdfjs-dist\/legacy\/build\/pdf(\.worker)?\.mjs/gu, "«pdfjs»");
const byteSize = Buffer.byteLength(bundle);
const gzipByteSize = gzipSync(bundle).byteLength;

const forbidden = [
  ["dynamic evaluation", /\beval\s*\(|\bnew\s+Function\b/u],
  ["network access", /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bimportScripts\s*\(/u],
  ["storage access", /\bindexedDB\b|\blocalStorage\b|\bsessionStorage\b|\bcaches\s*\./u],
];

if (byteSize > 120_000 || gzipByteSize > 40_000) {
  throw new Error(
    `PDF worker bundle exceeds its budget: ${byteSize} bytes raw, ${gzipByteSize} bytes gzip`,
  );
}

for (const [label, pattern] of forbidden) {
  if (pattern.test(scannable)) {
    throw new Error(`PDF worker bundle contains forbidden ${label}`);
  }
}

console.log(`Verified PDF worker bundle: ${byteSize} bytes raw, ${gzipByteSize} bytes gzip.`);
