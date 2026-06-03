import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "../src/worker/lib/csv";

describe("CSV helpers", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('a,b "c"\nd')).toBe('"a,b ""c""\nd"');
  });

  it("mitigates spreadsheet formula injection for user-controlled text", () => {
    expect(escapeCsvCell("=IMPORTXML()", true)).toBe("'=IMPORTXML()");
    expect(escapeCsvCell("-10", true)).toBe("'-10");
  });

  it("builds a header row", () => {
    const csv = buildCsv([{ name: "Alice", note: "hello, world" }], [
      { key: "name", label: "name", userControlled: true },
      { key: "note", label: "note", userControlled: true }
    ]);

    expect(csv).toBe('name,note\nAlice,"hello, world"');
  });
});
