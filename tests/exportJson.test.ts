import { describe, expect, it } from "vitest";
import { buildAiContext } from "../src/shared/aiExport";
import { makeSnapshot } from "./fixtures";

describe("AI JSON export", () => {
  it("anonymizes player identifiers by default", () => {
    const context = buildAiContext([
      makeSnapshot({
        player_name: "Sensitive Name",
        player_id: "sensitive-id"
      })
    ]);

    expect(context.privacy.anonymized).toBe(true);
    expect(context.snapshots[0].player_name).toBeNull();
    expect(context.snapshots[0].player_id).toBeNull();
    expect(context.privacy.screenshots_included).toBe(false);
    expect(context.privacy.source_images_stored).toBe(false);
  });

  it("can include player identifiers when anonymization is disabled", () => {
    const context = buildAiContext(
      [
        makeSnapshot({
          player_name: "Player",
          player_id: "player-id"
        })
      ],
      { anonymize: false, exportedAt: "2026-06-03T00:00:00.000Z" }
    );

    expect(context.privacy.anonymized).toBe(false);
    expect(context.snapshots[0].player_name).toBe("Player");
    expect(context.snapshots[0].player_id).toBe("player-id");
  });

  it("includes analysis helpers for AI review", () => {
    const context = buildAiContext([
      makeSnapshot({
        id: 1,
        game_mode: "east",
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 24,
        deal_in_rate: 10,
        fourth_rate: 20
      }),
      makeSnapshot({
        id: 2,
        game_mode: "east",
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 150,
        win_rate: 18,
        deal_in_rate: 15,
        fourth_rate: 27,
        call_rate: 38,
        avg_place: 2.62
      })
    ]);

    expect(context.period_analyses.length).toBeGreaterThan(0);
    expect(context.analysis_engine).toMatchObject({
      version: "2.0.0",
      profile_id: "mahjong-soul-east-provisional",
      profile_version: "1.0.0",
      profile_status: "provisional"
    });
    expect(context.analysis_assessment?.long_term_style).not.toBeNull();
    expect(context.period_analyses[0]).toMatchObject({
      calculation_method: "difference_of_rounded_cumulative_rates",
      is_estimated: true,
      confidence: expect.any(String)
    });
    expect(context.summary).toMatchObject({
      snapshot_count: 2,
      latest_observed_at_utc: "2026-06-02T00:00:00.000Z",
      latest_game_mode: "east",
      data_quality_issue_count: expect.any(Number)
    });
    expect(context.summary.latest_metrics).toMatchObject({
      matches: 150,
      avg_place: 2.62,
      win_rate: 18,
      deal_in_rate: 15
    });
    expect(context.summary.top_findings.length).toBeGreaterThan(0);
    expect(context.summary.summary_text).toContain("最新記録");
    expect(context.period_comparisons.length).toBeGreaterThan(0);
    expect(context.metric_distributions).toEqual(expect.any(Array));
    expect(context.riichi_trends).toEqual(expect.any(Array));
    expect(context.riichi_risk_signals).toEqual(expect.any(Array));
    expect(context.attack_style).not.toBeUndefined();
    expect(context.analysis_comments.length).toBeGreaterThan(0);
    expect(context.improvement_priorities.length).toBeGreaterThan(0);
    expect(context.regression_factors).toEqual(expect.any(Array));
    expect(context.focus_recommendations).toEqual(expect.any(Array));
    expect(context.stability_score.status).toEqual(expect.any(String));
    expect(context.goal_gap_comments).toEqual(expect.any(Array));
    expect(context.rank_point_analysis).not.toBeUndefined();
    expect(context.data_quality_issues).toEqual(expect.any(Array));
    expect(context.analysis_request.focus).toContain("改善優先度");
    expect(context.analysis_request.focus).toContain("立直トレンド");
    expect(context.analysis_request.focus).toContain("安定性スコア");
    expect(context.analysis_request.focus).toContain("データ品質警告");
  });

  it("allows custom analysis request options", () => {
    const context = buildAiContext([makeSnapshot()], {
      analysisRequest: {
        goal: "ラス回避だけを重点分析してください。",
        focus: ["四位率", "放銃率"]
      }
    });

    expect(context.analysis_request).toEqual({
      language: "ja",
      goal: "ラス回避だけを重点分析してください。",
      focus: ["四位率", "放銃率"]
    });
  });
});
