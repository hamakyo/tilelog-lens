import { describe, expect, it } from "vitest";
import {
  buildDerivedMetrics,
  buildEstimatedDeltas,
  buildImprovementPriorities,
  buildPeriodAnalyses
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
      period_win_rate: 34,
      period_deal_in_rate: 8,
      period_avg_place: 2.14,
      quality: "ok"
    });
    expect(periods[1]).toMatchObject({
      label: "直近100戦",
      actual_matches: 100,
      period_win_rate: 30,
      quality: "ok"
    });
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
});
