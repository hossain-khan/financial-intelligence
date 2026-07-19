import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import aiProviderSchema from "../../../schemas/ai-provider.schema.json";
import categorySchema from "../../../schemas/category.schema.json";
import dashboardSchema from "../../../schemas/dashboard.schema.json";
import financialBrainSchema from "../../../schemas/financial-brain.schema.json";
import importSchema from "../../../schemas/import.schema.json";
import merchantSchema from "../../../schemas/merchant.schema.json";
import transactionSchema from "../../../schemas/transaction.schema.json";

export type { AIProviderProfile } from "./generated/ai-provider";
export type { Category } from "./generated/category";
export type { Dashboard } from "./generated/dashboard";
export type { FinancialBrain } from "./generated/financial-brain";
export type { StatementImport } from "./generated/import";
export type { Merchant } from "./generated/merchant";
export type { CanonicalTransaction } from "./generated/transaction";

export interface ValidationFailure {
  readonly instancePath: string;
  readonly keyword: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly valid: true; readonly errors: readonly [] }
  | { readonly valid: false; readonly errors: readonly ValidationFailure[] };

const ajv = new Ajv2020({
  allowUnionTypes: true,
  allErrors: true,
  strict: true,
  strictRequired: false,
});

addFormats(ajv);

for (const schema of [
  aiProviderSchema,
  categorySchema,
  dashboardSchema,
  financialBrainSchema,
  importSchema,
  merchantSchema,
  transactionSchema,
]) {
  ajv.addSchema(schema);
}

export const validateAiProvider = createValidator(aiProviderSchema.$id);
export const validateCategory = createValidator(categorySchema.$id);
export const validateDashboard = createValidator(dashboardSchema.$id);
export const validateFinancialBrain = createValidator(financialBrainSchema.$id);
export const validateImport = createValidator(importSchema.$id);
export const validateTransaction = createValidator(transactionSchema.$id);

function createValidator(schemaId: string): (value: unknown) => ValidationResult {
  const validate = ajv.getSchema(schemaId);

  if (validate === undefined) {
    throw new Error(`Schema was not registered: ${schemaId}`);
  }

  return (value: unknown): ValidationResult => toResult(validate, value);
}

function toResult(validate: ValidateFunction, value: unknown): ValidationResult {
  if (validate(value)) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: (validate.errors ?? []).map(toFailure),
  };
}

function toFailure(error: ErrorObject): ValidationFailure {
  return {
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? "Schema validation failed",
  };
}
