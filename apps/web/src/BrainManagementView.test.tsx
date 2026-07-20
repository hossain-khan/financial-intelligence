// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrainImportPlan, FinancialBrainDocument } from "@financial-intelligence/domain";

import { BrainManagementView } from "./BrainManagementView";
import type { ApplicationServices } from "./infrastructure";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const documentFixture = {
  producer: { application: "Financial Intelligence", version: "1.2.0" },
} as FinancialBrainDocument;

function planFixture(): BrainImportPlan {
  const empty = { categories: [], merchants: [], rules: [], recurringDecisions: [] };
  return {
    additions: { ...empty, categories: [{}] },
    updates: empty,
    unchangedCount: 2,
    conflicts: [
      {
        id: "category:food",
        kind: "category",
        local: {},
        incoming: {},
        reason: "Both versions changed",
      },
    ],
    semanticDuplicates: [
      {
        localId: "local-food",
        incomingId: "incoming-food",
        kind: "category",
        local: {},
        incoming: {},
        reason: "Names are similar",
      },
    ],
  } as unknown as BrainImportPlan;
}

function servicesFixture(overrides: Record<string, unknown> = {}): ApplicationServices {
  return {
    exportFinancialBrainUseCase: {
      execute: vi.fn(async () => ({ fileName: "brain.json", content: "{}" })),
    },
    previewFinancialBrainImportUseCase: {
      execute: vi.fn(async () => ({
        doc: documentFixture,
        plan: planFixture(),
        sourceRevision: "revision-1",
        inputDigest: "digest-1",
      })),
    },
    applyFinancialBrainImportUseCase: {
      execute: vi.fn(async () => ({ operationId: "operation-1", appliedCount: 3 })),
    },
    undoLearningOperationUseCase: { execute: vi.fn(async () => undefined) },
    ...overrides,
  } as unknown as ApplicationServices;
}

function selectFile(container: HTMLElement, file: { size: number; text: () => Promise<string> }) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { files: [file] } });
}

describe("BrainManagementView", () => {
  it("previews, resolves, applies, and undoes a Financial Brain import", async () => {
    const services = servicesFixture();
    const onRefresh = vi.fn(async () => undefined);
    const { container } = render(<BrainManagementView services={services} onRefresh={onRefresh} />);

    selectFile(container, { size: 42, text: vi.fn(async () => '{"brain":true}') });
    expect(await screen.findByText("Preview Financial Brain Import")).toBeInTheDocument();
    expect(screen.getByText(/Names are similar/)).toBeInTheDocument();

    const apply = screen.getByRole("button", { name: "Apply Import" });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByLabelText("Accept Incoming"));
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    expect(
      await screen.findByText("Successfully imported 3 Financial Brain item(s)."),
    ).toBeInTheDocument();
    expect(services.applyFinancialBrainImportUseCase.execute).toHaveBeenCalledWith({
      rawJson: '{"brain":true}',
      conflictResolutions: new Map([["category:food", "accept-incoming"]]),
      sourceRevision: "revision-1",
      inputDigest: "digest-1",
      acknowledgeSemanticDuplicates: true,
    });
    expect(onRefresh).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Undo last Brain import" }));
    await waitFor(() =>
      expect(services.undoLearningOperationUseCase.execute).toHaveBeenCalledWith("operation-1"),
    );
    expect(await screen.findByText(/safely undone/)).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("exports the Financial Brain and reports export errors", async () => {
    const createObjectURL = vi.fn(() => "blob:brain");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const services = servicesFixture();
    const { rerender } = render(<BrainManagementView services={services} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Export Financial Brain/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Exported Financial Brain");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:brain");

    const failing = servicesFixture({
      exportFinancialBrainUseCase: { execute: vi.fn(async () => Promise.reject(new Error("no"))) },
    });
    rerender(<BrainManagementView services={failing} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Export Financial Brain/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to export Financial Brain");
  });

  it("validates selected files and displays preview failures", async () => {
    const services = servicesFixture();
    const { container, rerender } = render(
      <BrainManagementView services={services} onRefresh={vi.fn()} />,
    );

    selectFile(container, { size: 0, text: vi.fn() });
    expect(await screen.findByRole("alert")).toHaveTextContent("must be between 1 byte");

    const failing = servicesFixture({
      previewFinancialBrainImportUseCase: {
        execute: vi.fn(async () => Promise.reject(new Error("Invalid schema"))),
      },
    });
    rerender(<BrainManagementView services={failing} onRefresh={vi.fn()} />);
    selectFile(container, { size: 4, text: vi.fn(async () => "nope") });
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid schema");
  });

  it("allows cancellation and surfaces apply and undo failures", async () => {
    const services = servicesFixture({
      applyFinancialBrainImportUseCase: {
        execute: vi
          .fn()
          .mockRejectedValueOnce(new Error("Revision changed"))
          .mockResolvedValueOnce({ operationId: "operation-2", appliedCount: 1 }),
      },
      undoLearningOperationUseCase: {
        execute: vi.fn(async () => Promise.reject(new Error("Data changed afterward"))),
      },
    });
    const { container } = render(
      <BrainManagementView services={services} onRefresh={vi.fn(async () => undefined)} />,
    );
    selectFile(container, { size: 4, text: vi.fn(async () => "data") });
    await screen.findByText("Preview Financial Brain Import");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByLabelText("Keep Local"));
    fireEvent.click(screen.getByRole("button", { name: "Apply Import" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Revision changed");

    fireEvent.click(screen.getByRole("button", { name: "Apply Import" }));
    await screen.findByText(/Successfully imported 1/);
    fireEvent.click(screen.getByRole("button", { name: "Undo last Brain import" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Data changed afterward");

    selectFile(container, { size: 4, text: vi.fn(async () => "data") });
    await screen.findByText("Preview Financial Brain Import");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Preview Financial Brain Import")).not.toBeInTheDocument();
  });

  it("uses safe fallback messages for non-Error failures", async () => {
    const emptyPlan: BrainImportPlan = {
      additions: { categories: [], merchants: [], rules: [], recurringDecisions: [] },
      updates: { categories: [], merchants: [], rules: [], recurringDecisions: [] },
      unchangedCount: 0,
      conflicts: [],
      semanticDuplicates: [],
    };
    const services = servicesFixture({
      previewFinancialBrainImportUseCase: {
        execute: vi.fn().mockRejectedValueOnce("untyped preview failure").mockResolvedValueOnce({
          doc: documentFixture,
          plan: emptyPlan,
          sourceRevision: "revision-1",
          inputDigest: "digest-1",
        }),
      },
      applyFinancialBrainImportUseCase: {
        execute: vi.fn(async () => Promise.reject("untyped apply failure")),
      },
    });
    const { container } = render(<BrainManagementView services={services} onRefresh={vi.fn()} />);
    selectFile(container, { size: 4, text: vi.fn(async () => "data") });
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to parse Financial Brain");

    selectFile(container, { size: 4, text: vi.fn(async () => "data") });
    await screen.findByText("Preview Financial Brain Import");
    fireEvent.click(screen.getByRole("button", { name: "Apply Import" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to apply Financial Brain import",
    );
  });
});
