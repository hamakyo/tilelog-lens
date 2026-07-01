import { describe, expect, it } from "vitest";
import { buildPeriodReports } from "../src/shared/reports";
import { makeSnapshot } from "./fixtures";

describe("period reports", () => {
  it("builds weekly reports by game mode", () => {
    const reports = buildPeriodReports(
      [
        makeSnapshot({
          id: 1,
          observed_date: "2026-06-01",
          observed_time: "10:00",
          observed_at_utc: "2026-06-01T01:00:00.000Z",
          game_mode: "east",
          matches: 100,
          win_rate: 20,
          deal_in_rate: 10
        }),
        makeSnapshot({
          id: 2,
          observed_date: "2026-06-03",
          observed_time: "10:00",
          observed_at_utc: "2026-06-03T01:00:00.000Z",
          game_mode: "east",
          matches: 120,
          win_rate: 22,
          deal_in_rate: 11
        }),
        makeSnapshot({
          id: 3,
          observed_date: "2026-06-03",
          observed_time: "11:00",
          observed_at_utc: "2026-06-03T02:00:00.000Z",
          game_mode: "south",
          matches: 120
        })
      ],
      "week"
    );

    const eastReport = reports.find((report) => report.game_mode === "east");
    const southReport = reports.find((report) => report.game_mode === "south");

    expect(eastReport).toMatchObject({
      period_key: "2026-06-01",
      snapshot_count: 2,
      matches_delta: 20,
      quality: "ok"
    });
    expect(eastReport?.period_metrics?.period_win_rate).toBe(30);
    expect(southReport).toMatchObject({
      snapshot_count: 1,
      matches_delta: null,
      quality: "insufficient_data"
    });
  });

  it("builds monthly reports in latest-first order", () => {
    const reports = buildPeriodReports(
      [
        makeSnapshot({
          id: 1,
          observed_date: "2026-05-31",
          observed_at_utc: "2026-05-31T01:00:00.000Z",
          game_mode: "east",
          matches: 80
        }),
        makeSnapshot({
          id: 2,
          observed_date: "2026-06-02",
          observed_at_utc: "2026-06-02T01:00:00.000Z",
          game_mode: "east",
          matches: 100
        }),
        makeSnapshot({
          id: 3,
          observed_date: "2026-06-30",
          observed_at_utc: "2026-06-30T01:00:00.000Z",
          game_mode: "east",
          matches: 140
        })
      ],
      "month"
    );

    expect(reports.map((report) => report.period_key)).toEqual([
      "2026-06",
      "2026-05"
    ]);
    expect(reports[0]).toMatchObject({
      snapshot_count: 2,
      matches_delta: 40,
      quality: "ok"
    });
  });
});
