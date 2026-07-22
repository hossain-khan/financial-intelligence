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
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

// connect-src is asserted exactly (not as a substring) so it cannot be silently broadened. Only the
// app origin plus the single project-controlled model-download mirror are permitted; that exact host
// (no wildcard) is contacted only during an explicit, user-initiated model download (see ADR-023,
// which supersedes ADR-021's Hugging Face hosts). Integrity is still enforced by per-file SHA-256.
const allowedConnectSrc = ["'self'", "https://light-llm-storage.gohk.xyz"];

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

const connectMatch = /connect-src ([^;]+)/u.exec(source);
if (connectMatch === null) {
  throw new Error("Content-Security-Policy is missing a connect-src directive");
}
const connectSources = (connectMatch[1] ?? "").trim().split(/\s+/u).sort();
const expectedConnectSources = [...allowedConnectSrc].sort();
if (
  connectSources.length !== expectedConnectSources.length ||
  connectSources.some((value, index) => value !== expectedConnectSources[index])
) {
  throw new Error(
    `connect-src must be exactly "${allowedConnectSrc.join(" ")}" — found "${(connectMatch[1] ?? "").trim()}"`,
  );
}

if (source.includes("'unsafe-inline'") || source.includes("'unsafe-eval'")) {
  throw new Error("Production Content-Security-Policy must not allow unsafe scripts or styles");
}

stdout.write(`Verified production security headers in ${headersPath.toString()}.\n`);
