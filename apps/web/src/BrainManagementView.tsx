import type { BrainImportPlan, FinancialBrainDocument } from "@financial-intelligence/domain";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { ApplicationServices } from "./infrastructure";

export function BrainManagementView({
  services,
  onRefresh,
}: {
  readonly services: ApplicationServices;
  readonly onRefresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [rawJson, setRawJson] = useState<string>();
  const [previewDoc, setPreviewDoc] = useState<FinancialBrainDocument>();
  const [importPlan, setImportPlan] = useState<BrainImportPlan>();
  const [conflictResolutions, setConflictResolutions] = useState<
    Map<string, "keep-local" | "accept-incoming">
  >(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExport = async () => {
    try {
      const { fileName, content } = await services.exportFinancialBrainUseCase.execute();
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage(`Exported Financial Brain knowledge to ${fileName}`);
      setError(undefined);
    } catch {
      setError("Failed to export Financial Brain.");
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file === undefined) return;

    try {
      const text = await file.text();
      const { doc, plan } = await services.previewFinancialBrainImportUseCase.execute(text);

      setRawJson(text);
      setPreviewDoc(doc);
      setImportPlan(plan);
      setConflictResolutions(new Map());
      setModalOpen(true);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse Financial Brain file.");
    }
  };

  const handleResolutionChange = (id: string, resolution: "keep-local" | "accept-incoming") => {
    const next = new Map(conflictResolutions);
    next.set(id, resolution);
    setConflictResolutions(next);
  };

  const handleApplyImport = async (e: FormEvent) => {
    e.preventDefault();
    if (rawJson === undefined || importPlan === undefined) return;

    setIsSubmitting(true);
    try {
      const res = await services.applyFinancialBrainImportUseCase.execute({
        rawJson,
        conflictResolutions,
      });

      setModalOpen(false);
      setRawJson(undefined);
      setPreviewDoc(undefined);
      setImportPlan(undefined);
      await onRefresh();
      setMessage(`Successfully imported ${res.appliedCount} Financial Brain item(s).`);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply Financial Brain import.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="import-panel" aria-labelledby="brain-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Learned Knowledge & Portability</p>
          <h2 id="brain-title">Financial Brain</h2>
        </div>
        <span className="storage-chip">Offline & User-Owned</span>
      </div>

      <p className="privacy-copy">
        Financial Brain contains categories, merchant catalog aliases, and deterministic rules. It
        never includes transactions, account numbers, or secret keys.
      </p>

      {message && (
        <p role="status" className="mapping-status" aria-live="polite">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mapping-status"
          style={{ color: "var(--danger)" }}
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      <div className="preview-actions" style={{ marginTop: "1rem" }}>
        <button type="button" onClick={() => void handleExport()}>
          Export Financial Brain (.json)
        </button>

        <label
          className="secondary-button"
          style={{ display: "inline-flex", cursor: "pointer", alignItems: "center" }}
        >
          Import Financial Brain
          <input
            type="file"
            accept=".json,.financial-brain.json"
            onChange={(e) => void handleFileSelect(e)}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {modalOpen && previewDoc && importPlan && (
        <div
          className="import-panel"
          style={{ marginTop: "1.5rem", border: "2px solid var(--forest)" }}
        >
          <h3>Preview Financial Brain Import</h3>
          <p>
            Producer:{" "}
            <strong>
              {previewDoc.producer.application} v{previewDoc.producer.version}
            </strong>
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "1rem 0" }}>
            <span className="storage-chip">
              Additions:{" "}
              {importPlan.additions.categories.length +
                importPlan.additions.merchants.length +
                importPlan.additions.rules.length}
            </span>
            <span className="storage-chip">
              Updates:{" "}
              {importPlan.updates.categories.length +
                importPlan.updates.merchants.length +
                importPlan.updates.rules.length}
            </span>
            <span className="storage-chip">Unchanged: {importPlan.unchangedCount}</span>
            <span
              className="storage-chip"
              style={{ color: importPlan.conflicts.length > 0 ? "var(--danger)" : "inherit" }}
            >
              Conflicts: {importPlan.conflicts.length}
            </span>
          </div>

          {importPlan.conflicts.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h4>Conflict Resolution Required</h4>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {importPlan.conflicts.map((conflict) => (
                  <li
                    key={conflict.id}
                    style={{ padding: "0.5rem", borderBottom: "1px solid var(--line)" }}
                  >
                    <p>
                      <strong>{conflict.kind.toUpperCase()}:</strong> {conflict.reason}
                    </p>
                    <label style={{ marginRight: "1rem" }}>
                      <input
                        type="radio"
                        name={`conflict-${conflict.id}`}
                        checked={conflictResolutions.get(conflict.id) === "keep-local"}
                        onChange={() => handleResolutionChange(conflict.id, "keep-local")}
                      />{" "}
                      Keep Local
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`conflict-${conflict.id}`}
                        checked={conflictResolutions.get(conflict.id) === "accept-incoming"}
                        onChange={() => handleResolutionChange(conflict.id, "accept-incoming")}
                      />{" "}
                      Accept Incoming
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={(e) => void handleApplyImport(e)}>
            <div className="preview-actions">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  importPlan.conflicts.some((c) => conflictResolutions.get(c.id) === undefined)
                }
              >
                Apply Import
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
