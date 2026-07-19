import { describe, expect, it } from "vitest";

import { parseWorkspaceId } from "./identifiers";
import { parseUtcTimestamp } from "./temporal";
import { createWorkspace } from "./workspace";

const WORKSPACE_ID = parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1");
const NOW = parseUtcTimestamp("2026-07-19T16:00:00.000Z");

describe("createWorkspace", () => {
  it("normalizes the name and establishes the first revision", () => {
    const workspace = createWorkspace({
      id: WORKSPACE_ID,
      name: "  Household  ",
      now: NOW,
    });

    expect(workspace).toMatchObject({ name: "Household", revision: 1, schemaVersion: 1 });
  });

  it("rejects an empty name", () => {
    expect(() =>
      createWorkspace({
        id: WORKSPACE_ID,
        name: "   ",
        now: NOW,
      }),
    ).toThrow(RangeError);
  });
});
