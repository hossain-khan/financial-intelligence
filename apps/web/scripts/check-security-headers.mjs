import { readFile } from "node:fs/promises";
import { argv, stdout } from "node:process";

const headersPath =
  argv.slice(2).find((argument) => argument !== "--") ??
  new URL("../public/_headers", import.meta.url);
const source = await readFile(headersPath, "utf8");
const requiredHeaders = [
  "Content-Security-Policy:",
  "Permissions-Policy:",
  "Referrer-Policy: no-referrer",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
];
const requiredCspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

for (const header of requiredHeaders) {
  if (!source.includes(header)) {
    throw new Error(`Required production security header is missing: ${header}`);
  }
}

for (const directive of requiredCspDirectives) {
  if (!source.includes(directive)) {
    throw new Error(`Required Content-Security-Policy directive is missing: ${directive}`);
  }
}

if (source.includes("'unsafe-inline'") || source.includes("'unsafe-eval'")) {
  throw new Error("Production Content-Security-Policy must not allow unsafe scripts or styles");
}

stdout.write(`Verified production security headers in ${headersPath.toString()}.\n`);
