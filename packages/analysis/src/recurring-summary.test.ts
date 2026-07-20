import { describe, expect, it } from "vitest";
import {
  parseDateOnly,
  parseUtcTimestamp,
  type RecurringDecisionRecord,
  type RecurringProposal,
} from "@financial-intelligence/domain";
import { summarizeRecurringSeries } from "./recurring-summary";

describe("recurring-summary analysis", () => {
  it("summarizes proposals and decision buckets accurately", () => {
    const p1: RecurringProposal = {
      id: "netflix:CAD:monthly",
      name: "NETFLIX",
      cadence: "monthly",
      currency: "CAD",
      memberTransactions: [],
      lastSeenDate: parseDateOnly("2026-07-15"),
      nextExpectedDate: parseDateOnly("2026-08-14"),
      amountStats: { min: "16.99", max: "16.99", median: "16.99", isVariable: false },
      confidence: 0.95,
      evidence: [],
    };

    const p2: RecurringProposal = {
      id: "spotify:CAD:monthly",
      name: "SPOTIFY",
      cadence: "monthly",
      currency: "CAD",
      memberTransactions: [],
      lastSeenDate: parseDateOnly("2026-07-10"),
      nextExpectedDate: parseDateOnly("2026-08-09"),
      amountStats: { min: "9.99", max: "9.99", median: "9.99", isVariable: false },
      confidence: 0.95,
      evidence: [],
    };

    const decisions: RecurringDecisionRecord[] = [
      {
        id: "d-1",
        signature: "netflix:CAD:monthly",
        name: "NETFLIX",
        status: "confirmed",
        updatedAt: parseUtcTimestamp("2026-07-20T10:00:00Z"),
      },
    ];

    const result = summarizeRecurringSeries([p1, p2], decisions);
    expect(result.currencies).toHaveLength(1);

    const cad = result.currencies[0]!;
    expect(cad.confirmedCount).toBe(1);
    expect(cad.proposedCount).toBe(1);
    expect(cad.totalConfirmedMonthlySpend).toBe("16.99");
    expect(cad.rows).toHaveLength(2);

    const netflixRow = cad.rows.find((r) => r.id === "netflix:CAD:monthly");
    expect(netflixRow?.status).toBe("confirmed");

    const spotifyRow = cad.rows.find((r) => r.id === "spotify:CAD:monthly");
    expect(spotifyRow?.status).toBe("proposed");
  });
});
