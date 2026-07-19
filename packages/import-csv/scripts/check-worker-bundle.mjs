import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const bundleUrl = new URL("../dist/csv-import-worker.js", import.meta.url);
const bundle = await readFile(bundleUrl, "utf8");
const byteSize = Buffer.byteLength(bundle);
const gzipByteSize = gzipSync(bundle).byteLength;
const forbidden = [
  ["dynamic evaluation", /\beval\s*\(|\bnew\s+Function\b/u],
  ["network access", /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bimportScripts\s*\(/u],
  ["storage access", /\bindexedDB\b|\blocalStorage\b|\bsessionStorage\b|\bcaches\s*\./u],
];

if (byteSize > 350_000 || gzipByteSize > 80_000) {
  throw new Error(
    `CSV worker bundle exceeds its budget: ${byteSize} bytes raw, ${gzipByteSize} bytes gzip`,
  );
}

for (const [label, pattern] of forbidden) {
  if (pattern.test(bundle)) {
    throw new Error(`CSV worker bundle contains forbidden ${label}`);
  }
}

console.log(`Verified CSV worker bundle: ${byteSize} bytes raw, ${gzipByteSize} bytes gzip.`);
