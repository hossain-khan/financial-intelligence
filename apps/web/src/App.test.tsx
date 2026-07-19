// @vitest-environment jsdom

import type { Workspace } from "@financial-intelligence/domain";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverviewPage } from "./App";
import type { ApplicationServices } from "./infrastructure";

describe("OverviewPage", () => {
  it("explains the empty local workspace state", async () => {
    const services = {
      listWorkspaces: { execute: async () => [] as readonly Workspace[] },
      createWorkspace: { execute: async () => Promise.reject(new Error("not used")) },
    } as unknown as ApplicationServices;

    render(<OverviewPage services={services} />);

    expect(await screen.findByText("No workspace exists on this device yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeEnabled();
  });
});
