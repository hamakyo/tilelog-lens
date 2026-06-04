import { describe, expect, it } from "vitest";
import { buildDerivedMetrics, buildEstimatedDeltas } from "../src/shared/metrics";
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
});
