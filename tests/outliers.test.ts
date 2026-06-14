import { describe, expect, it } from "vitest";
import { detectOutlierSignals } from "../src/shared/outliers";
import { makeSnapshot } from "./fixtures";

describe("outliers", () => {
  it("requires enough baseline snapshots", () => {
    expect(
      detectOutlierSignals([
        makeSnapshot({ id: 1, observed_at_utc: "2026-01-01T00:00:00.000Z" }),
        makeSnapshot({ id: 2, observed_at_utc: "2026-01-02T00:00:00.000Z" })
      ])
    ).toEqual([]);
  });

  it("detects latest metric changes against historical baseline", () => {
    const signals = detectOutlierSignals([
      makeSnapshot({
        id: 1,
        observed_at_utc: "2026-01-01T00:00:00.000Z",
        deal_in_rate: 10,
        win_rate: 25,
        fourth_rate: 20,
        avg_place: 2.4
      }),
      makeSnapshot({
        id: 2,
        observed_at_utc: "2026-01-02T00:00:00.000Z",
        deal_in_rate: 11,
        win_rate: 24,
        fourth_rate: 21,
        avg_place: 2.45
      }),
      makeSnapshot({
        id: 3,
        observed_at_utc: "2026-01-03T00:00:00.000Z",
        deal_in_rate: 15,
        win_rate: 19,
        fourth_rate: 28,
        avg_place: 2.8
      })
    ]);

    expect(signals.map((signal) => signal.id)).toEqual([
      "avg_place",
      "fourth_rate",
      "win_rate",
      "deal_in_rate"
    ]);
    expect(signals.every((signal) => signal.severity === "risk")).toBe(true);
  });
});
