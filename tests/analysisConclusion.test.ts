import { describe, expect, it } from "vitest";
import { buildAnalysisConclusion } from "../src/shared/analysisConclusion";

describe("buildAnalysisConclusion", () => {
  it("asks for another record when comparison data is insufficient", () => {
    expect(
      buildAnalysisConclusion({
        snapshot_count: 1,
        latest_matches_delta: null,
        improvement_priorities: [],
        regression_factors: [],
        focus_recommendations: []
      })
    ).toMatchObject({
      status: "insufficient_data",
      target_tab: "detail"
    });
  });

  it("uses the highest improvement priority as the conclusion", () => {
    const conclusion = buildAnalysisConclusion({
      snapshot_count: 4,
      latest_matches_delta: 12,
      improvement_priorities: [
        {
          id: "deal-in",
          title: "放銃率を優先して確認",
          severity: "high",
          score: 90,
          reason: "放銃率が目安を上回っています。",
          action: "押し引き判断を見直します。",
          metric: "deal_in_rate",
          current_value: 14.5,
          target_value: 12
        }
      ],
      regression_factors: [],
      focus_recommendations: []
    });

    expect(conclusion).toMatchObject({
      status: "risk",
      title: "放銃率を優先して確認",
      target_tab: "improvement"
    });
    expect(conclusion.evidence).toContain("最新区間は12戦です。");
  });

  it("reports a stable state when no warning signal exists", () => {
    expect(
      buildAnalysisConclusion({
        snapshot_count: 5,
        latest_matches_delta: 20,
        improvement_priorities: [],
        regression_factors: [],
        focus_recommendations: []
      })
    ).toMatchObject({ status: "good" });
  });
});
