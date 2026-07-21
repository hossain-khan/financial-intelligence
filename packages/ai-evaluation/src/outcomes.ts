import type { AiTaskId } from "@financial-intelligence/ai-core";

/**
 * A per-case run outcome. `accepted`, `abstained`, `invalidOutput`, `refused`, `timeout`,
 * `cancelled`, and `error` are distinct — never collapsed — so metric denominators are unambiguous.
 */
export type CaseOutcomeKind =
  | "accepted"
  | "abstained"
  | "invalidOutput"
  | "refused"
  | "timeout"
  | "cancelled"
  | "error";

export interface CaseOutcome {
  readonly caseId: string;
  readonly task: AiTaskId;
  readonly kind: CaseOutcomeKind;
  readonly correct: boolean;
  readonly groundingViolation: boolean;
  readonly privacyViolation: boolean;
  readonly latencyMs: number;
  readonly confidence: number | null;
}
