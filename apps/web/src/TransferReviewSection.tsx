import React, { useState } from "react";
import type { Account, TransferProposal } from "@financial-intelligence/domain";

export interface TransferReviewSectionProps {
  readonly proposals: readonly TransferProposal[];
  readonly accounts: readonly Account[];
  readonly onConfirm: (proposal: TransferProposal) => Promise<void>;
  readonly onReject: (proposal: TransferProposal) => Promise<void>;
}

export const TransferReviewSection: React.FC<TransferReviewSectionProps> = ({
  proposals,
  accounts,
  onConfirm,
  onReject,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const accountNameMap = new Map(accounts.map((a) => [a.id, a.name]));

  if (proposals.length === 0) {
    return null;
  }

  const handleConfirm = async (proposal: TransferProposal) => {
    setBusyId(proposal.id);
    try {
      await onConfirm(proposal);
      setStatusMessage("Transfer pair successfully confirmed and linked.");
    } catch (err) {
      setStatusMessage(`Failed to confirm transfer: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (proposal: TransferProposal) => {
    setBusyId(proposal.id);
    try {
      await onReject(proposal);
      setStatusMessage("Transfer proposal rejected.");
    } catch (err) {
      setStatusMessage(`Failed to reject proposal: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-labelledby="transfer-proposals-heading"
      className="card mb-6 border-l-4 border-l-purple-500 p-4"
    >
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <div>
          <h2
            id="transfer-proposals-heading"
            className="text-lg font-semibold text-white flex items-center gap-2"
          >
            <span>⇄ Transfer Proposals</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {proposals.length} Detected
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review likely transfers between accounts. Confirmed transfers are excluded from income
            and spending totals.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {proposals.map((proposal) => {
          const outflowAccount =
            accountNameMap.get(proposal.outflowTransaction.accountId) ??
            proposal.outflowTransaction.accountId;
          const inflowAccount =
            accountNameMap.get(proposal.inflowTransaction.accountId) ??
            proposal.inflowTransaction.accountId;
          const isBusy = busyId === proposal.id;

          return (
            <div
              key={proposal.id}
              className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  {/* Outflow side */}
                  <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/80">
                    <div className="text-xs font-semibold text-rose-400 mb-1 flex justify-between">
                      <span>Outflow ({outflowAccount})</span>
                      <span>{proposal.outflowTransaction.postedDate}</span>
                    </div>
                    <div
                      className="text-sm font-medium text-slate-200 truncate"
                      title={proposal.outflowTransaction.description}
                    >
                      {proposal.outflowTransaction.description}
                    </div>
                    <div className="text-sm font-semibold text-rose-300 mt-1">
                      {proposal.outflowTransaction.money.toString()}
                    </div>
                  </div>

                  {/* Inflow side */}
                  <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/80">
                    <div className="text-xs font-semibold text-emerald-400 mb-1 flex justify-between">
                      <span>Inflow ({inflowAccount})</span>
                      <span>{proposal.inflowTransaction.postedDate}</span>
                    </div>
                    <div
                      className="text-sm font-medium text-slate-200 truncate"
                      title={proposal.inflowTransaction.description}
                    >
                      {proposal.inflowTransaction.description}
                    </div>
                    <div className="text-sm font-semibold text-emerald-300 mt-1">
                      {proposal.inflowTransaction.money.toString()}
                    </div>
                  </div>
                </div>

                {/* Evidence & Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:border-l lg:border-slate-800 lg:pl-4">
                  <div className="flex flex-wrap gap-1.5 max-w-xs">
                    {proposal.evidence.map((ev, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 text-[11px] rounded font-medium ${
                          ev.code === "ambiguous-candidate-count"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-300"
                        }`}
                        title={ev.detail}
                      >
                        {ev.code}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConfirm(proposal)}
                      className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50"
                      aria-label={`Confirm transfer proposal between ${outflowAccount} and ${inflowAccount}`}
                    >
                      {isBusy ? "Confirming..." : "Confirm Transfer"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleReject(proposal)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors disabled:opacity-50"
                      aria-label={`Reject transfer proposal between ${outflowAccount} and ${inflowAccount}`}
                    >
                      Reject
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
