import { describe, expect, it } from "vitest";

import { parseAccountId, parseWorkspaceId } from "./identifiers";
import { parseUtcTimestamp } from "./temporal";
import { AccountCurrencyLockedError, changeAccountCurrency, createAccount } from "./account";

const now = parseUtcTimestamp("2026-07-19T16:00:00.000Z");

function validInput() {
  return {
    id: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
    workspaceId: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1"),
    name: "Daily spending",
    type: "checking",
    institutionLabel: "Community bank",
    maskedIdentifier: "•••• 1234",
    currency: "CAD",
    now,
  };
}

describe("Account", () => {
  it("normalizes safe display fields and creates an active account", () => {
    expect(createAccount({ ...validInput(), name: "  Daily spending  " })).toMatchObject({
      name: "Daily spending",
      type: "checking",
      currency: "CAD",
      archived: false,
      maskedIdentifier: "•••• 1234",
    });
  });

  it.each([
    ["name", { name: " " }],
    ["type", { type: "wallet" }],
    ["currency", { currency: "cad" }],
    ["currency", { currency: "ZZZ" }],
    ["maskedIdentifier", { maskedIdentifier: "1234/secret" }],
    ["maskedIdentifier", { maskedIdentifier: "123456789" }],
    ["maskedIdentifier", { maskedIdentifier: "•• 123456789" }],
  ])("rejects invalid %s values with a field error", (field, override) => {
    expect(() => createAccount({ ...validInput(), ...override })).toThrow(
      expect.objectContaining({ field }),
    );
  });

  it("keeps currency immutable once transactions reference the account", () => {
    const account = createAccount(validInput());
    expect(() => changeAccountCurrency(account, "USD", true, now)).toThrow(
      AccountCurrencyLockedError,
    );
    expect(changeAccountCurrency(account, "USD", false, now).currency).toBe("USD");
  });
});
