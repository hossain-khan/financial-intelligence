import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const schemasDirectory = new URL("../../../schemas/", import.meta.url);
const generatedDirectory = new URL("./generated/", import.meta.url);

describe("generated portable schema types", () => {
  it("has a current generated artifact for every root schema", async () => {
    const schemaFiles = (await readdir(schemasDirectory))
      .filter((fileName) => fileName.endsWith(".schema.json"))
      .sort();
    const generatedFiles = (await readdir(generatedDirectory))
      .filter((fileName) => fileName.endsWith(".ts"))
      .sort();

    expect(schemaFiles).toHaveLength(7);
    expect(generatedFiles).toEqual(
      schemaFiles.map((fileName) => fileName.replace(".schema.json", ".ts")),
    );

    await Promise.all(
      generatedFiles.map(async (fileName) => {
        const source = await readFile(new URL(fileName, generatedDirectory), "utf8");
        expect(source).toContain("This file is generated from the canonical JSON Schema");
        expect(source).toMatch(/export (?:interface|type) /);
      }),
    );
  });
});
