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
