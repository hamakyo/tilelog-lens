import { describe, expect, it } from "vitest";
import { buildAnalysisConclusion } from "../src/shared/analysisConclusion";
import { buildAnalysisAssessment } from "../src/shared/metrics";
import { makeSnapshot } from "./fixtures";

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
          target_value: 12,
          category: "current_alert"
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

  it("does not escalate a low-priority long-term goal", () => {
    expect(
      buildAnalysisConclusion({
        snapshot_count: 5,
        latest_matches_delta: 20,
        improvement_priorities: [
          {
            id: "minor-gap",
            title: "長期目標",
            severity: "low",
            score: 20,
            reason: "わずかな差です。",
            action: "継続して確認します。",
            metric: "attack_defense_gap",
            current_value: 7.5,
            target_value: 8,
            category: "long_term_goal"
          }
        ],
        regression_factors: [],
        focus_recommendations: []
      })
    ).toMatchObject({ status: "good" });
  });

  it("returns risk only when long-term and recent styles are both risky", () => {
    const assessment = buildAnalysisAssessment([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        deal_in_rate: 10,
        riichi_rate: 20,
        call_rate: 30
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 150,
        deal_in_rate: 14,
        riichi_rate: 25,
        call_rate: 36
      })
    ]);

    expect(
      buildAnalysisConclusion({
        snapshot_count: 2,
        latest_matches_delta: 50,
        improvement_priorities: [],
        regression_factors: [],
        focus_recommendations: [],
        assessment
      })
    ).toMatchObject({ status: "risk" });
  });
});
