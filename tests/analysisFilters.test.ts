import { describe, expect, it } from "vitest";
import {
  analysisScopeToSearchParams,
  buildAnalysisFilterSummary,
  countActiveAnalysisFilters,
  filterSnapshotsForAnalysis,
  parseAnalysisScope
} from "../src/shared/analysisFilters";
import { makeSnapshot } from "./fixtures";

describe("analysis filters", () => {
  const snapshots = [
    makeSnapshot({
      id: 1,
      observed_date: "2026-01-01",
      observed_time: "10:00",
      observed_at_utc: "2026-01-01T01:00:00.000Z",
      game_mode: "east",
      matches: 100,
      avg_place: 2.42,
      win_rate: 23,
      deal_in_rate: 12
    }),
    makeSnapshot({
      id: 2,
      observed_date: "2026-02-01",
      observed_time: "10:00",
      observed_at_utc: "2026-02-01T01:00:00.000Z",
      game_mode: "south",
      matches: 220,
      avg_place: 2.2,
      win_rate: 25,
      deal_in_rate: 10
    }),
    makeSnapshot({
      id: 3,
      observed_date: "2026-03-01",
      observed_time: "10:00",
      observed_at_utc: "2026-03-01T01:00:00.000Z",
      game_mode: "east",
      matches: 340,
      avg_place: 2.65,
      win_rate: 20,
      deal_in_rate: 15
    })
  ];

  it("filters snapshots by mode and observed date range", () => {
    const filtered = filterSnapshotsForAnalysis(snapshots, {
      game_mode: "east",
      observed_date_from: "2026-02-01",
      observed_date_to: "2026-03-31"
    });

    expect(filtered.map((snapshot) => snapshot.id)).toEqual([3]);
  });

  it("filters snapshots by match and performance thresholds", () => {
    const filtered = filterSnapshotsForAnalysis(snapshots, {
      min_matches: 200,
      max_matches: 300,
      min_win_rate: 24,
      max_deal_in_rate: 11,
      max_avg_place: 2.3
    });

    expect(filtered.map((snapshot) => snapshot.id)).toEqual([2]);
  });

  it("counts active filters and summarizes filtered results", () => {
    const filters = {
      game_mode: "all" as const,
      observed_date_from: "2026-01-01",
      min_matches: 100,
      max_deal_in_rate: 12
    };
    const filtered = filterSnapshotsForAnalysis(snapshots, filters);

    expect(countActiveAnalysisFilters(filters)).toBe(3);
    expect(buildAnalysisFilterSummary(snapshots, filtered, filters)).toEqual({
      total_count: 3,
      filtered_count: 2,
      active_filter_count: 3
    });
  });

  it("round-trips a shared analysis scope through query parameters", () => {
    const params = analysisScopeToSearchParams({
      game_mode: "east",
      observed_date_from: "2026-01-01",
      observed_date_to: "2026-06-30",
      min_matches: 100,
      max_matches: 500,
      min_win_rate: 20,
      max_deal_in_rate: 13,
      max_avg_place: 2.5
    });

    expect(parseAnalysisScope((name) => params.get(name) ?? undefined)).toEqual({
      game_mode: "east",
      observed_date_from: "2026-01-01",
      observed_date_to: "2026-06-30",
      min_matches: 100,
      max_matches: 500,
      min_win_rate: 20,
      max_deal_in_rate: 13,
      max_avg_place: 2.5
    });
  });
});
