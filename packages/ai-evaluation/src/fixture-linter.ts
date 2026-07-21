import { AI_TASK_IDS } from "@financial-intelligence/ai-core";

import type { EvalCase } from "./corpus";

const ALLOWED_KEYS = new Set([
  "id",
  "task",
  "schemaVersion",
  "locale",
  "input",
  "allowedVocabulary",
  "expected",
  "ambiguity",
  "expectedAbstention",
  "privacyAssertions",
  "tags",
]);
const ACCOUNT_LIKE = /\b\d{12,19}\b/u;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
const KEY_LIKE = /\b(?:sk|pk|api|key|secret|token)[-_][A-Za-z0-9]{8,}\b/iu;
const MONEY_LIKE = /^-?\d+\.\d{2}$/u;

export class FixtureLintError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FixtureLintError";
  }
}

/**
 * Validate a corpus case's shape and reject any value shaped like real data (account numbers,
 * emails, API keys, monetary amounts) or any field outside the EvalCase allow-list. Throws
 * `FixtureLintError` on any problem; returns the value typed as `EvalCase` on success.
 */
export function lintCase(raw: unknown): EvalCase {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new FixtureLintError("case must be an object");
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) throw new FixtureLintError(`disallowed field "${key}"`);
  }
  if (typeof record.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.id)) {
    throw new FixtureLintError("id must be a kebab identifier");
  }
  if (!(AI_TASK_IDS as readonly string[]).includes(record.task as string)) {
    throw new FixtureLintError(`unknown task "${String(record.task)}"`);
  }
  if (record.schemaVersion !== "1.0.0") throw new FixtureLintError("schemaVersion must be 1.0.0");
  assertNoSensitiveStrings(record, "$");
  return record as unknown as EvalCase;
}

function assertNoSensitiveStrings(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (ACCOUNT_LIKE.test(value))
      throw new FixtureLintError(`account-number-like value at ${path}`);
    if (EMAIL_LIKE.test(value)) throw new FixtureLintError(`email-like value at ${path}`);
    if (KEY_LIKE.test(value)) throw new FixtureLintError(`key-like value at ${path}`);
    if (MONEY_LIKE.test(value.trim())) throw new FixtureLintError(`money-like value at ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveStrings(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertNoSensitiveStrings(child, `${path}.${key}`);
    }
  }
}
