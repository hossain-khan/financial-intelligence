// Regenerates fixtures/digests.json: one SHA-256 (over canonical JSON) per corpus case id.
// Run manually after adding/editing a fixture: node packages/ai-evaluation/scripts/generate-corpus-digests.mjs
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const fixturesDir = new URL("../fixtures/", import.meta.url);

function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortValue(value[key]);
    return sorted;
  }
  return value;
}
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const lock = {};
for (const entry of await readdir(fixturesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = new URL(`../fixtures/${entry.name}/`, import.meta.url);
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(await readFile(fileURLToPath(new URL(file, dir)), "utf8"));
    lock[raw.id] = await sha256Hex(canonicalJson(raw));
  }
}

const sorted = Object.fromEntries(Object.keys(lock).sort().map((k) => [k, lock[k]]));
await writeFile(fileURLToPath(new URL("../fixtures/digests.json", import.meta.url)), `${JSON.stringify(sorted, null, 2)}\n`);
process.stdout.write(`Wrote ${Object.keys(sorted).length} corpus digests.\n`);
