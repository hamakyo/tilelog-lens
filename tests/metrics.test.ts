import { describe, expect, it } from "vitest";
import {
  buildDerivedMetrics,
  buildCustomPeriodComparison,
  buildDataQualityWarnings,
  buildDataQualityReport,
  buildAnalysisComments,
  buildAnalysisAssessment,
  buildAttackStyleClassification,
  buildDuplicateSnapshotCandidates,
  buildEstimatedDeltas,
  buildFocusRecommendations,
  buildImprovementPriorities,
  buildMetricDistributions,
  buildPeriodComparisons,
  buildPeriodAnalyses,
  buildRiichiRiskSignals,
  buildRiichiTrendAnalyses,
  buildRankPointAnalysis,
  buildRecentRegressionFactors,
  buildSnapshotComparison,
  buildStabilityScore
} from "../src/shared/metrics";
import { makeSnapshot } from "./fixtures";

describe("metrics", () => {
  it("builds derived metrics", () => {
    const [derived] = buildDerivedMetrics([
      makeSnapshot({
        win_rate: 26.5,
        deal_in_rate: 11.25,
        first_rate: 30,
        second_rate: 25,
        third_rate: 25,
        fourth_rate: 20
      })
    ]);

    expect(derived.attack_defense_gap).toBe(15.25);
    expect(derived.top_two_rate).toBe(55);
    expect(derived.bottom_two_rate).toBe(45);
    expect(derived.calculated_avg_place).toBe(2.35);
  });

  it("estimates positive, zero, and negative match deltas", () => {
    const deltas = buildEstimatedDeltas([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 25,
        deal_in_rate: 10,
        call_rate: 30,
        riichi_rate: 20
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 120,
        win_rate: 26.67,
        deal_in_rate: 11.67,
        call_rate: 35,
        riichi_rate: 22.5
      }),
      makeSnapshot({
        id: 3,
        observed_at_utc: "2026-06-03T00:00:00.000Z",
        matches: 120
      }),
      makeSnapshot({
        id: 4,
        observed_at_utc: "2026-06-04T00:00:00.000Z",
        matches: 90
      })
    ]);

    expect(deltas[0].quality).toBe("ok");
    expect(deltas[0].matches_delta).toBe(20);
    expect(deltas[0].estimated_win_delta).toBe(7);
    expect(deltas[0].period_win_rate).toBe(35);
    expect(deltas[1].quality).toBe("same_matches");
    expect(deltas[2].quality).toBe("negative_matches");
  });

  it("builds period analyses from cumulative snapshots", () => {
    const periods = buildPeriodAnalyses(
      [
        makeSnapshot({
          id: 1,
          observed_at_utc: "2026-06-01T00:00:00.000Z",
          matches: 100,
          win_rate: 20,
          deal_in_rate: 10,
          call_rate: 30,
          riichi_rate: 20,
          first_rate: 25,
          second_rate: 25,
          third_rate: 25,
          fourth_rate: 25
        }),
        makeSnapshot({
          id: 2,
          observed_at_utc: "2026-06-02T00:00:00.000Z",
          matches: 150,
          win_rate: 22,
          deal_in_rate: 12,
          call_rate: 32,
          riichi_rate: 21,
          first_rate: 26,
          second_rate: 25,
          third_rate: 25,
          fourth_rate: 24
        }),
        makeSnapshot({
          id: 3,
          observed_at_utc: "2026-06-03T00:00:00.000Z",
          matches: 200,
          win_rate: 25,
          deal_in_rate: 11,
          call_rate: 35,
          riichi_rate: 23,
          first_rate: 28,
          second_rate: 26,
          third_rate: 24,
          fourth_rate: 22
        })
      ],
      [50, 100]
    );

    expect(periods[0]).toMatchObject({
      label: "直近50戦",
      actual_matches: 50,
      calculation_method: "difference_of_rounded_cumulative_rates",
      is_estimated: true,
      window_error_rate: 0,
      confidence: "medium",
      sample_strength: "trend",
      period_win_rate: 34,
      period_deal_in_rate: 8,
      period_avg_place: 2.14,
      quality: "ok"
    });
    expect(periods[1]).toMatchObject({
      label: "直近100戦",
      actual_matches: 100,
      confidence: "high",
      sample_strength: "assessment",
      period_win_rate: 30,
      quality: "ok"
    });
  });

  it("selects the closest period baseline and applies window error boundaries", () => {
    const latest = makeSnapshot({
      id: 4,
      observed_at_utc: "2026-06-04T00:00:00.000Z",
      matches: 200
    });
    const periods = buildPeriodAnalyses(
      [
        makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", matches: 130 }),
        makeSnapshot({ id: 2, observed_at_utc: "2026-06-02T00:00:00.000Z", matches: 145 }),
        makeSnapshot({ id: 3, observed_at_utc: "2026-06-03T00:00:00.000Z", matches: 155 }),
        latest
      ],
      [50]
    );

    expect(periods[0]).toMatchObject({
      from_snapshot_id: 3,
      label: "直近50戦",
      actual_matches: 45,
      window_error_rate: 0.1,
      quality: "ok",
      confidence: "medium"
    });

    const approximate = buildPeriodAnalyses(
      [
        makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", matches: 138 }),
        latest
      ],
      [50]
    )[0];
    expect(approximate).toMatchObject({
      label: "直近約50戦（実測62戦）",
      window_error_rate: 0.24,
      quality: "limited_data"
    });

    const unavailable = buildPeriodAnalyses(
      [
        makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", matches: 137 }),
        latest
      ],
      [50]
    )[0];
    expect(unavailable).toMatchObject({
      actual_matches: 63,
      window_error_rate: 0.26,
      quality: "insufficient_data"
    });
    expect(unavailable.period_win_rate).toBeUndefined();
  });

  it("deduplicates shared baselines", () => {
    const periods = buildPeriodAnalyses(
      [
        makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", matches: 140 }),
        makeSnapshot({ id: 3, observed_at_utc: "2026-06-03T00:00:00.000Z", matches: 200 })
      ],
      [50, 100]
    );

    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ from_snapshot_id: 1, target_matches: 50 });
  });

  it("prefers the newest equal-distance baseline", () => {
    const period = buildPeriodAnalyses(
      [
        makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", matches: 140 }),
        makeSnapshot({ id: 2, observed_at_utc: "2026-06-02T00:00:00.000Z", matches: 160 }),
        makeSnapshot({ id: 3, observed_at_utc: "2026-06-03T00:00:00.000Z", matches: 200 })
      ],
      [50]
    )[0];

    expect(period).toMatchObject({ from_snapshot_id: 2, actual_matches: 40 });
  });

  it("uses nullable baseline metadata when no candidate exists", () => {
    expect(buildPeriodAnalyses([makeSnapshot()], [50])[0]).toMatchObject({
      from_snapshot_id: null,
      from_observed_at_utc: null,
      actual_matches: 0,
      quality: "insufficient_data"
    });
  });

  it("builds riichi trend analyses from recent cumulative deltas", () => {
    const trends = buildRiichiTrendAnalyses([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 20,
        deal_in_rate: 10,
        riichi_rate: 20,
        first_rate: 25,
        second_rate: 25,
        third_rate: 25,
        fourth_rate: 25
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 150,
        win_rate: 19.33,
        deal_in_rate: 12,
        riichi_rate: 24,
        first_rate: 25,
        second_rate: 25,
        third_rate: 25,
        fourth_rate: 25
      })
    ]);

    expect(trends[0]).toMatchObject({
      label: "直近50戦",
      actual_matches: 50,
      riichi_rate: 32,
      win_rate: 18,
      deal_in_rate: 16,
      status: "risk"
    });
  });

  it("builds riichi risk signals from combined riichi indicators", () => {
    const signals = buildRiichiRiskSignals([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 20,
        deal_in_rate: 10,
        riichi_rate: 20,
        avg_win_turn: 12.2,
        avg_win_score: 7000
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 150,
        win_rate: 18,
        deal_in_rate: 14,
        riichi_rate: 27,
        avg_win_turn: 12.8,
        avg_win_score: 6200
      })
    ]);

    expect(signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        "high-riichi-low-win",
        "high-riichi-high-deal-in",
        "late-win-turn-low-win",
        "low-score-low-win"
      ])
    );
    expect(signals[0].severity).toBe("risk");
  });

  it("classifies attack style from riichi, call, win, and deal-in rates", () => {
    expect(
      buildAttackStyleClassification([
        makeSnapshot({
          win_rate: 21,
          deal_in_rate: 14,
          riichi_rate: 25,
          call_rate: 36
        })
      ])
    ).toMatchObject({
      type: "over_push",
      status: "risk"
    });

    expect(
      buildAttackStyleClassification([
        makeSnapshot({
          win_rate: 19,
          deal_in_rate: 10,
          riichi_rate: 15,
          call_rate: 28
        })
      ])
    ).toMatchObject({
      type: "under_attack",
      status: "watch"
    });
  });

  it("separates a risky long-term style from a good recent period", () => {
    const assessment = buildAnalysisAssessment([
      makeSnapshot({
        id: 1,
        game_mode: "east",
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 20,
        deal_in_rate: 14,
        call_rate: 36,
        riichi_rate: 25
      }),
      makeSnapshot({
        id: 2,
        game_mode: "east",
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 150,
        win_rate: 22,
        deal_in_rate: 13.33,
        call_rate: 35.33,
        riichi_rate: 24
      })
    ]);

    expect(assessment).toMatchObject({
      long_term_style: { type: "over_push", status: "risk" },
      recent_style: { type: "balanced", status: "good" },
      trend_status: "improving",
      current_alert: "good",
      profile: {
        id: "mahjong-soul-east-provisional",
        version: "1.0.0",
        status: "provisional"
      }
    });
  });

  it("ranks recent regression factors by worsening score", () => {
    const snapshots = Array.from({ length: 20 }, (_, index) =>
      makeSnapshot({
        id: index + 1,
        observed_at_utc: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        avg_place: index < 10 ? 2.4 : 3.6,
        win_rate: index < 10 ? 24 : 18,
        deal_in_rate: index < 10 ? 10 : 14,
        first_rate: 25,
        second_rate: 25,
        third_rate: 25,
        fourth_rate: index < 10 ? 20 : 26,
        rank_points: index < 10 ? 600 : 500
      })
    );

    const factors = buildRecentRegressionFactors(snapshots, 10);

    expect(factors.map((factor) => factor.key)).toEqual(
      expect.arrayContaining(["win_rate", "deal_in_rate", "avg_place"])
    );
    expect(factors[0].score).toBeGreaterThanOrEqual(factors[1].score);
  });

  it("recommends focus items from current indicators", () => {
    const recommendations = buildFocusRecommendations([
      makeSnapshot({
        riichi_rate: 25,
        deal_in_rate: 13,
        win_rate: 19,
        call_rate: 28,
        fourth_rate: 25
      })
    ]);

    expect(recommendations[0]).toMatchObject({
      id: "riichi-danger-spots",
      priority: "high"
    });
    expect(recommendations.map((item) => item.id)).toContain("speed-shortage");
  });

  it("ranks improvement priorities from latest and recent rates", () => {
    const priorities = buildImprovementPriorities([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 23,
        deal_in_rate: 10,
        fourth_rate: 20,
        call_rate: 30,
        avg_place: 2.4
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 150,
        win_rate: 19,
        deal_in_rate: 14,
        fourth_rate: 27,
        call_rate: 38,
        avg_place: 2.63
      })
    ]);

    expect(priorities.map((priority) => priority.id)).toContain("deal-in-rate");
    expect(priorities.map((priority) => priority.id)).toContain("win-rate");
    expect(priorities[0].score).toBeGreaterThanOrEqual(priorities[1].score);
  });

  it("builds automatic analysis comments", () => {
    const comments = buildAnalysisComments([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 23,
        deal_in_rate: 10
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 120,
        win_rate: 19,
        deal_in_rate: 14,
        avg_place: 2.6
      })
    ]);

    expect(comments.length).toBeGreaterThan(0);
    expect(comments.map((comment) => comment.id)).toContain("deal-in-risk");
    expect(comments.map((comment) => comment.id)).toContain("latest-summary");
  });

  it("builds rank point analysis from the Mahjong Soul cap table", () => {
    const analysis = buildRankPointAnalysis([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        rank_name: "雀士",
        rank_level: 2,
        rank_points: 400,
        rank_points_max: null,
        matches: 100
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        rank_name: "雀士",
        rank_level: 2,
        rank_points: 520,
        rank_points_max: null,
        matches: 120
      })
    ]);

    expect(analysis).toMatchObject({
      point_max: 800,
      progress_rate: 65,
      remaining_points: 280,
      point_delta: 120,
      matches_delta: 20,
      points_per_match: 6,
      projected_matches_to_promotion: 47,
      status: "ready"
    });
  });

  it("summarizes metric distributions for filtered analysis targets", () => {
    const distributions = buildMetricDistributions([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        avg_place: 2.5,
        win_rate: 20,
        deal_in_rate: 10,
        rank_points: 400,
        rank_points_max: 800
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 120,
        avg_place: 2.4,
        win_rate: 24,
        deal_in_rate: 11,
        rank_points: 520,
        rank_points_max: 800
      }),
      makeSnapshot({
        id: 3,
        observed_at_utc: "2026-06-03T00:00:00.000Z",
        matches: 140,
        avg_place: 2.6,
        win_rate: 22,
        deal_in_rate: 12,
        rank_points: 560,
        rank_points_max: 800
      })
    ]);

    expect(distributions.find((item) => item.key === "win_rate")).toMatchObject({
      count: 3,
      average: 22,
      median: 22,
      min: 20,
      max: 24,
      latest_value: 22,
      latest_delta_from_average: 0,
      stability: "watch"
    });
    expect(distributions.find((item) => item.key === "rank_point_progress")).toMatchObject({
      average: 61.67,
      latest_value: 70
    });
  });

  it("builds an aggregate stability score from metric distributions", () => {
    const stableScore = buildStabilityScore([
      makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", win_rate: 22, deal_in_rate: 11 }),
      makeSnapshot({ id: 2, observed_at_utc: "2026-06-02T00:00:00.000Z", win_rate: 22.5, deal_in_rate: 11.2 }),
      makeSnapshot({ id: 3, observed_at_utc: "2026-06-03T00:00:00.000Z", win_rate: 22.2, deal_in_rate: 11.1 })
    ]);
    expect(stableScore.status).toBe("stable");
    expect(stableScore.score).toBeGreaterThanOrEqual(85);

    const volatileScore = buildStabilityScore([
      makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z", win_rate: 18, deal_in_rate: 8 }),
      makeSnapshot({ id: 2, observed_at_utc: "2026-06-02T00:00:00.000Z", win_rate: 28, deal_in_rate: 16 }),
      makeSnapshot({ id: 3, observed_at_utc: "2026-06-03T00:00:00.000Z", win_rate: 19, deal_in_rate: 14 })
    ]);
    expect(volatileScore.status).toBe("volatile");
    expect(volatileScore.volatile_metrics).toContain("和了率");
  });

  it("builds snapshot comparison metrics", () => {
    const comparison = buildSnapshotComparison(
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        avg_place: 2.6,
        win_rate: 18,
        deal_in_rate: 14,
        rank_points: 400
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        matches: 125,
        avg_place: 2.45,
        win_rate: 22,
        deal_in_rate: 12,
        rank_points: 460
      })
    );

    expect(comparison.matches_delta).toBe(25);
    expect(comparison.quality).toBe("ok");
    expect(comparison.metrics.find((metric) => metric.key === "avg_place")).toMatchObject({
      delta: -0.15,
      better_direction: "down"
    });
    expect(comparison.metrics.find((metric) => metric.key === "attack_defense_gap")).toMatchObject({
      from_value: 4,
      to_value: 10,
      delta: 6
    });
  });

  it("warns about impossible cumulative deltas before save", () => {
    const warnings = buildDataQualityWarnings(
      {
        observed_date: "2026-06-02",
        observed_time: "12:00",
        timezone: "Asia/Tokyo",
        game_mode: "east",
        matches: 110,
        avg_place: 2.5,
        first_rate: 10,
        second_rate: 20,
        third_rate: 30,
        fourth_rate: 20,
        win_rate: 15,
        deal_in_rate: 20,
        call_rate: 25,
        riichi_rate: 30,
        rank_points: 900,
        rank_points_max: 800
      },
      [
        makeSnapshot({
          id: 1,
          observed_date: "2026-06-01",
          observed_time: "12:00",
          observed_at_utc: "2026-06-01T03:00:00.000Z",
          game_mode: "east",
          matches: 100,
          first_rate: 30,
          second_rate: 25,
          third_rate: 25,
          fourth_rate: 20,
          win_rate: 25,
          deal_in_rate: 10,
          call_rate: 30,
          riichi_rate: 20
        })
      ]
    );

    expect(warnings.map((warning) => warning.code)).toContain("RANK_POINTS_EXCEED_CAP");
    expect(warnings.map((warning) => warning.code)).toContain("RATE_DELTA_NEGATIVE");
    expect(warnings.map((warning) => warning.code)).toContain("PERIOD_DELTA_INCONSISTENT");
  });

  it("finds duplicate candidates before saving", () => {
    const candidates = buildDuplicateSnapshotCandidates(
      {
        observed_date: "2026-06-03",
        observed_time: "23:59",
        timezone: "Asia/Tokyo",
        game_mode: "south",
        matches: 100,
        avg_place: 2.5,
        first_rate: 25,
        second_rate: 25,
        third_rate: 25,
        fourth_rate: 25,
        win_rate: 25,
        deal_in_rate: 12,
        call_rate: 35,
        riichi_rate: 18,
        source_image_sha256: "a".repeat(64)
      },
      [
        makeSnapshot({
          id: 1,
          source_image_sha256: "a".repeat(64)
        })
      ]
    );

    expect(candidates.map((candidate) => candidate.reason)).toContain("same_image_hash");
    expect(candidates.map((candidate) => candidate.reason)).toContain("same_observed_at");
    expect(candidates.map((candidate) => candidate.reason)).toContain("same_date_and_matches");
  });

  it("builds a data quality report across snapshots", () => {
    const report = buildDataQualityReport([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        observed_date: "2026-06-01",
        matches: 100,
        source_image_sha256: "b".repeat(64)
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-06-02T00:00:00.000Z",
        observed_date: "2026-06-02",
        matches: 95,
        first_rate: 40,
        second_rate: 20,
        third_rate: 20,
        fourth_rate: 10,
        source_image_sha256: "b".repeat(64)
      })
    ]);

    expect(report.map((issue) => issue.code)).toContain("MATCHES_DECREASED");
    expect(report.map((issue) => issue.code)).toContain("RANK_RATE_SUM_NOT_100");
    expect(report.map((issue) => issue.code)).toContain("DUPLICATE_IMAGE_HASH");
  });

  it("builds period comparisons for recent windows and months", () => {
    const snapshots = Array.from({ length: 22 }, (_, index) =>
      makeSnapshot({
        id: index + 1,
        observed_date: index < 11 ? "2026-05-15" : "2026-06-15",
        observed_time: `${String(index).padStart(2, "0").slice(-2)}:00`,
        observed_at_utc: `2026-${index < 11 ? "05" : "06"}-15T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
        matches: 100 + index,
        avg_place: index < 12 ? 2.6 : 2.4,
        win_rate: index < 12 ? 20 : 24,
        deal_in_rate: index < 12 ? 14 : 11
      })
    );

    const comparisons = buildPeriodComparisons(snapshots);

    expect(comparisons).toHaveLength(2);
    expect(comparisons[0].quality).toBe("ok");
    expect(comparisons[0].metrics.find((metric) => metric.key === "avg_place")?.delta).toBeLessThan(0);
    expect(comparisons[1]).toMatchObject({
      id: "month",
      quality: "ok"
    });
  });

  it("builds custom period comparisons by date range and game mode", () => {
    const comparison = buildCustomPeriodComparison(
      [
        makeSnapshot({
          id: 1,
          observed_date: "2026-01-01",
          observed_at_utc: "2026-01-01T00:00:00.000Z",
          game_mode: "south",
          avg_place: 2.6,
          win_rate: 20,
          deal_in_rate: 14
        }),
        makeSnapshot({
          id: 2,
          observed_date: "2026-01-10",
          observed_at_utc: "2026-01-10T00:00:00.000Z",
          game_mode: "east",
          avg_place: 3,
          win_rate: 15,
          deal_in_rate: 20
        }),
        makeSnapshot({
          id: 3,
          observed_date: "2026-02-01",
          observed_at_utc: "2026-02-01T00:00:00.000Z",
          game_mode: "south",
          avg_place: 2.2,
          win_rate: 25,
          deal_in_rate: 10
        })
      ],
      {
        from_date_from: "2026-01-01",
        from_date_to: "2026-01-31",
        to_date_from: "2026-02-01",
        to_date_to: "2026-02-28",
        game_mode: "south"
      }
    );

    expect(comparison.from_count).toBe(1);
    expect(comparison.to_count).toBe(1);
    expect(comparison.quality).toBe("ok");
    expect(comparison.metrics.find((metric) => metric.key === "win_rate")).toMatchObject({
      from_value: 20,
      to_value: 25,
      delta: 5
    });
  });
});
