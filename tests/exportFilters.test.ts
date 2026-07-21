import { describe, expect, it } from "vitest";
import { parseExportFilters } from "../src/worker/lib/exportFilters";

describe("export filters", () => {
  it("parses supported export query filters", () => {
    const values: Record<string, string> = {
      game_mode: "south",
      observed_date_from: "2026-01-01",
      observed_date_to: "2026-01-31",
      min_matches: "50",
      max_deal_in_rate: "12.5"
    };

    expect(parseExportFilters((name) => values[name])).toEqual({
      game_mode: "south",
      observed_date_from: "2026-01-01",
      observed_date_to: "2026-01-31",
      min_matches: 50,
      max_deal_in_rate: 12.5
    });
  });

  it("falls back to all for unsupported game modes", () => {
    expect(parseExportFilters((name) => (name === "game_mode" ? "bad" : undefined))).toEqual({
      game_mode: "all",
      observed_date_from: undefined,
      observed_date_to: undefined
    });
  });
});
