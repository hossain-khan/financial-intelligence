import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function fail(message) {
  throw new Error(`TypeScript toolchain check failed: ${message}`);
}

function loadPackage(specifier) {
  const packagePath = require.resolve(`${specifier}/package.json`);
  return {
    directory: dirname(packagePath),
    manifest: JSON.parse(readFileSync(packagePath, "utf8")),
  };
}

function runPackageBinary(packageInfo, binaryName) {
  const relativeBinary = packageInfo.manifest.bin?.[binaryName];
  if (typeof relativeBinary !== "string") {
    fail(`${packageInfo.manifest.name} does not expose ${binaryName}`);
  }

  return execFileSync(
    process.execPath,
    [join(packageInfo.directory, relativeBinary), "--version"],
    {
      encoding: "utf8",
    },
  ).trim();
}

const nativeAlias = rootPackage.devDependencies?.["@typescript/native"];
const compatibilityAlias = rootPackage.devDependencies?.typescript;

if (nativeAlias !== "npm:typescript@7.0.2") {
  fail(`expected @typescript/native to alias typescript@7.0.2, received ${nativeAlias}`);
}
if (compatibilityAlias !== "npm:@typescript/typescript6@6.0.2") {
  fail(
    `expected typescript to alias @typescript/typescript6@6.0.2, received ${compatibilityAlias}`,
  );
}

const nativePackage = loadPackage("@typescript/native");
const compatibilityPackage = loadPackage("typescript");

if (nativePackage.manifest.name !== "typescript" || nativePackage.manifest.version !== "7.0.2") {
  fail("the native alias did not resolve to typescript@7.0.2");
}
if (
  compatibilityPackage.manifest.name !== "@typescript/typescript6" ||
  compatibilityPackage.manifest.version !== "6.0.2"
) {
  fail("the compatibility alias did not resolve to @typescript/typescript6@6.0.2");
}

const nativeVersion = runPackageBinary(nativePackage, "tsc");
const compatibilityVersion = runPackageBinary(compatibilityPackage, "tsc6");
const compilerApi = require("typescript");

if (nativeVersion !== "Version 7.0.2") {
  fail(`expected the tsc binary to report Version 7.0.2, received ${nativeVersion}`);
}
if (compatibilityVersion !== `Version ${compilerApi.version}`) {
  fail(
    `tsc6 reports ${compatibilityVersion}, but the compatibility API reports ${compilerApi.version}`,
  );
}
if (!compilerApi.version.startsWith("6.")) {
  fail(`expected the compatibility API to remain on TypeScript 6, received ${compilerApi.version}`);
}

console.log(
  `Verified TypeScript toolchain: ${nativeVersion}; compatibility API ${compilerApi.version} from package ${compatibilityPackage.manifest.version}.`,
);
