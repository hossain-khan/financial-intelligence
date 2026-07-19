import { describe, expect, it } from "vitest";

import { parseDateOnly, parseUtcTimestamp } from "./temporal";

describe("DateOnly", () => {
  it.each(["2024-02-29", "2026-07-19", "2000-02-29"])("round-trips %s", (value) => {
    expect(parseDateOnly(value)).toBe(value);
  });

  it.each(["", "2026-7-19", "2023-02-29", "1900-02-29", "2026-04-31", "0000-01-01"])(
    "rejects %j",
    (value) => {
      expect(() => parseDateOnly(value)).toThrow(TypeError);
    },
  );
});

describe("UtcTimestamp", () => {
  it.each(["2026-07-19T16:00:00Z", "2026-07-19T16:00:00.000Z", "2026-07-19T16:00:00.123456789Z"])(
    "round-trips %s without precision loss",
    (value) => {
      expect(parseUtcTimestamp(value)).toBe(value);
    },
  );

  it.each([
    "2026-07-19",
    "2026-02-29T16:00:00Z",
    "2026-07-19T24:00:00Z",
    "2026-07-19T16:60:00Z",
    "2026-07-19T16:00:60Z",
    "2026-07-19T16:00:00+00:00",
    "2026-07-19T12:00:00-04:00",
    "2026-07-19t16:00:00z",
  ])("rejects non-canonical or impossible timestamp %j", (value) => {
    expect(() => parseUtcTimestamp(value)).toThrow(TypeError);
  });
});
