import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { EvalCase } from "./corpus";
import { lintCase } from "./fixture-linter";

const fixturesDir = new URL("../fixtures/", import.meta.url);

/**
 * Load and lint every committed corpus case from `fixtures/<task>/*.json`. Throws if any case fails
 * the fixture linter or if two cases share an id. Node-only (used by tests and the digest script).
 */
export async function loadCorpusFromDisk(): Promise<Map<string, EvalCase>> {
  const cases = new Map<string, EvalCase>();
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = new URL(`../fixtures/${entry.name}/`, import.meta.url);
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".json")) continue;
      const raw = JSON.parse(await readFile(fileURLToPath(new URL(file, dir)), "utf8"));
      const evalCase = lintCase(raw);
      if (cases.has(evalCase.id)) throw new Error(`duplicate case id: ${evalCase.id}`);
      cases.set(evalCase.id, evalCase);
    }
  }
  return cases;
}
