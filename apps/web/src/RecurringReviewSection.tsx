import React, { useState } from "react";
import type { RecurringProposal } from "@financial-intelligence/domain";

export interface RecurringReviewSectionProps {
  readonly proposals: readonly RecurringProposal[];
  readonly onConfirm: (proposal: RecurringProposal) => Promise<void>;
  readonly onDismiss: (proposal: RecurringProposal) => Promise<void>;
  readonly onMute: (proposal: RecurringProposal) => Promise<void>;
}

export const RecurringReviewSection: React.FC<RecurringReviewSectionProps> = ({
  proposals,
  onConfirm,
  onDismiss,
  onMute,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (proposals.length === 0) {
    return null;
  }

  const handleConfirm = async (proposal: RecurringProposal) => {
    setBusyId(proposal.id);
    try {
      await onConfirm(proposal);
      setStatusMessage(`Recurring series '${proposal.name}' confirmed.`);
    } catch (err) {
      setStatusMessage(`Failed to confirm series: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (proposal: RecurringProposal) => {
    setBusyId(proposal.id);
    try {
      await onDismiss(proposal);
      setStatusMessage(`Recurring proposal '${proposal.name}' dismissed.`);
    } catch (err) {
      setStatusMessage(`Failed to dismiss proposal: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleMute = async (proposal: RecurringProposal) => {
    setBusyId(proposal.id);
    try {
      await onMute(proposal);
      setStatusMessage(`Recurring proposal '${proposal.name}' muted.`);
    } catch (err) {
      setStatusMessage(`Failed to mute proposal: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-labelledby="recurring-proposals-heading"
      className="card mb-6 border-l-4 border-l-cyan-500 p-4"
    >
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <div>
          <h2
            id="recurring-proposals-heading"
            className="text-lg font-semibold text-white flex items-center gap-2"
          >
            <span>↺ Recurring Payments</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {proposals.length} Detected
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Identify recurring subscriptions and scheduled payments across statement imports.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {proposals.map((proposal) => {
          const isBusy = busyId === proposal.id;
          const { min, max, median, isVariable } = proposal.amountStats;
          const displayAmount = isVariable
            ? `${proposal.currency} ${min} – ${max}`
            : `${proposal.currency} ${median}`;

          return (
            <div
              key={proposal.id}
              className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-white">{proposal.name}</span>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-cyan-500/20 text-cyan-300 capitalize border border-cyan-500/30">
                      {proposal.cadence}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-slate-800 text-slate-300">
                      {proposal.memberTransactions.length} occurrences
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-cyan-400">
                    {displayAmount}{" "}
                    <span className="text-xs text-slate-400 font-normal">/ occurrence</span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Last seen: <strong className="text-slate-300">{proposal.lastSeenDate}</strong>
                    </span>
                    <span>
                      Next expected:{" "}
                      <strong className="text-emerald-400">{proposal.nextExpectedDate}</strong>
                    </span>
                  </div>
                </div>

                {/* Evidence & Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConfirm(proposal)}
                      className="px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors disabled:opacity-50"
                      aria-label={`Confirm recurring series for ${proposal.name}`}
                    >
                      {isBusy ? "Saving..." : "Confirm Series"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDismiss(proposal)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors disabled:opacity-50"
                      aria-label={`Dismiss recurring proposal for ${proposal.name}`}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleMute(proposal)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors disabled:opacity-50"
                      aria-label={`Mute recurring proposal for ${proposal.name}`}
                    >
                      Mute
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
