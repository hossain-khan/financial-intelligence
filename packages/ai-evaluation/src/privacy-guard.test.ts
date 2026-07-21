import { describe, expect, it } from "vitest";

import { ArtifactPrivacyError, assertNoSensitiveContent } from "./privacy-guard";

describe("assertNoSensitiveContent", () => {
  it("accepts an identifier/number-only artifact", () => {
    expect(() =>
      assertNoSensitiveContent({ metrics: { accuracy: 1 }, profile: { model: "fake-model" } }),
    ).not.toThrow();
  });

  it("rejects a money-like value", () => {
    expect(() => assertNoSensitiveContent({ metrics: { note: "-12.34" } })).toThrow(
      ArtifactPrivacyError,
    );
  });

  it("rejects a free-text description", () => {
    expect(() => assertNoSensitiveContent({ metrics: { note: "coffee shop downtown cafe" } })).toThrow(
      ArtifactPrivacyError,
    );
  });

  it("rejects a disallowed key", () => {
    expect(() => assertNoSensitiveContent({ rawPrompt: "x" })).toThrow(ArtifactPrivacyError);
  });
});
