# Provider-neutral AI core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dependency-free `ai-core` boundary — versioned task schemas, provider/router contracts, an always-available no-AI adapter, and a persisted `kind: none` default — so all AI is optional, typed, cancellable, and structurally incapable of mutating financial records.

**Architecture:** New `packages/ai-core` sits above `domain` and below (future) provider adapters. Task wire contracts live in one new `schemas/ai-task.schema.json`, generated into typed validators by the existing `packages/schemas` pipeline. A router validates input/output around an `AbortSignal`-driven `execute()`, returns immutable suggestion + audit values, and never grants mutation capability. A minimal application config port + IndexedDB v10 store persists the default `kind: none` profile with zero network traffic.

**Tech Stack:** TypeScript (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vitest, Dexie/IndexedDB, AJV standalone validators generated via `json-schema-to-typescript` + esbuild.

## Global Constraints

- Node 24: run `nvm use 24` before any command.
- Package manager: `pnpm`. Install with `pnpm install --frozen-lockfile` (only after adding a new package/deps).
- `ai-core` may depend ONLY on `@financial-intelligence/schemas` and `@financial-intelligence/domain`. It must NOT import React, IndexedDB/Dexie, `fetch`, `crypto` network use, provider SDKs, or application repositories.
- All schema objects use `"additionalProperties": false`. Public/portable formats are versioned.
- Never store prompt or response bodies in audit records by default — only redacted digests.
- The default path issues zero AI/model/API network requests.
- Model output is untrusted: strict-parse, schema-validate, bound, treat strings as text only.
- New DB migrations are additive and contiguous; extend the migration matrix test.
- Branded IDs come from `@financial-intelligence/domain` parsers (e.g. `parseWorkspaceId`); v4-shaped UUIDs only (version nibble `[1-8]`, variant `[89ab]`).
- Commits in this repo: do NOT append the `Co-Authored-By: Claude` trailer (CLAUDE.local.md).
- Canonical test command is `pnpm test:coverage` (coverage gate is enforced in CI), not `pnpm test`.
- Full local gate before PR (from AGENTS.md): `pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high`, plus `pnpm browser:test` for storage/worker/network changes.

---

## File Structure

**New package `packages/ai-core/`:**
- `package.json`, `tsconfig.json` — package config (deps: schemas + domain only).
- `src/index.ts` — public exports.
- `src/errors.ts` — `AiErrorCode` union + `AiError` type/guards.
- `src/tasks.ts` — task id/version constants, `AiTaskId`, discriminated request/response TS aliases re-exported from generated schema types, plus per-task `minimize*` functions.
- `src/provider.ts` — `AiProvider` interface, `AiProviderProfileIdentity`, `AiResultEnvelope`, `HealthReport`, `ExecuteOptions`.
- `src/no-ai-provider.ts` — `NoAiProvider`.
- `src/suggestion.ts` — immutable `AiSuggestion` + `AiExecutionAudit` value shapes + constructors.
- `src/router.ts` — `AiRouter` (select profile, validate in/out, one repair, cancellation/timeout, audit).
- `src/testing/fake-provider.ts` — configurable fake provider for contract tests.
- `src/*.test.ts` — colocated unit/contract tests.
- `src/architecture.test.ts` — dependency-boundary test.

**Schemas:**
- Create `schemas/ai-task.schema.json`.
- Modify `packages/schemas/scripts/generate-types.mjs` (register `validateAiTaskSchema`).
- Generated (by running the generator): `packages/schemas/src/generated/ai-task.ts`.
- Modify `packages/schemas/src/index.ts` (export `AiTask*` types + `validateAiTask`).
- Create `schemas/examples/ai-task.example.json` if an examples dir exists; otherwise inline example in a schemas test.

**Application config port:**
- Create `packages/application/src/ai-provider-config.ts` — `AiProviderConfigRepository` port, `GetAiProviderConfig`, `SetAiProviderProfile`, default `kind: none` factory.
- Create `packages/application/src/ai-provider-config.test.ts`.
- Modify `packages/application/src/index.ts` (exports).
- Modify `packages/application/package.json` (add `@financial-intelligence/schemas` dep).

**IndexedDB adapter (v10):**
- Modify `packages/storage-indexeddb/src/migrations.ts` (add v10 + `AI_PROVIDER_PROFILE_SCHEMA`).
- Modify `packages/storage-indexeddb/src/database.ts` (add `aiProviderProfiles` table + `IndexedDbAiProviderProfileRepository`).
- Modify `packages/storage-indexeddb/src/index.ts` (export the repository).
- Modify `packages/storage-indexeddb/src/compatibility.test.ts` (v9→v10 preservation assertion).
- Add `packages/storage-indexeddb/src/ai-provider-profile.test.ts`.

**No-network regression:**
- Add `e2e/ai-no-network.spec.ts` (reuse `e2e/network-guard.ts`).

**Docs:**
- Create `docs/adr/ADR-018-Provider-Neutral-AI-Core.md`; modify `docs/adr/README.md`.
- Modify `docs/08-AI-ARCHITECTURE.md`, `docs/12-SECURITY-AND-PRIVACY.md`, `docs/09-DATA-MODEL.md`, `docs/07-SYSTEM-ARCHITECTURE.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`.

---

## Task 1: Task wire schema + generated validators

**Files:**
- Create: `schemas/ai-task.schema.json`
- Modify: `packages/schemas/scripts/generate-types.mjs`
- Modify: `packages/schemas/src/index.ts`
- Generated: `packages/schemas/src/generated/ai-task.ts`, `packages/schemas/src/generated/validators.ts`
- Test: `packages/schemas/src/ai-task.test.ts`

**Interfaces:**
- Produces: `validateAiTask(value: unknown): ValidationResult`; type `AITask` (generated); the schema `$id` `https://financial-intelligence.local/schemas/ai-task.schema.json`.

- [ ] **Step 1: Write the schema file**

Create `schemas/ai-task.schema.json`. A discriminated envelope keyed by `task` (+ implicit version suffix in the id) with request/response pairs in `$defs`. Reuse the `dataClasses` enum values from `ai-provider.schema.json` verbatim.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://financial-intelligence.local/schemas/ai-task.schema.json",
  "title": "AI Task",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "task", "direction", "payload"],
  "properties": {
    "schemaVersion": { "const": "1.0.0" },
    "task": { "enum": ["merchant.resolve.v1", "category.classify.v1", "query.plan.v1", "insight.word.v1"] },
    "direction": { "enum": ["request", "response"] },
    "payload": { "type": "object" }
  },
  "allOf": [
    { "if": { "properties": { "task": { "const": "merchant.resolve.v1" }, "direction": { "const": "request" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/merchantResolveRequest" } } } },
    { "if": { "properties": { "task": { "const": "merchant.resolve.v1" }, "direction": { "const": "response" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/merchantResolveResponse" } } } },
    { "if": { "properties": { "task": { "const": "category.classify.v1" }, "direction": { "const": "request" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/categoryClassifyRequest" } } } },
    { "if": { "properties": { "task": { "const": "category.classify.v1" }, "direction": { "const": "response" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/categoryClassifyResponse" } } } },
    { "if": { "properties": { "task": { "const": "query.plan.v1" }, "direction": { "const": "request" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/queryPlanRequest" } } } },
    { "if": { "properties": { "task": { "const": "query.plan.v1" }, "direction": { "const": "response" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/queryPlanResponse" } } } },
    { "if": { "properties": { "task": { "const": "insight.word.v1" }, "direction": { "const": "request" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/insightWordRequest" } } } },
    { "if": { "properties": { "task": { "const": "insight.word.v1" }, "direction": { "const": "response" } }, "required": ["task", "direction"] },
      "then": { "properties": { "payload": { "$ref": "#/$defs/insightWordResponse" } } } }
  ],
  "$defs": {
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "boundedText": { "type": "string", "minLength": 1, "maxLength": 200 },
    "evidenceCode": { "enum": ["matched_alias", "similar_confirmed_merchant", "model_category_candidate", "insufficient_evidence"] },
    "categoryId": { "type": "string", "minLength": 1, "maxLength": 80 },
    "descriptionToken": { "type": "string", "minLength": 1, "maxLength": 60 },
    "merchantResolveRequest": {
      "type": "object", "additionalProperties": false, "required": ["tokens"],
      "properties": {
        "tokens": { "type": "array", "minItems": 1, "maxItems": 32, "items": { "$ref": "#/$defs/descriptionToken" } },
        "countryHint": { "type": "string", "minLength": 2, "maxLength": 2 },
        "categoryHint": { "$ref": "#/$defs/categoryId" }
      }
    },
    "merchantResolveResponse": {
      "type": "object", "additionalProperties": false, "required": ["label", "confidence", "evidence"],
      "properties": {
        "label": { "$ref": "#/$defs/boundedText" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "evidence": { "type": "array", "minItems": 1, "maxItems": 8, "items": { "$ref": "#/$defs/evidenceCode" } }
      }
    },
    "categoryClassifyRequest": {
      "type": "object", "additionalProperties": false, "required": ["descriptor", "direction", "allowedCategoryIds"],
      "properties": {
        "descriptor": { "$ref": "#/$defs/boundedText" },
        "direction": { "enum": ["inflow", "outflow"] },
        "allowedCategoryIds": { "type": "array", "minItems": 1, "maxItems": 200, "items": { "$ref": "#/$defs/categoryId" } }
      }
    },
    "categoryClassifyResponse": {
      "type": "object", "additionalProperties": false, "required": ["categoryId", "confidence", "rationale"],
      "properties": {
        "categoryId": { "$ref": "#/$defs/categoryId" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "rationale": { "$ref": "#/$defs/boundedText" }
      }
    },
    "queryPlanRequest": {
      "type": "object", "additionalProperties": false, "required": ["question", "metrics", "dimensions"],
      "properties": {
        "question": { "type": "string", "minLength": 1, "maxLength": 300 },
        "metrics": { "type": "array", "minItems": 1, "maxItems": 32, "items": { "$ref": "#/$defs/boundedText" } },
        "dimensions": { "type": "array", "maxItems": 32, "items": { "$ref": "#/$defs/boundedText" } },
        "dateRange": {
          "type": "object", "additionalProperties": false, "required": ["from", "to"],
          "properties": { "from": { "type": "string", "format": "date" }, "to": { "type": "string", "format": "date" } }
        }
      }
    },
    "queryPlanResponse": {
      "type": "object", "additionalProperties": false, "required": ["metric", "dimensions"],
      "properties": {
        "metric": { "$ref": "#/$defs/boundedText" },
        "dimensions": { "type": "array", "maxItems": 8, "items": { "$ref": "#/$defs/boundedText" } },
        "filters": { "type": "array", "maxItems": 16, "items": { "$ref": "#/$defs/boundedText" } },
        "period": { "$ref": "#/$defs/boundedText" },
        "comparison": { "$ref": "#/$defs/boundedText" },
        "sort": { "$ref": "#/$defs/boundedText" },
        "limit": { "type": "integer", "minimum": 1, "maximum": 1000 }
      }
    },
    "insightWordRequest": {
      "type": "object", "additionalProperties": false, "required": ["facts"],
      "properties": {
        "facts": { "type": "array", "minItems": 1, "maxItems": 32, "items": {
          "type": "object", "additionalProperties": false, "required": ["id", "value"],
          "properties": { "id": { "$ref": "#/$defs/boundedText" }, "value": { "$ref": "#/$defs/boundedText" } } } }
      }
    },
    "insightWordResponse": {
      "type": "object", "additionalProperties": false, "required": ["summary", "factRefs"],
      "properties": {
        "summary": { "type": "string", "minLength": 1, "maxLength": 500 },
        "factRefs": { "type": "array", "minItems": 1, "maxItems": 32, "items": { "$ref": "#/$defs/boundedText" } }
      }
    }
  }
}
```

- [ ] **Step 2: Register the validator in the generator**

In `packages/schemas/scripts/generate-types.mjs`, add `validateAiTaskSchema` to the `standaloneCode(ajv, {...})` map (alphabetical order, after `validateAiProviderSchema`):

```js
    validateAiProviderSchema: schemaId("ai-provider.schema.json"),
    validateAiTaskSchema: schemaId("ai-task.schema.json"),
    validateCategorySchema: schemaId("category.schema.json"),
```

- [ ] **Step 3: Run the generator**

Run: `nvm use 24 && pnpm schema:generate`
Expected: writes `packages/schemas/src/generated/ai-task.ts` and updates `validators.ts`; prints "Generated 8 schema type files ...".

- [ ] **Step 4: Export from the schemas index**

In `packages/schemas/src/index.ts`: add `validateAiTaskSchema` to the import from `./generated/validators`; add `export type { AITask } from "./generated/ai-task";` (use the exact exported type name the generator produced — check the generated file header); add `export const validateAiTask = createValidator(validateAiTaskSchema);` next to `validateAiProvider`.

- [ ] **Step 5: Write the failing test**

Create `packages/schemas/src/ai-task.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateAiTask } from "./index";

describe("ai-task schema", () => {
  it("accepts a valid category.classify.v1 request", () => {
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task: "category.classify.v1",
      direction: "request",
      payload: { descriptor: "coffee shop downtown", direction: "outflow", allowedCategoryIds: ["dining"] },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects unknown payload properties", () => {
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task: "category.classify.v1",
      direction: "response",
      payload: { categoryId: "dining", confidence: 0.5, rationale: "x", extra: true },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task: "merchant.resolve.v1",
      direction: "response",
      payload: { label: "Store", confidence: 1.5, evidence: ["matched_alias"] },
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `nvm use 24 && pnpm vitest run packages/schemas/src/ai-task.test.ts`
Expected: PASS (3 tests). If the type export name differs, fix the import in `index.ts`.

- [ ] **Step 7: Verify schema check + typecheck**

Run: `pnpm schema:check && pnpm --filter @financial-intelligence/schemas typecheck`
Expected: "Verified 8 generated schema type files ..." and no type errors.

- [ ] **Step 8: Commit**

```bash
git add schemas/ai-task.schema.json packages/schemas/
git commit -m "Add versioned ai-task wire schema and generated validator

Refs #31"
```

---

## Task 2: ai-core package scaffold + error taxonomy

**Files:**
- Create: `packages/ai-core/package.json`, `packages/ai-core/tsconfig.json`, `packages/ai-core/src/index.ts`
- Create: `packages/ai-core/src/errors.ts`
- Test: `packages/ai-core/src/errors.test.ts`
- Modify: root lockfile (via `pnpm install`)

**Interfaces:**
- Produces: `type AiErrorCode`; `interface AiError { readonly code: AiErrorCode; readonly message: string }`; `function isAiError(value: unknown): value is AiError`; `function aiError(code: AiErrorCode, message: string): AiError`.

- [ ] **Step 1: Create package.json**

Create `packages/ai-core/package.json`:

```json
{
  "name": "@financial-intelligence/ai-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p tsconfig.json" },
  "dependencies": {
    "@financial-intelligence/domain": "workspace:*",
    "@financial-intelligence/schemas": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/ai-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023"], "types": [] },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Install to wire the workspace**

Run: `nvm use 24 && pnpm install`
Expected: lockfile updates; `@financial-intelligence/ai-core` linked.

- [ ] **Step 4: Write the failing test**

Create `packages/ai-core/src/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aiError, isAiError } from "./errors";

describe("AiError", () => {
  it("builds a normalized error", () => {
    const err = aiError("timeout", "deadline exceeded");
    expect(err).toEqual({ code: "timeout", message: "deadline exceeded" });
  });

  it("recognizes an AiError shape", () => {
    expect(isAiError(aiError("unsupported", "x"))).toBe(true);
    expect(isAiError({ code: "not-a-code" })).toBe(false);
    expect(isAiError(null)).toBe(false);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/errors.test.ts`
Expected: FAIL (cannot resolve `./errors`).

- [ ] **Step 6: Implement errors.ts**

Create `packages/ai-core/src/errors.ts`:

```ts
export const AI_ERROR_CODES = [
  "unsupported",
  "consent_required",
  "invalid_request",
  "invalid_output",
  "timeout",
  "cancelled",
  "rate_limited",
  "resource_exhausted",
  "network",
  "provider_error",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export interface AiError {
  readonly code: AiErrorCode;
  readonly message: string;
}

export function aiError(code: AiErrorCode, message: string): AiError {
  return { code, message };
}

export function isAiError(value: unknown): value is AiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "string" &&
    (AI_ERROR_CODES as readonly string[]).includes((value as { code: string }).code) &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}
```

- [ ] **Step 7: Create the index barrel**

Create `packages/ai-core/src/index.ts`:

```ts
export { AI_ERROR_CODES, aiError, isAiError } from "./errors";
export type { AiError, AiErrorCode } from "./errors";
```

- [ ] **Step 8: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/ai-core/ pnpm-lock.yaml
git commit -m "Scaffold ai-core package with AI error taxonomy

Refs #31"
```

---

## Task 3: Task ids, typed request/response aliases, and context minimizers

**Files:**
- Create: `packages/ai-core/src/tasks.ts`
- Test: `packages/ai-core/src/tasks.test.ts`
- Modify: `packages/ai-core/src/index.ts`

**Interfaces:**
- Consumes: `AITask` type + `validateAiTask` from `@financial-intelligence/schemas`.
- Produces:
  - `const AI_TASK_IDS = ["merchant.resolve.v1","category.classify.v1","query.plan.v1","insight.word.v1"] as const`
  - `type AiTaskId = (typeof AI_TASK_IDS)[number]`
  - `interface CategoryClassifyRequest { descriptor: string; direction: "inflow" | "outflow"; allowedCategoryIds: readonly string[] }` (and the other three request/response shapes, re-derived from the generated `AITask` payload types).
  - `function minimizeCategoryClassify(input: { descriptor: string; direction: "inflow" | "outflow"; allowedCategoryIds: readonly string[] }): CategoryClassifyRequest` — trims/bounds descriptor to 200 chars, dedupes allowedCategoryIds, caps at 200.
  - `const TASK_DATA_CLASSES: Readonly<Record<AiTaskId, readonly string[]>>` — declared disclosure surface per task (values from the `dataClasses` enum).

- [ ] **Step 1: Write the failing test**

Create `packages/ai-core/src/tasks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AI_TASK_IDS, TASK_DATA_CLASSES, minimizeCategoryClassify } from "./tasks";

describe("task ids", () => {
  it("lists the four documented tasks", () => {
    expect(AI_TASK_IDS).toEqual([
      "merchant.resolve.v1",
      "category.classify.v1",
      "query.plan.v1",
      "insight.word.v1",
    ]);
  });

  it("declares a data-class surface for every task", () => {
    for (const id of AI_TASK_IDS) {
      expect(TASK_DATA_CLASSES[id].length).toBeGreaterThan(0);
    }
  });
});

describe("minimizeCategoryClassify", () => {
  it("bounds the descriptor and dedupes allowed ids", () => {
    const out = minimizeCategoryClassify({
      descriptor: "x".repeat(500),
      direction: "outflow",
      allowedCategoryIds: ["dining", "dining", "travel"],
    });
    expect(out.descriptor.length).toBe(200);
    expect(out.allowedCategoryIds).toEqual(["dining", "travel"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/tasks.test.ts`
Expected: FAIL (cannot resolve `./tasks`).

- [ ] **Step 3: Implement tasks.ts**

Create `packages/ai-core/src/tasks.ts`:

```ts
export const AI_TASK_IDS = [
  "merchant.resolve.v1",
  "category.classify.v1",
  "query.plan.v1",
  "insight.word.v1",
] as const;

export type AiTaskId = (typeof AI_TASK_IDS)[number];

export interface MerchantResolveRequest {
  readonly tokens: readonly string[];
  readonly countryHint?: string;
  readonly categoryHint?: string;
}
export interface MerchantResolveResponse {
  readonly label: string;
  readonly confidence: number;
  readonly evidence: readonly string[];
}
export interface CategoryClassifyRequest {
  readonly descriptor: string;
  readonly direction: "inflow" | "outflow";
  readonly allowedCategoryIds: readonly string[];
}
export interface CategoryClassifyResponse {
  readonly categoryId: string;
  readonly confidence: number;
  readonly rationale: string;
}

export const TASK_DATA_CLASSES: Readonly<Record<AiTaskId, readonly string[]>> = {
  "merchant.resolve.v1": ["normalizedDescription"],
  "category.classify.v1": ["normalizedDescription", "merchantLabel", "amountDirection", "categoryVocabulary"],
  "query.plan.v1": ["question"],
  "insight.word.v1": ["aggregateFacts"],
};

const MAX_DESCRIPTOR = 200;
const MAX_ALLOWED_CATEGORIES = 200;

export function minimizeCategoryClassify(input: CategoryClassifyRequest): CategoryClassifyRequest {
  return {
    descriptor: input.descriptor.trim().slice(0, MAX_DESCRIPTOR),
    direction: input.direction,
    allowedCategoryIds: [...new Set(input.allowedCategoryIds)].slice(0, MAX_ALLOWED_CATEGORIES),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/tasks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Export from index**

Append to `packages/ai-core/src/index.ts`:

```ts
export { AI_TASK_IDS, TASK_DATA_CLASSES, minimizeCategoryClassify } from "./tasks";
export type {
  AiTaskId,
  CategoryClassifyRequest,
  CategoryClassifyResponse,
  MerchantResolveRequest,
  MerchantResolveResponse,
} from "./tasks";
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/
git commit -m "Add ai-core task ids, typed shapes, and context minimizer

Refs #31"
```

---

## Task 4: Provider interface, suggestion + audit values, and NoAiProvider

**Files:**
- Create: `packages/ai-core/src/provider.ts`, `packages/ai-core/src/suggestion.ts`, `packages/ai-core/src/no-ai-provider.ts`
- Test: `packages/ai-core/src/no-ai-provider.test.ts`
- Modify: `packages/ai-core/src/index.ts`

**Interfaces:**
- Consumes: `AiError`, `AiErrorCode` (Task 2); `AiTaskId` (Task 3).
- Produces:
  - `type ExecutionLocation = "local" | "selfHosted" | "remote"`
  - `interface AiProviderProfileIdentity { readonly profileId: string; readonly adapterId: string; readonly adapterVersion: string; readonly executionLocation: ExecutionLocation; readonly reportedModel: string | null; readonly supportedTasks: readonly AiTaskId[]; readonly structuredOutput: boolean; readonly contextLimit: number; readonly outputLimit: number }`
  - `interface HealthReport { readonly ok: boolean; readonly detail?: string }`
  - `interface ExecuteOptions { readonly signal: AbortSignal; readonly deadlineMs: number; readonly onProgress?: (fraction: number) => void }`
  - `interface AiTaskRequest { readonly task: AiTaskId; readonly payload: unknown }`
  - `type AiResultEnvelope = { readonly ok: true; readonly output: unknown } | { readonly ok: false; readonly error: AiError }`
  - `interface AiProvider { readonly profile: AiProviderProfileIdentity; health(): Promise<HealthReport>; execute(request: AiTaskRequest, options: ExecuteOptions): Promise<AiResultEnvelope> }`
  - `const NO_AI_PROFILE_ID = "profile:none"`; `class NoAiProvider implements AiProvider`
  - From `suggestion.ts`: `interface AiSuggestion`, `interface AiExecutionAudit`, `function createAudit(...)`.

- [ ] **Step 1: Implement provider.ts**

Create `packages/ai-core/src/provider.ts`:

```ts
import type { AiError } from "./errors";
import type { AiTaskId } from "./tasks";

export type ExecutionLocation = "local" | "selfHosted" | "remote";

export interface AiProviderProfileIdentity {
  readonly profileId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly executionLocation: ExecutionLocation;
  readonly reportedModel: string | null;
  readonly supportedTasks: readonly AiTaskId[];
  readonly structuredOutput: boolean;
  readonly contextLimit: number;
  readonly outputLimit: number;
}

export interface HealthReport {
  readonly ok: boolean;
  readonly detail?: string;
}

export interface ExecuteOptions {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
  readonly onProgress?: (fraction: number) => void;
}

export interface AiTaskRequest {
  readonly task: AiTaskId;
  readonly payload: unknown;
}

export type AiResultEnvelope =
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly error: AiError };

export interface AiProvider {
  readonly profile: AiProviderProfileIdentity;
  health(): Promise<HealthReport>;
  execute(request: AiTaskRequest, options: ExecuteOptions): Promise<AiResultEnvelope>;
}
```

Note: `health()` takes no argument — it is structurally incapable of receiving a task payload.

- [ ] **Step 2: Implement suggestion.ts**

Create `packages/ai-core/src/suggestion.ts`:

```ts
import type { AiErrorCode } from "./errors";
import type { AiTaskId, ExecutionLocation } from "./index-types";

export type AiOutcome = "accepted" | "abstained" | "error" | "cancelled";

export interface AiSuggestion {
  readonly task: AiTaskId;
  readonly output: unknown;
  readonly confidence: number | null;
}

export interface AiExecutionAudit {
  readonly requestId: string;
  readonly task: AiTaskId;
  readonly schemaVersion: string;
  readonly promptVersion: string;
  readonly profileId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly reportedModel: string | null;
  readonly executionLocation: ExecutionLocation;
  readonly consentState: "none" | "granted";
  readonly outcome: AiOutcome;
  readonly errorCode: AiErrorCode | null;
  readonly durationBucket: string;
  readonly inputDigest: string;
  readonly outputDigest: string | null;
}
```

To avoid a circular import, define the shared `AiTaskId`/`ExecutionLocation` re-export module: create `packages/ai-core/src/index-types.ts`:

```ts
export type { AiTaskId } from "./tasks";
export type { ExecutionLocation } from "./provider";
```

- [ ] **Step 3: Write the failing test**

Create `packages/ai-core/src/no-ai-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NoAiProvider, NO_AI_PROFILE_ID } from "./no-ai-provider";

describe("NoAiProvider", () => {
  it("reports no supported tasks and healthy", async () => {
    const provider = new NoAiProvider();
    expect(provider.profile.profileId).toBe(NO_AI_PROFILE_ID);
    expect(provider.profile.supportedTasks).toEqual([]);
    expect((await provider.health()).ok).toBe(true);
  });

  it("returns unsupported for any execute call", async () => {
    const provider = new NoAiProvider();
    const controller = new AbortController();
    const result = await provider.execute(
      { task: "category.classify.v1", payload: {} },
      { signal: controller.signal, deadlineMs: 1000 },
    );
    expect(result).toEqual({ ok: false, error: { code: "unsupported", message: expect.any(String) } });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/no-ai-provider.test.ts`
Expected: FAIL (cannot resolve `./no-ai-provider`).

- [ ] **Step 5: Implement no-ai-provider.ts**

Create `packages/ai-core/src/no-ai-provider.ts`:

```ts
import { aiError } from "./errors";
import type { AiProvider, AiProviderProfileIdentity, AiResultEnvelope, HealthReport } from "./provider";

export const NO_AI_PROFILE_ID = "profile:none";

export class NoAiProvider implements AiProvider {
  public readonly profile: AiProviderProfileIdentity = {
    profileId: NO_AI_PROFILE_ID,
    adapterId: "none",
    adapterVersion: "1.0.0",
    executionLocation: "local",
    reportedModel: null,
    supportedTasks: [],
    structuredOutput: false,
    contextLimit: 0,
    outputLimit: 0,
  };

  public health(): Promise<HealthReport> {
    return Promise.resolve({ ok: true });
  }

  public execute(): Promise<AiResultEnvelope> {
    return Promise.resolve({ ok: false, error: aiError("unsupported", "No AI provider is configured.") });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/no-ai-provider.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Export from index**

Append to `packages/ai-core/src/index.ts`:

```ts
export { NoAiProvider, NO_AI_PROFILE_ID } from "./no-ai-provider";
export type {
  AiProvider,
  AiProviderProfileIdentity,
  AiResultEnvelope,
  AiTaskRequest,
  ExecuteOptions,
  ExecutionLocation,
  HealthReport,
} from "./provider";
export type { AiExecutionAudit, AiOutcome, AiSuggestion } from "./suggestion";
```

- [ ] **Step 8: Commit**

```bash
git add packages/ai-core/
git commit -m "Add AI provider contract, audit values, and NoAiProvider

Refs #31"
```

---

## Task 5: Fake provider (test double)

**Files:**
- Create: `packages/ai-core/src/testing/fake-provider.ts`
- Test: `packages/ai-core/src/testing/fake-provider.test.ts`
- Modify: `packages/ai-core/src/index.ts`

**Interfaces:**
- Consumes: `AiProvider`, `AiResultEnvelope`, `AiTaskRequest`, `ExecuteOptions`, `AiProviderProfileIdentity` (Task 4).
- Produces: `interface FakeProviderScript { readonly profile?: Partial<AiProviderProfileIdentity>; readonly responses: readonly AiResultEnvelope[]; readonly delayMs?: number; readonly throwOnExecute?: boolean }`; `class FakeProvider implements AiProvider` — returns scripted responses in order, honors `signal`/`deadlineMs` (rejects with a `cancelled`/`timeout` envelope), records `calls`.

- [ ] **Step 1: Write the failing test**

Create `packages/ai-core/src/testing/fake-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FakeProvider } from "./fake-provider";

describe("FakeProvider", () => {
  it("returns scripted responses in order and records calls", async () => {
    const provider = new FakeProvider({
      profile: { supportedTasks: ["category.classify.v1"] },
      responses: [{ ok: true, output: { categoryId: "dining", confidence: 0.9, rationale: "x" } }],
    });
    const controller = new AbortController();
    const result = await provider.execute(
      { task: "category.classify.v1", payload: {} },
      { signal: controller.signal, deadlineMs: 1000 },
    );
    expect(result).toEqual({ ok: true, output: { categoryId: "dining", confidence: 0.9, rationale: "x" } });
    expect(provider.calls).toHaveLength(1);
  });

  it("settles cancelled when the signal is already aborted", async () => {
    const provider = new FakeProvider({ responses: [{ ok: true, output: {} }] });
    const controller = new AbortController();
    controller.abort();
    const result = await provider.execute(
      { task: "category.classify.v1", payload: {} },
      { signal: controller.signal, deadlineMs: 1000 },
    );
    expect(result).toEqual({ ok: false, error: { code: "cancelled", message: expect.any(String) } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/testing/fake-provider.test.ts`
Expected: FAIL (cannot resolve `./fake-provider`).

- [ ] **Step 3: Implement fake-provider.ts**

Create `packages/ai-core/src/testing/fake-provider.ts`:

```ts
import { aiError } from "../errors";
import type {
  AiProvider,
  AiProviderProfileIdentity,
  AiResultEnvelope,
  AiTaskRequest,
  ExecuteOptions,
  HealthReport,
} from "../provider";

export interface FakeProviderScript {
  readonly profile?: Partial<AiProviderProfileIdentity>;
  readonly responses: readonly AiResultEnvelope[];
  readonly throwOnExecute?: boolean;
}

const DEFAULT_PROFILE: AiProviderProfileIdentity = {
  profileId: "profile:fake",
  adapterId: "fake",
  adapterVersion: "1.0.0",
  executionLocation: "local",
  reportedModel: "fake-model",
  supportedTasks: ["category.classify.v1"],
  structuredOutput: true,
  contextLimit: 4096,
  outputLimit: 512,
};

export class FakeProvider implements AiProvider {
  public readonly profile: AiProviderProfileIdentity;
  public readonly calls: AiTaskRequest[] = [];
  private index = 0;

  public constructor(private readonly script: FakeProviderScript) {
    this.profile = { ...DEFAULT_PROFILE, ...script.profile };
  }

  public health(): Promise<HealthReport> {
    return Promise.resolve({ ok: true });
  }

  public execute(request: AiTaskRequest, options: ExecuteOptions): Promise<AiResultEnvelope> {
    this.calls.push(request);
    if (options.signal.aborted) {
      return Promise.resolve({ ok: false, error: aiError("cancelled", "Aborted before dispatch.") });
    }
    if (this.script.throwOnExecute === true) {
      throw new Error("fake provider failure");
    }
    const response = this.script.responses[this.index] ?? this.script.responses.at(-1);
    this.index += 1;
    if (response === undefined) {
      return Promise.resolve({ ok: false, error: aiError("provider_error", "No scripted response.") });
    }
    return Promise.resolve(response);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/testing/fake-provider.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Export from index**

Append to `packages/ai-core/src/index.ts`:

```ts
export { FakeProvider } from "./testing/fake-provider";
export type { FakeProviderScript } from "./testing/fake-provider";
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/
git commit -m "Add FakeProvider test double for ai-core contract tests

Refs #31"
```

---

## Task 6: Router — selection, validation, repair, cancellation, audit

**Files:**
- Create: `packages/ai-core/src/router.ts`
- Test: `packages/ai-core/src/router.test.ts`
- Modify: `packages/ai-core/src/index.ts`

**Interfaces:**
- Consumes: `AiProvider`, `AiTaskRequest`, `AiResultEnvelope` (Task 4); `AiSuggestion`, `AiExecutionAudit` (Task 4); `validateAiTask` from schemas; `aiError` (Task 2).
- Produces:
  - `interface RouterDeps { readonly provider: AiProvider; readonly now: () => number; readonly newRequestId: () => string; readonly digest: (value: unknown) => string; readonly promptVersion?: string; readonly consentState?: "none" | "granted"; readonly allowRepair?: boolean }`
  - `interface RouterExecuteInput { readonly task: AiTaskId; readonly payload: unknown; readonly allowedIds?: readonly string[]; readonly signal?: AbortSignal; readonly deadlineMs?: number }`
  - `interface RouterResult { readonly suggestion: AiSuggestion | null; readonly audit: AiExecutionAudit }`
  - `class AiRouter { constructor(deps: RouterDeps); execute(input: RouterExecuteInput): Promise<RouterResult> }`
- Router behavior: reject request not supported by the provider profile → `unsupported`; validate request with `validateAiTask` (build the `{schemaVersion,task,direction:"request",payload}` envelope) → on fail `invalid_request`; dispatch; validate response envelope → on fail, if `allowRepair` and first failure, retry once passing validation codes into the request payload's `repairHints`; second failure → `invalid_output`, `outcome:"abstained"`, `suggestion:null`; enforce `allowedIds` membership on `category.classify.v1` response `categoryId`; on abort → `cancelled` with no success audit; audit always produced; bodies never stored (only digests).

- [ ] **Step 1: Write the failing tests**

Create `packages/ai-core/src/router.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AiRouter } from "./router";
import { FakeProvider } from "./testing/fake-provider";

function deps(provider: FakeProvider, overrides = {}) {
  let n = 0;
  return {
    provider,
    now: () => 1000,
    newRequestId: () => "req-1",
    digest: () => "digest",
    ...overrides,
  };
}

const validResponse = { ok: true as const, output: { categoryId: "dining", confidence: 0.9, rationale: "coffee" } };
const req = {
  task: "category.classify.v1" as const,
  payload: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] },
  allowedIds: ["dining"],
};

describe("AiRouter", () => {
  it("returns a validated suggestion and a success audit", async () => {
    const router = new AiRouter(deps(new FakeProvider({ responses: [validResponse] })));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion?.output).toEqual(validResponse.output);
    expect(audit.outcome).toBe("accepted");
    expect(audit.task).toBe("category.classify.v1");
    expect(audit).not.toHaveProperty("output");
  });

  it("abstains when the model returns a category outside the allowed set", async () => {
    const bad = { ok: true as const, output: { categoryId: "hacking", confidence: 0.9, rationale: "x" } };
    const router = new AiRouter(deps(new FakeProvider({ responses: [bad] })));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion).toBeNull();
    expect(audit.outcome).toBe("abstained");
    expect(audit.errorCode).toBe("invalid_output");
  });

  it("returns unsupported when the provider does not support the task", async () => {
    const provider = new FakeProvider({ profile: { supportedTasks: [] }, responses: [validResponse] });
    const { suggestion, audit } = await router.executeWith(provider, req);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("unsupported");
  });

  it("settles cancelled with no success audit when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const router = new AiRouter(deps(new FakeProvider({ responses: [validResponse] })));
    const { suggestion, audit } = await router.execute({ ...req, signal: controller.signal });
    expect(suggestion).toBeNull();
    expect(audit.outcome).toBe("cancelled");
  });

  it("rejects malformed output as invalid_output without mutation", async () => {
    const malformed = { ok: true as const, output: { categoryId: 123 } };
    const router = new AiRouter(deps(new FakeProvider({ responses: [malformed] })));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("invalid_output");
  });
});
```

Note: remove the `executeWith` helper line — replace that test body to construct a new router: `const router = new AiRouter(deps(provider));` then `await router.execute(req)`. (Keep tests using only the public `execute`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/router.test.ts`
Expected: FAIL (cannot resolve `./router`).

- [ ] **Step 3: Implement router.ts**

Create `packages/ai-core/src/router.ts`:

```ts
import { validateAiTask } from "@financial-intelligence/schemas";

import { aiError, type AiErrorCode } from "./errors";
import type { AiProvider } from "./provider";
import type { AiExecutionAudit, AiOutcome, AiSuggestion } from "./suggestion";
import type { AiTaskId } from "./tasks";

export interface RouterDeps {
  readonly provider: AiProvider;
  readonly now: () => number;
  readonly newRequestId: () => string;
  readonly digest: (value: unknown) => string;
  readonly promptVersion?: string;
  readonly consentState?: "none" | "granted";
  readonly allowRepair?: boolean;
}

export interface RouterExecuteInput {
  readonly task: AiTaskId;
  readonly payload: unknown;
  readonly allowedIds?: readonly string[];
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface RouterResult {
  readonly suggestion: AiSuggestion | null;
  readonly audit: AiExecutionAudit;
}

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_DEADLINE_MS = 15_000;

export class AiRouter {
  public constructor(private readonly deps: RouterDeps) {}

  public async execute(input: RouterExecuteInput): Promise<RouterResult> {
    const signal = input.signal ?? new AbortController().signal;

    if (signal.aborted) {
      return this.settle(input, "cancelled", "cancelled", null, null);
    }
    if (!this.deps.provider.profile.supportedTasks.includes(input.task)) {
      return this.settle(input, "error", "unsupported", null, null);
    }
    if (!this.validEnvelope(input.task, "request", input.payload)) {
      return this.settle(input, "error", "invalid_request", null, null);
    }

    let envelope;
    try {
      envelope = await this.deps.provider.execute(
        { task: input.task, payload: input.payload },
        { signal, deadlineMs: input.deadlineMs ?? DEFAULT_DEADLINE_MS },
      );
    } catch {
      return this.settle(input, "error", "provider_error", null, null);
    }

    if (signal.aborted) {
      return this.settle(input, "cancelled", "cancelled", null, null);
    }
    if (!envelope.ok) {
      return this.settle(input, "error", envelope.error.code, null, null);
    }
    if (!this.validEnvelope(input.task, "response", envelope.output) || !this.allowedOk(input, envelope.output)) {
      return this.settle(input, "abstained", "invalid_output", null, null);
    }

    const suggestion: AiSuggestion = {
      task: input.task,
      output: envelope.output,
      confidence: readConfidence(envelope.output),
    };
    return this.settle(input, "accepted", null, suggestion, envelope.output);
  }

  private validEnvelope(task: AiTaskId, direction: "request" | "response", payload: unknown): boolean {
    return validateAiTask({ schemaVersion: SCHEMA_VERSION, task, direction, payload }).valid;
  }

  private allowedOk(input: RouterExecuteInput, output: unknown): boolean {
    if (input.task !== "category.classify.v1" || input.allowedIds === undefined) return true;
    const id = (output as { categoryId?: unknown }).categoryId;
    return typeof id === "string" && input.allowedIds.includes(id);
  }

  private settle(
    input: RouterExecuteInput,
    outcome: AiOutcome,
    errorCode: AiErrorCode | null,
    suggestion: AiSuggestion | null,
    output: unknown,
  ): RouterResult {
    const p = this.deps.provider.profile;
    const audit: AiExecutionAudit = {
      requestId: this.deps.newRequestId(),
      task: input.task,
      schemaVersion: SCHEMA_VERSION,
      promptVersion: this.deps.promptVersion ?? "1.0.0",
      profileId: p.profileId,
      adapterId: p.adapterId,
      adapterVersion: p.adapterVersion,
      reportedModel: p.reportedModel,
      executionLocation: p.executionLocation,
      consentState: this.deps.consentState ?? "none",
      outcome,
      errorCode,
      durationBucket: "lt_1s",
      inputDigest: this.deps.digest(input.payload),
      outputDigest: output === null ? null : this.deps.digest(output),
    };
    return { suggestion, audit };
  }
}

function readConfidence(output: unknown): number | null {
  const c = (output as { confidence?: unknown }).confidence;
  return typeof c === "number" ? c : null;
}
```

Note: the one-repair policy is represented by `allowRepair` in `RouterDeps`; wire the single retry in a follow-up sub-step only if the fake-provider contract test for repair (Task 7) requires it. Keep the initial router single-pass; Task 7 adds the repair test + the retry branch.

- [ ] **Step 4: Fix the placeholder test (remove executeWith)**

In `router.test.ts`, replace the "unsupported" test body with:

```ts
  it("returns unsupported when the provider does not support the task", async () => {
    const provider = new FakeProvider({ profile: { supportedTasks: [] }, responses: [validResponse] });
    const router = new AiRouter(deps(provider));
    const { suggestion, audit } = await router.execute(req);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("unsupported");
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/router.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Export from index**

Append to `packages/ai-core/src/index.ts`:

```ts
export { AiRouter } from "./router";
export type { RouterDeps, RouterExecuteInput, RouterResult } from "./router";
```

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/
git commit -m "Add ai-core router with validation, allowed-id, cancellation, and audit

Refs #31"
```

---

## Task 7: One-repair policy + full contract matrix

**Files:**
- Modify: `packages/ai-core/src/router.ts`
- Test: `packages/ai-core/src/router-contract.test.ts`

**Interfaces:**
- Consumes: everything from Task 6.
- Produces: repair behavior — when `deps.allowRepair === true` and the first response fails validation, the router calls `provider.execute` a second time with `payload` augmented by `{ repairHints: string[] }` (validation keywords). A second invalid response settles `abstained` / `invalid_output`. No repair when `allowRepair` is falsy.

- [ ] **Step 1: Write the failing contract test**

Create `packages/ai-core/src/router-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AiRouter } from "./router";
import { FakeProvider } from "./testing/fake-provider";

const good = { ok: true as const, output: { categoryId: "dining", confidence: 0.8, rationale: "ok" } };
const bad = { ok: true as const, output: { categoryId: 5 } };
const base = {
  task: "category.classify.v1" as const,
  payload: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] },
  allowedIds: ["dining"],
};
const deps = (provider: FakeProvider, allowRepair = false) => ({
  provider,
  now: () => 0,
  newRequestId: () => "r",
  digest: () => "d",
  allowRepair,
});

describe("router repair policy", () => {
  it("repairs once then accepts on the retry", async () => {
    const provider = new FakeProvider({ responses: [bad, good] });
    const router = new AiRouter(deps(provider, true));
    const { suggestion } = await router.execute(base);
    expect(suggestion?.output).toEqual(good.output);
    expect(provider.calls).toHaveLength(2);
    expect((provider.calls[1]?.payload as { repairHints?: unknown }).repairHints).toBeDefined();
  });

  it("abstains after a second invalid result", async () => {
    const provider = new FakeProvider({ responses: [bad, bad] });
    const router = new AiRouter(deps(provider, true));
    const { suggestion, audit } = await router.execute(base);
    expect(suggestion).toBeNull();
    expect(audit.errorCode).toBe("invalid_output");
    expect(provider.calls).toHaveLength(2);
  });

  it("does not repair when allowRepair is false", async () => {
    const provider = new FakeProvider({ responses: [bad, good] });
    const router = new AiRouter(deps(provider, false));
    const { suggestion } = await router.execute(base);
    expect(suggestion).toBeNull();
    expect(provider.calls).toHaveLength(1);
  });

  it("maps a thrown provider error to provider_error", async () => {
    const provider = new FakeProvider({ responses: [], throwOnExecute: true });
    const router = new AiRouter(deps(provider));
    const { audit } = await router.execute(base);
    expect(audit.errorCode).toBe("provider_error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/router-contract.test.ts`
Expected: FAIL (repair not implemented; calls length 1).

- [ ] **Step 3: Add the repair branch to router.ts**

Replace the response-validation block in `execute()` so that, on first invalid output with `allowRepair`, it re-dispatches once with repair hints:

```ts
    if (!this.validEnvelope(input.task, "response", envelope.output) || !this.allowedOk(input, envelope.output)) {
      if (this.deps.allowRepair === true) {
        const hints = this.hintsFor(input, envelope.output);
        const repaired = await this.dispatchRepair(input, hints, signal);
        if (repaired.ok && this.validEnvelope(input.task, "response", repaired.output) && this.allowedOk(input, repaired.output)) {
          const suggestion: AiSuggestion = { task: input.task, output: repaired.output, confidence: readConfidence(repaired.output) };
          return this.settle(input, "accepted", null, suggestion, repaired.output);
        }
      }
      return this.settle(input, "abstained", "invalid_output", null, null);
    }
```

Add private helpers to the class:

```ts
  private hintsFor(input: RouterExecuteInput, output: unknown): string[] {
    const result = validateAiTask({ schemaVersion: SCHEMA_VERSION, task: input.task, direction: "response", payload: output });
    return result.valid ? ["allowed_id"] : result.errors.map((e) => e.keyword);
  }

  private async dispatchRepair(input: RouterExecuteInput, repairHints: string[], signal: AbortSignal) {
    const payload = { ...(input.payload as object), repairHints };
    try {
      return await this.deps.provider.execute({ task: input.task, payload }, { signal, deadlineMs: input.deadlineMs ?? DEFAULT_DEADLINE_MS });
    } catch {
      return { ok: false as const, error: aiError("provider_error", "Repair dispatch failed.") };
    }
  }
```

Note: `repairHints` is an extra request property; the request validator runs on the ORIGINAL payload before dispatch, so adding `repairHints` for the repair call does not re-run request validation. This is intentional — repair carries validation codes, never data access.

- [ ] **Step 4: Run tests to verify they pass**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/router-contract.test.ts packages/ai-core/src/router.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add packages/ai-core/
git commit -m "Add one-shot repair policy and router contract matrix

Refs #31"
```

---

## Task 8: Architecture dependency-boundary test

**Files:**
- Test: `packages/ai-core/src/architecture.test.ts`

**Interfaces:**
- Consumes: nothing at runtime; reads `ai-core` source files + `package.json` from disk via `node:fs`.
- Produces: a test asserting no forbidden import specifiers appear in `packages/ai-core/src/**/*.ts` and that `package.json` dependencies are exactly the two allowed workspace packages.

- [ ] **Step 1: Write the failing test**

Create `packages/ai-core/src/architecture.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));

const FORBIDDEN = ["react", "dexie", "indexeddb", "@financial-intelligence/application", "@financial-intelligence/storage-indexeddb"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("ai-core dependency boundary", () => {
  it("never imports forbidden runtime dependencies", () => {
    for (const file of walk(srcDir)) {
      const source = readFileSync(file, "utf8");
      for (const banned of FORBIDDEN) {
        expect(source, `${file} imports ${banned}`).not.toContain(`from "${banned}"`);
      }
      expect(source, `${file} uses fetch`).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("declares only schemas and domain as dependencies", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@financial-intelligence/domain",
      "@financial-intelligence/schemas",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/ai-core/src/architecture.test.ts`
Expected: PASS (2 tests). If it fails, an earlier task introduced a forbidden import — fix the source, not the test.

- [ ] **Step 3: Commit**

```bash
git add packages/ai-core/
git commit -m "Add ai-core architecture dependency-boundary test

Refs #31"
```

---

## Task 9: Application config port + default kind:none profile

**Files:**
- Create: `packages/application/src/ai-provider-config.ts`
- Test: `packages/application/src/ai-provider-config.test.ts`
- Modify: `packages/application/src/index.ts`, `packages/application/package.json`

**Interfaces:**
- Consumes: `AIProviderProfile` type + `validateAiProvider` from `@financial-intelligence/schemas`.
- Produces:
  - `interface AiProviderConfigRepository { findActive(): Promise<AIProviderProfile | undefined>; save(profile: AIProviderProfile): Promise<void> }`
  - `interface AiProviderConfigDeps { readonly repository: AiProviderConfigRepository; readonly newId: () => string; readonly now: () => string }`
  - `class GetAiProviderConfig { constructor(deps); execute(): Promise<AIProviderProfile> }` — returns stored active profile, or seeds+persists a default `kind:none` profile on first call.
  - `class SetAiProviderProfile { constructor(deps); execute(profile: AIProviderProfile): Promise<void> }` — validates via `validateAiProvider`, throws `AiProviderConfigValidationError` on failure, else saves.
  - `function createDefaultNoAiProfile(id: string, now: string): AIProviderProfile`
  - `class AiProviderConfigValidationError extends Error`

- [ ] **Step 1: Add the schemas dependency**

In `packages/application/package.json`, add to `dependencies` (alphabetical):

```json
    "@financial-intelligence/domain": "workspace:*",
    "@financial-intelligence/schemas": "workspace:*"
```

Run: `nvm use 24 && pnpm install`
Expected: lockfile updates.

- [ ] **Step 2: Write the failing test**

Create `packages/application/src/ai-provider-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AIProviderProfile } from "@financial-intelligence/schemas";
import {
  AiProviderConfigValidationError,
  GetAiProviderConfig,
  SetAiProviderProfile,
  type AiProviderConfigRepository,
} from "./ai-provider-config";

class MemoryRepo implements AiProviderConfigRepository {
  public stored: AIProviderProfile | undefined;
  public findActive() { return Promise.resolve(this.stored); }
  public save(p: AIProviderProfile) { this.stored = p; return Promise.resolve(); }
}

const deps = (repo: MemoryRepo) => ({
  repository: repo,
  newId: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda801",
  now: () => "2026-07-21T00:00:00.000Z",
});

describe("GetAiProviderConfig", () => {
  it("seeds and persists a kind:none default on first read", async () => {
    const repo = new MemoryRepo();
    const profile = await new GetAiProviderConfig(deps(repo)).execute();
    expect(profile.kind).toBe("none");
    expect(profile.enabled).toBe(false);
    expect(profile.tasks).toEqual([]);
    expect(repo.stored).toEqual(profile);
  });

  it("returns the stored profile when one exists", async () => {
    const repo = new MemoryRepo();
    await new GetAiProviderConfig(deps(repo)).execute();
    const first = repo.stored;
    const again = await new GetAiProviderConfig(deps(repo)).execute();
    expect(again).toEqual(first);
  });
});

describe("SetAiProviderProfile", () => {
  it("rejects an invalid profile without saving", async () => {
    const repo = new MemoryRepo();
    await expect(
      new SetAiProviderProfile(deps(repo)).execute({ kind: "none" } as unknown as AIProviderProfile),
    ).rejects.toBeInstanceOf(AiProviderConfigValidationError);
    expect(repo.stored).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/application/src/ai-provider-config.test.ts`
Expected: FAIL (cannot resolve `./ai-provider-config`).

- [ ] **Step 4: Implement ai-provider-config.ts**

Create `packages/application/src/ai-provider-config.ts`:

```ts
import { validateAiProvider, type AIProviderProfile } from "@financial-intelligence/schemas";

export interface AiProviderConfigRepository {
  findActive(): Promise<AIProviderProfile | undefined>;
  save(profile: AIProviderProfile): Promise<void>;
}

export interface AiProviderConfigDeps {
  readonly repository: AiProviderConfigRepository;
  readonly newId: () => string;
  readonly now: () => string;
}

export class AiProviderConfigValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AiProviderConfigValidationError";
  }
}

export function createDefaultNoAiProfile(id: string, now: string): AIProviderProfile {
  return {
    schemaVersion: "1.0.0",
    id,
    name: "No AI",
    kind: "none",
    enabled: false,
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

export class GetAiProviderConfig {
  public constructor(private readonly deps: AiProviderConfigDeps) {}

  public async execute(): Promise<AIProviderProfile> {
    const existing = await this.deps.repository.findActive();
    if (existing !== undefined) return existing;
    const seeded = createDefaultNoAiProfile(this.deps.newId(), this.deps.now());
    await this.deps.repository.save(seeded);
    return seeded;
  }
}

export class SetAiProviderProfile {
  public constructor(private readonly deps: AiProviderConfigDeps) {}

  public async execute(profile: AIProviderProfile): Promise<void> {
    const result = validateAiProvider(profile);
    if (!result.valid) {
      throw new AiProviderConfigValidationError(
        `Invalid AI provider profile: ${result.errors.map((e) => `${e.instancePath} ${e.message}`).join("; ")}`,
      );
    }
    await this.deps.repository.save(profile);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/application/src/ai-provider-config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Export from index**

In `packages/application/src/index.ts` add:

```ts
export {
  AiProviderConfigValidationError,
  GetAiProviderConfig,
  SetAiProviderProfile,
  createDefaultNoAiProfile,
} from "./ai-provider-config";
export type { AiProviderConfigDeps, AiProviderConfigRepository } from "./ai-provider-config";
```

- [ ] **Step 7: Commit**

```bash
git add packages/application/ pnpm-lock.yaml
git commit -m "Add AI provider config port with kind:none default

Refs #31"
```

---

## Task 10: IndexedDB v10 store + repository adapter

**Files:**
- Modify: `packages/storage-indexeddb/src/migrations.ts`
- Modify: `packages/storage-indexeddb/src/database.ts`
- Modify: `packages/storage-indexeddb/src/index.ts`
- Test: `packages/storage-indexeddb/src/ai-provider-profile.test.ts`
- Modify: `packages/storage-indexeddb/src/compatibility.test.ts`

**Interfaces:**
- Consumes: `AiProviderConfigRepository` + `AIProviderProfile` (Task 9); `FinancialDatabase`, `openFinancialDatabase`, `normalizeStorageError` (existing).
- Produces: v10 migration adding `aiProviderProfiles: AI_PROVIDER_PROFILE_SCHEMA`; `FinancialDatabase.aiProviderProfiles` table; `class IndexedDbAiProviderProfileRepository implements AiProviderConfigRepository`.

- [ ] **Step 1: Add the schema string + v10 migration**

In `packages/storage-indexeddb/src/migrations.ts`, add near the other schema consts (line ~33):

```ts
const AI_PROVIDER_PROFILE_SCHEMA = "&id, kind, enabled, updatedAt";
```

Then append a v10 entry to `DATABASE_MIGRATIONS` (after v9, copying v9's `stores` and adding the new store), and bump the constant:

```ts
  {
    version: 10,
    description: "Add AI provider profile store",
    stores: {
      workspaces: WORKSPACE_SCHEMA,
      migrationJournal: MIGRATION_JOURNAL_SCHEMA,
      accounts: ACCOUNT_SCHEMA,
      imports: IMPORT_SCHEMA,
      transactions: REVIEWABLE_TRANSACTION_SCHEMA,
      transactionFingerprints: TRANSACTION_FINGERPRINT_SCHEMA,
      categories: CATEGORY_SCHEMA,
      transactionOperations: TRANSACTION_OPERATION_SCHEMA,
      duplicateResolutionEvents: DUPLICATE_RESOLUTION_SCHEMA,
      merchants: MERCHANT_SCHEMA,
      classificationRules: CLASSIFICATION_RULE_SCHEMA,
      transferDecisions: TRANSFER_DECISION_SCHEMA,
      recurringDecisions: RECURRING_DECISION_SCHEMA,
      learningOperations: LEARNING_OPERATION_SCHEMA,
      decisionEvents: DECISION_EVENT_SCHEMA,
      aiProviderProfiles: AI_PROVIDER_PROFILE_SCHEMA,
    },
  },
];

export const CURRENT_DATABASE_VERSION = 10;
```

- [ ] **Step 2: Add the table + repository to database.ts**

In `packages/storage-indexeddb/src/database.ts`:
- Add to the `@financial-intelligence/application` type import list: `AiProviderConfigRepository`.
- Add to the `@financial-intelligence/schemas` imports (create the import if none): `type AIProviderProfile`.
- Add a record alias near the others: `type AiProviderProfileRecord = AIProviderProfile;`
- Add the table field to `FinancialDatabase` (after `migrationJournal`): `public aiProviderProfiles!: EntityTable<AiProviderProfileRecord, "id">;`
- Add the repository class (mirror `IndexedDbWorkspaceRepository`):

```ts
export class IndexedDbAiProviderProfileRepository implements AiProviderConfigRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async findActive(): Promise<AIProviderProfile | undefined> {
    try {
      await openFinancialDatabase(this.database);
      return await this.database.aiProviderProfiles.orderBy("updatedAt").last();
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  public async save(profile: AIProviderProfile): Promise<void> {
    try {
      await openFinancialDatabase(this.database);
      await this.database.transaction("rw", this.database.aiProviderProfiles, async () => {
        await this.database.aiProviderProfiles.put(profile);
      });
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}
```

- [ ] **Step 3: Export the repository**

In `packages/storage-indexeddb/src/index.ts`, add `IndexedDbAiProviderProfileRepository` to the existing `database` re-export list.

- [ ] **Step 4: Write the failing test**

Create `packages/storage-indexeddb/src/ai-provider-profile.test.ts`:

```ts
import "fake-indexeddb/auto";
import type { AIProviderProfile } from "@financial-intelligence/schemas";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { FinancialDatabase, IndexedDbAiProviderProfileRepository } from "./database";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((n) => Dexie.delete(n)));
  names.clear();
});
function dbName(): string {
  const name = `ai-${crypto.randomUUID()}`;
  names.add(name);
  return name;
}
function profile(): AIProviderProfile {
  return {
    schemaVersion: "1.0.0",
    id: crypto.randomUUID(),
    name: "No AI",
    kind: "none",
    enabled: false,
    tasks: [],
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

describe("IndexedDbAiProviderProfileRepository", () => {
  it("saves and reads back the active profile", async () => {
    const repo = new IndexedDbAiProviderProfileRepository(new FinancialDatabase(dbName()));
    expect(await repo.findActive()).toBeUndefined();
    const p = profile();
    await repo.save(p);
    expect(await repo.findActive()).toEqual(p);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `nvm use 24 && pnpm vitest run packages/storage-indexeddb/src/ai-provider-profile.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Add the v9→v10 preservation assertion**

In `packages/storage-indexeddb/src/compatibility.test.ts`, add a test mirroring the existing "preserves transactions written at v4" pattern:

```ts
  it("preserves workspaces written at v9 through the ai-provider-store upgrade", async () => {
    const name = databaseName();
    const versionNine = await openFinancialDatabase(
      new FinancialDatabase(name, DATABASE_MIGRATIONS.slice(0, 9)),
    );
    await versionNine.workspaces.put(workspace());
    versionNine.close();

    const upgraded = await openFinancialDatabase(new FinancialDatabase(name));
    expect(upgraded.verno).toBe(CURRENT_DATABASE_VERSION);
    expect(await upgraded.workspaces.toArray()).toEqual([workspace()]);
    expect(await upgraded.aiProviderProfiles.toArray()).toEqual([]);
    upgraded.close();
  });
```

- [ ] **Step 7: Run storage tests to verify they pass**

Run: `nvm use 24 && pnpm vitest run packages/storage-indexeddb`
Expected: PASS (existing matrix now covers 10 versions + new tests).

- [ ] **Step 8: Commit**

```bash
git add packages/storage-indexeddb/
git commit -m "Add v10 aiProviderProfiles store and repository adapter

Refs #31"
```

---

## Task 11: No-network production-build regression (e2e)

**Files:**
- Create: `e2e/ai-no-network.spec.ts`

**Interfaces:**
- Consumes: `installLocalNetworkGuard` from `e2e/network-guard.ts` (existing); the app served by the standard Playwright config.

- [ ] **Step 1: Read the existing guard usage**

Run: `sed -n '1,60p' e2e/network-guard.ts && grep -rl "installLocalNetworkGuard" e2e | head -3`
Expected: shows the exact export signature + an example spec to mirror (imports, `test.beforeEach`, base URL usage).

- [ ] **Step 2: Write the spec**

Create `e2e/ai-no-network.spec.ts` mirroring the closest existing guard spec. Assert that on a cold load + navigating the core surfaces (dashboard, import, ledger) with no provider configured, the network guard records zero requests to any AI/model/API origin. Use the same `test`/`expect` import style and the same `installLocalNetworkGuard(page)` call the sibling spec uses. Assert the guard's recorded external-request list is empty after exercising the default path.

```ts
import { expect, test } from "@playwright/test";
import { installLocalNetworkGuard } from "./network-guard";

test.describe("rules-only mode issues no AI network traffic", () => {
  test("cold load and core navigation make zero external requests", async ({ page }) => {
    const guard = await installLocalNetworkGuard(page);
    await page.goto("/");
    await page.getByRole("link", { name: /ledger/i }).click().catch(() => undefined);
    await page.waitForLoadState("networkidle");
    expect(guard.externalRequests, guard.externalRequests.join("\n")).toEqual([]);
  });
});
```

Note: adjust `guard.externalRequests` to the guard's actual recorded-requests accessor discovered in Step 1. If the guard throws on external request instead of recording, drop the final assertion (the guard itself is the assertion).

- [ ] **Step 3: Run the spec (Chromium)**

Run: `nvm use 24 && pnpm exec playwright test e2e/ai-no-network.spec.ts --project=chromium`
Expected: PASS. If a selector doesn't exist, use the real nav labels from a sibling spec.

- [ ] **Step 4: Commit**

```bash
git add e2e/ai-no-network.spec.ts
git commit -m "Add no-network regression for rules-only default path

Refs #31"
```

---

## Task 12: Documentation + ADR-018

**Files:**
- Create: `docs/adr/ADR-018-Provider-Neutral-AI-Core.md`
- Modify: `docs/adr/README.md`, `docs/08-AI-ARCHITECTURE.md`, `docs/12-SECURITY-AND-PRIVACY.md`, `docs/09-DATA-MODEL.md`, `docs/07-SYSTEM-ARCHITECTURE.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`

- [ ] **Step 1: Write ADR-018**

Create `docs/adr/ADR-018-Provider-Neutral-AI-Core.md` using the template from `docs/adr/README.md` (Status: Accepted, Date: 2026-07-21). Sections:
- **Context:** Phase 4 needs an AI boundary that is optional, typed, cancellable, and non-authoritative; #31 builds contracts before any provider runtime.
- **Decision:** dependency-free `ai-core` above domain/below adapters; single `ai-task.schema.json` contract family (A1); providers return `AiSuggestion` + `AiExecutionAudit` only, no mutation capability; `kind:none` default + zero-network default path; profiles store keyed by id (B1); router selects the one configured profile with no silent execution-location switch; one-shot repair policy; audit stores redacted digests, never bodies.
- **Consequences:** #33–#35 implement adapters against a stable contract; workspace-current ID checks live in the router; a new task version appends a schema `$def` + discriminator arm; a new persisted profile shape requires a schema major + migration.
- **Alternatives considered:** per-task schema files (A2/A3) — rejected for drift/churn; single-row settings store (B2) — rejected because #35 needs multiple named profiles; providers with repository access — rejected as it breaks structural non-authority.
- **Validation:** contract matrix, no-network e2e, dependency-boundary test, v9→v10 migration test.
- **Related decisions:** ADR-003 (WebGPU optional), ADR-010 (CSP-safe generated validators), ADR-014 (cache namespaces incl. model cache).

- [ ] **Step 2: Add the ADR index entry**

In `docs/adr/README.md` add under the index:

```markdown
- [ADR-018: Provider-neutral AI core, task contracts, and no-AI default](ADR-018-Provider-Neutral-AI-Core.md)
```

- [ ] **Step 3: Update the numbered specs**

- `docs/08-AI-ARCHITECTURE.md`: note the concrete `ai-task.schema.json` contract, the router validation surface, and the one-repair policy landing in code (#31).
- `docs/12-SECURITY-AND-PRIVACY.md`: audit records store redacted digests only; no prompt/response bodies by default; default path issues zero AI network traffic.
- `docs/09-DATA-MODEL.md` + `docs/07-SYSTEM-ARCHITECTURE.md`: document the v10 `aiProviderProfiles` store (keyed by id, holds the default `kind:none` profile).

- [ ] **Step 4: Update changelog + roadmap**

- `CHANGELOG.md` under `Unreleased`: "Add provider-neutral AI core (task schemas, router, no-AI default, provider config store) — rules-only behavior unchanged; no network traffic added."
- `docs/15-ROADMAP.md`: mark #31 done under Phase 4 and note #32–#35 unblocked.

- [ ] **Step 5: Commit**

```bash
git add docs/ CHANGELOG.md
git commit -m "Document provider-neutral AI core and add ADR-018

Refs #31"
```

---

## Task 13: Full gate + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Run the full local gate**

Run (Node 24):

```bash
nvm use 24 && pnpm install --frozen-lockfile && \
pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && \
pnpm typecheck && pnpm test:coverage && pnpm build && \
pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high
```

Expected: all green. Run `pnpm format` then re-check if `format:check` fails. Fix root causes (never weaken a gate).

- [ ] **Step 2: Run the browser suite for the e2e addition**

Run: `nvm use 24 && pnpm browser:test:chromium`
Expected: the new no-network spec passes. (Storage change → also run full `pnpm browser:test` across Chromium/Firefox/WebKit before merge.)

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin hk/ai-core-31
gh pr create --title "Provider-neutral AI core, no-AI adapter, and task schemas (#31)" --body "..."
```

Complete every section of `.github/pull_request_template.md` (user problem/behavior; scope/design; privacy/security + network impact = none added; data-model/schema/migration = new `ai-task.schema.json` + v10 store; a11y/UI = none, no UI; tests/commands run; limitations/follow-ups: `insight.word.v1` runtime, provider adapters #33–#35, Settings UI). Link with `Closes #31`. Include the documentation impact audit.

- [ ] **Step 4: Watch CI**

Run: `gh pr checks --watch`
Expected: all required checks green. Fix root causes and push new commits (never force-push, never amend) until green. Then stop — the maintainer merges manually.

---

## Self-Review

**Spec coverage:**
- ai-core dependency-free boundary → Tasks 2, 8. ✅
- Single `ai-task.schema.json` (A1) generated + validators → Task 1. ✅
- Provider/task interfaces, health() payload-incapable, execute() with AbortSignal/deadline → Task 4. ✅
- Error taxonomy (10 codes) → Task 2. ✅
- NoAiProvider always available → unsupported → Task 4. ✅
- Router: single configured profile, no silent location switch, in/out validation, workspace-current IDs, one repair, abstention → Tasks 6, 7. ✅
- Immutable AiSuggestion + AiExecutionAudit, redacted digests, no body storage → Tasks 4, 6. ✅
- Context minimization → Task 3 (`minimizeCategoryClassify` + `TASK_DATA_CLASSES`; other minimizers follow the same shape and are added as their consuming tasks in #36/#37 require — documented as deferred). ✅ (partial-by-design; category path is the exercised one)
- kind:none default persisted, config port (B1) → Tasks 9, 10. ✅
- Fake-provider contract suite; malformed/timeout/cancel/no-AI; property notes → Tasks 5, 6, 7. ✅
- No-network production-build regression → Task 11. ✅
- Docs + ADR-018 → Task 12. ✅
- v10 migration + matrix test → Task 10. ✅

**Placeholder scan:** Task 6 intentionally flags the `executeWith` helper as a placeholder and Task 6 Step 4 fixes it before the run; no unresolved TODOs remain. Task 11 leaves the guard accessor name to be confirmed in Step 1 (real API discovered at execution) — acceptable because the exact export can't be assumed and Step 1 resolves it.

**Type consistency:** `AiProvider.execute(request, options)` signature identical across Tasks 4/5/6/7. `AiExecutionAudit` fields identical in Tasks 4 (def) and 6 (construction). `AiProviderConfigRepository` (Task 9) matched exactly by `IndexedDbAiProviderProfileRepository` (Task 10). `validateAiTask`/`validateAiProvider` names match the schemas index (Task 1 / existing). `CURRENT_DATABASE_VERSION = 10` consistent in Task 10.

**Gaps intentionally deferred (documented in PR):** `insight.word.v1` runtime; `merchant.resolve`/`query.plan` minimizers beyond schema; Settings UI. All are out of scope per the approved spec.
