import { describe, expect, it } from "vitest";

import { classifyFile, parseStatementFiles } from "./statement-import";

describe("classifyFile", () => {
  it("classifies OFX and QFX by extension", () => {
    expect(classifyFile(new File([], "a.ofx"))).toBe("ofx");
    expect(classifyFile(new File([], "a.qfx"))).toBe("ofx");
  });

  it("classifies CSV by extension", () => {
    expect(classifyFile(new File([], "a.csv"))).toBe("csv");
    expect(classifyFile(new File([], "a.tsv"))).toBe("csv");
  });

  it("classifies by media type when extension is ambiguous", () => {
    expect(classifyFile(new File([], "data", { type: "application/vnd.intu.qfx" }))).toBe("ofx");
    expect(classifyFile(new File([], "data", { type: "text/csv" }))).toBe("csv");
  });

  it("returns unknown for unsupported files", () => {
    expect(classifyFile(new File([], "a.pdf"))).toBe("unknown");
  });
});

describe("parseStatementFiles", () => {
  it("rejects unsupported files", async () => {
    await expect(parseStatementFiles([new File([], "a.pdf")])).rejects.toThrow(/not a supported/i);
  });

  it("rejects empty file lists", async () => {
    await expect(parseStatementFiles([])).rejects.toThrow(/Choose at least one/i);
  });

  it("rejects too many files", async () => {
    const files = Array.from({ length: 11 }, (_, index) => new File([], `${index}.csv`));
    await expect(parseStatementFiles(files)).rejects.toThrow(/no more than 10/i);
  });
});
