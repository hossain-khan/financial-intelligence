import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { argv, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import addFormats from "ajv-formats";
import { build } from "esbuild";
import { compile } from "json-schema-to-typescript";
import { format } from "prettier";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = join(packageRoot, "..", "..");
const schemasRoot = join(repositoryRoot, "schemas");
const generatedRoot = join(packageRoot, "src", "generated");
const validatorsOutputPath = join(generatedRoot, "validators.ts");
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
const schemasByFile = new Map();

for (const schemaFile of schemaFiles) {
  const schema = JSON.parse(await readFile(join(schemasRoot, schemaFile), "utf8"));
  schemasByFile.set(schemaFile, schema);

  if (typeof schema.$id === "string") {
    schemaIdToFile.set(schema.$id, schemaFile);
  }
}

for (const schemaFile of schemaFiles) {
  const outputPath = join(generatedRoot, schemaFile.replace(".schema.json", ".ts"));
  const schema = localizeReferences(schemasByFile.get(schemaFile));
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

  await reconcileGeneratedFile(outputPath, output);
}

await generateStandaloneValidators();

async function generateStandaloneValidators() {
  const ajv = new Ajv2020({
    allowUnionTypes: true,
    allErrors: true,
    code: { esm: true, lines: true, source: true },
    strict: true,
    strictRequired: false,
  });

  addFormats(ajv);
  for (const schema of schemasByFile.values()) {
    ajv.addSchema(schema);
  }

  const standaloneSource = standaloneCode(ajv, {
    validateAiProviderSchema: schemaId("ai-provider.schema.json"),
    validateAiTaskSchema: schemaId("ai-task.schema.json"),
    validateCategorySchema: schemaId("category.schema.json"),
    validateDashboardSchema: schemaId("dashboard.schema.json"),
    validateFinancialBrainSchema: schemaId("financial-brain.schema.json"),
    validateImportSchema: schemaId("import.schema.json"),
    validateMerchantSchema: schemaId("merchant.schema.json"),
    validateTransactionSchema: schemaId("transaction.schema.json"),
  });
  const result = await build({
    bundle: true,
    format: "esm",
    legalComments: "none",
    platform: "browser",
    stdin: {
      contents: standaloneSource,
      loader: "js",
      resolveDir: packageRoot,
      sourcefile: "standalone-validators.mjs",
    },
    target: "es2023",
    treeShaking: true,
    write: false,
  });
  const bundledSource = result.outputFiles[0]?.text;

  if (bundledSource === undefined) {
    throw new Error("AJV standalone validator generation produced no browser bundle");
  }

  const output = await format(
    `/* eslint-disable */\n// @ts-nocheck\n${bannerComment}\n${bundledSource}`,
    {
      parser: "typescript",
      printWidth: 100,
    },
  );
  await reconcileGeneratedFile(validatorsOutputPath, output);
}

function schemaId(schemaFile) {
  const schema = schemasByFile.get(schemaFile);

  if (typeof schema?.$id !== "string") {
    throw new Error(`Schema is missing a string $id: ${schemaFile}`);
  }

  return schema.$id;
}

async function reconcileGeneratedFile(outputPath, output) {
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
    `Generated schema artifacts are stale or missing:\n${staleFiles.map((file) => `- ${file}`).join("\n")}\nRun pnpm schema:generate.`,
  );
}

stdout.write(
  `${
    checkOnly
      ? `Verified ${schemaFiles.length} generated schema type files and the standalone validator module.`
      : `Generated ${schemaFiles.length} schema type files and the standalone validator module.`
  }\n`,
);
