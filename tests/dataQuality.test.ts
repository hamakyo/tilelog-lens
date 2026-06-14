import { describe, expect, it } from "vitest";
import { summarizeDataQualityIssues } from "../src/shared/dataQuality";
import type { DataQualityIssue } from "../src/shared/types";

describe("data quality summaries", () => {
  it("summarizes issue counts by code", () => {
    const baseIssue = {
      snapshot_id: 1,
      observed_at_utc: "2026-01-01T00:00:00.000Z",
      game_mode: "south",
      message: "warning",
      severity: "warning"
    } satisfies Omit<DataQualityIssue, "code">;

    expect(
      summarizeDataQualityIssues([
        { ...baseIssue, code: "MATCHES_DECREASED" },
        { ...baseIssue, code: "MATCHES_DECREASED" },
        { ...baseIssue, code: "RANK_RATE_SUM_NOT_100" }
      ])
    ).toMatchObject([
      {
        code: "MATCHES_DECREASED",
        count: 2,
        label: "対戦数減少"
      },
      {
        code: "RANK_RATE_SUM_NOT_100",
        count: 1,
        label: "順位率合計"
      }
    ]);
  });
});
