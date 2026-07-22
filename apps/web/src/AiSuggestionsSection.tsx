import type { Transaction } from "@financial-intelligence/domain";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiSuggestionsController, type AcceptScope, type SuggestionView } from "./ai-suggestions";
import { Button } from "./Button";
import type { ApplicationServices } from "./infrastructure";

/** The ledger query caps a page at 1000 rows, so read the whole ledger in bounded pages. */
async function listAllLedgerTransactions(
  services: ApplicationServices,
): Promise<readonly Transaction[]> {
  const pageSize = 1000;
  const all: Transaction[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await services.queryTransactionLedger.execute({ limit: pageSize, offset });
    all.push(...page.items);
    if (all.length >= page.total || page.items.length === 0) break;
  }
  return all;
}

export interface AiSuggestionsSectionProps {
  readonly services: ApplicationServices;
  /** Refresh the ledger/queue after an accepted suggestion changes canonical data. */
  readonly onApplied?: () => Promise<void> | void;
  /**
   * Injectable controller for tests (fake provider, fake ready-probe). Production omits it and the
   * section builds one from `services` backed by the real on-device provider.
   */
  readonly controller?: AiSuggestionsController;
}

type Phase = "checking" | "unsupported" | "idle" | "running" | "error";

function confidenceLabel(confidence: number | null): string {
  if (confidence === null) return "confidence not reported";
  return `${Math.round(confidence * 100)}% confidence`;
}

/**
 * Optional AI-assisted review. An explicit "Suggest" action runs the on-device model over eligible
 * transactions and lists proposals for the user to accept or reject — nothing is ever applied
 * automatically, and the app stays fully usable (deterministic rules) when no model is available.
 */
export function AiSuggestionsSection({
  services,
  onApplied,
  controller,
}: AiSuggestionsSectionProps) {
  const controllerRef = useRef<AiSuggestionsController>(
    controller ??
      new AiSuggestionsController({
        repository: services.aiSuggestionRepository,
        acceptSuggestion: services.acceptSuggestion,
        rejectSuggestion: services.rejectSuggestion,
        listTransactions: () => listAllLedgerTransactions(services),
        listCategories: () => services.listCategories.execute(),
        listRules: () => services.listRules.execute(),
        listMerchants: () => services.listMerchants.execute(),
      }),
  );

  const [phase, setPhase] = useState<Phase>("checking");
  const [suggestions, setSuggestions] = useState<readonly SuggestionView[]>([]);
  const [status, setStatus] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const refreshPending = useCallback(async () => {
    const pending = await controllerRef.current.listPending();
    setSuggestions(pending);
  }, []);

  useEffect(() => {
    let active = true;
    void controllerRef.current
      .isReady()
      .then(async (ready) => {
        if (!active) return;
        if (!ready) {
          setPhase("unsupported");
          return;
        }
        await refreshPending();
        if (active) setPhase("idle");
      })
      .catch(() => {
        if (active) setPhase("unsupported");
      });
    return () => {
      active = false;
    };
  }, [refreshPending]);

  const onSuggest = async () => {
    setPhase("running");
    setStatus("Analyzing transactions on your device…");
    try {
      const outcome = await controllerRef.current.suggest();
      await refreshPending();
      setPhase("idle");
      setStatus(
        outcome.created > 0
          ? `Found ${outcome.created} suggestion(s) to review.`
          : "No new suggestions — everything eligible is already resolved or below the confidence floor.",
      );
    } catch {
      setPhase("error");
      setStatus(
        "The model could not finish. Your data was not changed; rules-only remains available.",
      );
    }
  };

  const onAccept = async (view: SuggestionView, scope: AcceptScope) => {
    setBusyId(view.id);
    try {
      await controllerRef.current.accept(view, scope);
      setSuggestions((current) => current.filter((s) => s.id !== view.id));
      setStatus(
        scope === "similar"
          ? `Applied “${view.proposedLabel}” and created a rule so similar transactions classify automatically.`
          : `Applied “${view.proposedLabel}”. It is recorded as an AI-assisted classification you can change.`,
      );
      await onApplied?.();
    } catch {
      setStatus("That suggestion is stale (the transaction changed). It was not applied.");
      await refreshPending();
    } finally {
      setBusyId(undefined);
    }
  };

  const onReject = async (view: SuggestionView) => {
    setBusyId(view.id);
    try {
      await controllerRef.current.reject(view.id);
      setSuggestions((current) => current.filter((s) => s.id !== view.id));
      setStatus("Dismissed. It won't be suggested again for this model version.");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="ai-suggestions-panel" aria-labelledby="ai-suggestions-heading">
      <div aria-live="polite" className="visually-hidden">
        {status}
      </div>

      <h3 id="ai-suggestions-heading">AI-assisted suggestions (optional)</h3>
      <p>
        Runs the optional on-device model to propose a merchant or category for unresolved
        transactions. Every proposal is reviewed here — nothing is applied automatically, and your
        deterministic rules always take precedence.
      </p>

      {phase === "checking" && <p role="status">Checking for a local model…</p>}

      {phase === "unsupported" && (
        <p className="field-help">
          No local model is ready. Download one from Settings to enable suggestions — the app
          remains fully usable with deterministic rules.
        </p>
      )}

      {phase !== "checking" && phase !== "unsupported" && (
        <>
          <div className="ai-suggestions-actions">
            <Button
              className="ai-suggestions-run"
              isDisabled={phase === "running"}
              onClick={() => void onSuggest()}
            >
              {phase === "running" ? "Analyzing…" : "Suggest categories & merchants"}
            </Button>
          </div>

          {status !== undefined && (
            <p role="status" className="ai-suggestions-status">
              {status}
            </p>
          )}

          {suggestions.length === 0 ? (
            phase !== "running" && (
              <p className="field-help">
                No suggestions to review. Click “Suggest” to analyze your unresolved transactions.
              </p>
            )
          ) : (
            <ul className="ai-suggestions-list">
              {suggestions.map((view) => {
                const isBusy = busyId === view.id;
                return (
                  <li key={view.id} className="ai-suggestion-row">
                    <div className="ai-suggestion-detail">
                      <p className="ai-suggestion-proposal">
                        <span className={`ai-suggestion-kind kind-${view.kind}`}>
                          {view.kind === "category" ? "Category" : "Merchant"}
                        </span>
                        <strong>{view.proposedLabel}</strong>
                      </p>
                      <p className="field-help">
                        {confidenceLabel(view.confidence)} · {view.provenance}
                      </p>
                      {view.rationale !== "" && (
                        <p className="ai-suggestion-rationale">{view.rationale}</p>
                      )}
                      {view.evidenceCodes.length > 0 && (
                        <ul className="ai-suggestion-evidence" aria-label="Evidence">
                          {view.evidenceCodes.map((code) => (
                            <li key={code}>{code}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="ai-suggestion-controls">
                      <Button
                        className="ai-suggestions-run"
                        isDisabled={isBusy || view.kind === "merchant"}
                        onClick={() => void onAccept(view, "this-only")}
                        aria-label={`Accept suggestion for this transaction: ${view.proposedLabel}`}
                      >
                        Accept
                      </Button>
                      {view.kind === "category" && (
                        <Button
                          className="secondary-button"
                          isDisabled={isBusy}
                          onClick={() => void onAccept(view, "similar")}
                          aria-label={`Accept and create a rule for similar transactions: ${view.proposedLabel}`}
                        >
                          Accept for similar
                        </Button>
                      )}
                      <Button
                        className="secondary-button"
                        isDisabled={isBusy}
                        onClick={() => void onReject(view)}
                        aria-label={`Reject suggestion: ${view.proposedLabel}`}
                      >
                        Reject
                      </Button>
                      {view.kind === "merchant" && (
                        <span className="field-help">
                          Merchant matching is applied from the review queue.
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
