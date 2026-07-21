// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("uses native button activation without runtime style attributes", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("style");
  });

  it("maps the shared disabled state to native and design-system attributes", () => {
    render(<Button isDisabled>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled", "true");
  });
});
