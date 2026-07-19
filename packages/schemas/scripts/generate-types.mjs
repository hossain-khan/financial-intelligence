import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { argv, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = join(packageRoot, "..", "..");
const schemasRoot = join(repositoryRoot, "schemas");
const generatedRoot = join(packageRoot, "src", "generated");
const checkOnly = argv.includes("--check");
const bannerComment = `/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */`;

const schemaFiles = (await readdir(schemasRoot))
  .filter((fileName) => fileName.endsWith(".schema.json"))
  .sort((left, right) => left.localeCompare(right));

const staleFiles = [];
const schemaIdToFile = new Map();

for (const schemaFile of schemaFiles) {
  const schema = JSON.parse(await readFile(join(schemasRoot, schemaFile), "utf8"));

  if (typeof schema.$id === "string") {
    schemaIdToFile.set(schema.$id, schemaFile);
  }
}

for (const schemaFile of schemaFiles) {
  const sourcePath = join(schemasRoot, schemaFile);
  const outputPath = join(generatedRoot, schemaFile.replace(".schema.json", ".ts"));
  const schema = localizeReferences(JSON.parse(await readFile(sourcePath, "utf8")));
  const output = await compile(schema, schema.title, {
    $refOptions: { cwd: schemasRoot },
    bannerComment,
    cwd: schemasRoot,
    style: {
      bracketSpacing: true,
      printWidth: 100,
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "all",
      useTabs: false,
    },
    unreachableDefinitions: true,
  });

  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => undefined);

    if (current !== output) {
      staleFiles.push(relative(repositoryRoot, outputPath));
    }
  } else {
    await writeFile(outputPath, output, "utf8");
  }
}

function localizeReferences(value) {
  if (Array.isArray(value)) {
    return value.map(localizeReferences);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        if (key === "$ref" && typeof child === "string" && schemaIdToFile.has(child)) {
          return [key, schemaIdToFile.get(child)];
        }

        return [key, localizeReferences(child)];
      }),
    );
  }

  return value;
}

if (staleFiles.length > 0) {
  throw new Error(
    `Generated schema types are stale or missing:\n${staleFiles.map((file) => `- ${file}`).join("\n")}\nRun pnpm schema:generate.`,
  );
}

stdout.write(
  `${
    checkOnly
      ? `Verified ${schemaFiles.length} generated schema type files.`
      : `Generated ${schemaFiles.length} schema type files.`
  }\n`,
);
