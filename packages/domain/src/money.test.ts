import { describe, expect, it } from "vitest";

import { CurrencyMismatchError, Money } from "./money";

describe("Money", () => {
  it("adds decimal values without binary floating-point errors", () => {
    const result = Money.from("0.1", "CAD").add(Money.from("0.2", "CAD"));

    expect(result.toJSON()).toEqual({ amount: "0.3", currency: "CAD" });
  });

  it("rejects operations across currencies", () => {
    expect(() => Money.from("10", "CAD").add(Money.from("10", "USD"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("normalizes negative zero", () => {
    expect(Money.zero("CAD").negate().toJSON().amount).toBe("0");
  });
});
