import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));

const FORBIDDEN = [
  "react",
  "dexie",
  "indexeddb",
  "@financial-intelligence/application",
  "@financial-intelligence/storage-indexeddb",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("ai-evaluation dependency boundary", () => {
  it("never imports forbidden runtime dependencies", () => {
    for (const file of walk(srcDir)) {
      const source = readFileSync(file, "utf8");
      for (const banned of FORBIDDEN) {
        expect(source, `${file} imports ${banned}`).not.toContain(`from "${banned}"`);
      }
      expect(source, `${file} uses fetch`).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("declares only ai-core, domain, and schemas as dependencies", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@financial-intelligence/ai-core",
      "@financial-intelligence/domain",
      "@financial-intelligence/schemas",
    ]);
  });
});
