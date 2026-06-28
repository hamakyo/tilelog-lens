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

    expect(reports.map((report) => report.status)).toEqual(["good", "good", "good", "good"]);
    expect(reports.map((report) => report.id)).toContain("riichi");
  });

  it("flags riichi risk when high riichi combines with low win rate and high deal-in", () => {
    const reports = buildAnalysisTemplateReports([
      makeSnapshot({
        riichi_rate: 27,
        win_rate: 18.5,
        deal_in_rate: 14,
        avg_win_turn: 12.8,
        avg_win_score: 6200
      })
    ]);

    expect(reports.find((report) => report.id === "riichi")).toMatchObject({
      title: "立直分析",
      status: "risk",
      focus: ["立直率", "和了率", "放銃率", "平均和了巡", "平均和了点"]
    });
  });
});
