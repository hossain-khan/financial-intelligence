import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));

// Only these worker-side modules may import the runtime; the main-thread surface must stay
// runtime-free so React never loads @huggingface/transformers off the worker.
const WORKER_ONLY = new Set(["worker.ts", "transformers-engine.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("ai-local runtime isolation", () => {
  it("keeps @huggingface/transformers out of every non-worker module", () => {
    for (const file of walk(srcDir)) {
      const name = file.split("/").pop() ?? "";
      if (WORKER_ONLY.has(name)) continue;
      expect(readFileSync(file, "utf8"), `${file} imports the runtime`).not.toContain(
        "@huggingface/transformers",
      );
    }
  });

  it("does not re-export the worker-only engine or worker entry from the main-thread barrel", () => {
    const index = readFileSync(join(srcDir, "index.ts"), "utf8");
    expect(index).not.toContain("transformers-engine");
    expect(index).not.toContain('"./worker"');
    expect(index).not.toContain('"./worker.ts"');
  });

  it("declares only the expected runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@financial-intelligence/ai-core",
      "@financial-intelligence/domain",
      "@financial-intelligence/schemas",
      "@huggingface/transformers",
      "hash-wasm",
    ]);
  });
});
