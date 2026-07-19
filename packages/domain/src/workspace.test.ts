import { describe, expect, it } from "vitest";

import { createWorkspace } from "./workspace";

describe("createWorkspace", () => {
  it("normalizes the name and establishes the first revision", () => {
    const workspace = createWorkspace({
      id: "workspace-1",
      name: "  Household  ",
      now: "2026-07-19T16:00:00.000Z",
    });

    expect(workspace).toMatchObject({ name: "Household", revision: 1, schemaVersion: 1 });
  });

  it("rejects an empty name", () => {
    expect(() =>
      createWorkspace({
        id: "workspace-1",
        name: "   ",
        now: "2026-07-19T16:00:00.000Z",
      }),
    ).toThrow(RangeError);
  });
});
