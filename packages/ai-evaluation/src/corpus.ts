import type { AiTaskId } from "@financial-intelligence/ai-core";

export interface EvalCase {
  readonly id: string;
  readonly task: AiTaskId;
  readonly schemaVersion: "1.0.0";
  readonly locale: string;
  readonly input: unknown;
  readonly allowedVocabulary: readonly string[];
  readonly expected:
    | { readonly kind: "exact"; readonly value: string }
    | { readonly kind: "acceptableSet"; readonly values: readonly string[] }
    | { readonly kind: "abstain" };
  readonly ambiguity: "clear" | "ambiguous" | "adversarial";
  readonly expectedAbstention: boolean;
  readonly privacyAssertions: { readonly mustNotEcho: readonly string[] };
  readonly tags: readonly string[];
}

export class CorpusDigestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CorpusDigestError";
  }
}

/**
 * Assert the committed corpus matches its digest lock exactly: same case-id set, and every case
 * hashes to its locked digest. Any drift or unlisted/missing case fails, so the corpus cannot
 * change silently.
 */
export async function assertCorpusDigests(
  cases: ReadonlyMap<string, EvalCase>,
  lock: Record<string, string>,
  digestOf: (value: EvalCase) => Promise<string>,
): Promise<void> {
  const lockKeys = Object.keys(lock).sort();
  const caseKeys = [...cases.keys()].sort();
  if (lockKeys.length !== caseKeys.length || lockKeys.some((key, index) => key !== caseKeys[index])) {
    throw new CorpusDigestError("corpus case set does not match the digest lock");
  }
  for (const [id, evalCase] of cases) {
    const expected = lock[id];
    const actual = await digestOf(evalCase);
    if (expected !== actual) {
      throw new CorpusDigestError(`digest drift for case "${id}"`);
    }
  }
}
