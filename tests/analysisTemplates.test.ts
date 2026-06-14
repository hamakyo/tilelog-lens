import { describe, expect, it } from "vitest";
import { buildAnalysisTemplateReports } from "../src/shared/analysisTemplates";
import { makeSnapshot } from "./fixtures";

describe("analysis templates", () => {
  it("returns insufficient data without snapshots", () => {
    expect(buildAnalysisTemplateReports([])[0]).toMatchObject({
      id: "no-data",
      status: "insufficient_data"
    });
  });

  it("builds reports from the latest snapshot", () => {
    const reports = buildAnalysisTemplateReports([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-01-01T00:00:00.000Z",
        fourth_rate: 30,
        win_rate: 20,
        deal_in_rate: 15,
        rank_points: 100,
        rank_points_max: 1000
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-02-01T00:00:00.000Z",
        fourth_rate: 18,
        win_rate: 26,
        deal_in_rate: 10,
        rank_points: 800,
        rank_points_max: 1000
      })
    ]);

    expect(reports.map((report) => report.status)).toEqual(["good", "good", "good"]);
  });
});
