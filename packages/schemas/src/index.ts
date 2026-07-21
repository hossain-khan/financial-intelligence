import {
  validateAiProviderSchema,
  validateAiTaskSchema,
  validateCategorySchema,
  validateDashboardSchema,
  validateFinancialBrainSchema,
  validateImportSchema,
  validateTransactionSchema,
} from "./generated/validators";

export type { AIProviderProfile } from "./generated/ai-provider";
export type { AITask } from "./generated/ai-task";
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

interface CompiledValidationError {
  readonly instancePath: string;
  readonly keyword: string;
  readonly message?: string;
}

interface CompiledValidator {
  (value: unknown): boolean;
  readonly errors?: readonly CompiledValidationError[] | null;
}

export const validateAiProvider = createValidator(validateAiProviderSchema);
export const validateAiTask = createValidator(validateAiTaskSchema);
export const validateCategory = createValidator(validateCategorySchema);
export const validateDashboard = createValidator(validateDashboardSchema);
export const validateFinancialBrain = createValidator(validateFinancialBrainSchema);
export const validateImport = createValidator(validateImportSchema);
export const validateTransaction = createValidator(validateTransactionSchema);

function createValidator(validate: CompiledValidator): (value: unknown) => ValidationResult {
  return (value: unknown): ValidationResult => toResult(validate, value);
}

function toResult(validate: CompiledValidator, value: unknown): ValidationResult {
  if (validate(value)) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: (validate.errors ?? []).map(toFailure),
  };
}

function toFailure(error: CompiledValidationError): ValidationFailure {
  return {
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? "Schema validation failed",
  };
}
