import { describe, expect, it } from "vitest";
import {
  analysisExperimentSchema,
  analysisPreferencesSyncSchema,
  savedAnalysisViewSchema
} from "../src/shared/analysisPreferences";
import { mergeAnalysisPreferences } from "../src/worker/lib/analysisPreferences";

const view = {
  id: "view-1",
  name: "東風戦・ラス回避",
  game_mode: "east" as const,
  filters: {
    observedDateFrom: "",
    observedDateTo: "",
    minMatches: "",
    maxMatches: "",
    minWinRate: "",
    maxDealInRate: "12",
    maxAvgPlace: ""
  },
  tab: "improvement" as const,
  chart_metrics: ["avg_place", "deal_in_rate"] as const,
  created_at: "2026-07-21T00:00:00.000Z",
  updated_at: "2026-07-21T00:00:00.000Z"
};

const experiment = {
  id: "experiment-1",
  title: "放銃率を下げる",
  game_mode: "east" as const,
  metric: "deal_in_rate" as const,
  target_value: 12,
  target_matches: 50,
  baseline_snapshot_id: null,
  baseline_value: 14,
  baseline_matches: 100,
  baseline_observed_at_utc: "2026-07-21T00:00:00.000Z",
  status: "active" as const,
  created_at: "2026-07-21T00:00:00.000Z",
  completed_at: null,
  updated_at: "2026-07-21T00:00:00.000Z"
};

describe("analysis preference schemas", () => {
  it("accepts validated views and experiments for initial sync", () => {
    expect(savedAnalysisViewSchema.safeParse(view).success).toBe(true);
    expect(analysisExperimentSchema.safeParse(experiment).success).toBe(true);
    expect(
      analysisPreferencesSyncSchema.safeParse({ views: [view], experiments: [experiment] }).success
    ).toBe(true);
  });

  it("rejects invalid limits and experiment ranges", () => {
    expect(
      analysisPreferencesSyncSchema.safeParse({
        views: Array.from({ length: 21 }, (_, index) => ({ ...view, id: `view-${index}` })),
        experiments: []
      }).success
    ).toBe(false);
    expect(
      analysisExperimentSchema.safeParse({ ...experiment, target_matches: 0 }).success
    ).toBe(false);
  });

  it("merges by id, prefers D1 on ties, and keeps the newest items within the limit", () => {
    const stored = [
      { id: "same", updated_at: "2026-07-21T00:00:02.000Z", value: "d1" },
      { id: "old", updated_at: "2026-07-21T00:00:01.000Z", value: "old" }
    ];
    const incoming = [
      { id: "same", updated_at: "2026-07-21T00:00:02.000Z", value: "local" },
      { id: "old", updated_at: "2026-07-21T00:00:03.000Z", value: "newer" },
      { id: "new", updated_at: "2026-07-21T00:00:04.000Z", value: "new" }
    ];

    expect(mergeAnalysisPreferences(stored, incoming, 2)).toEqual([
      { id: "new", updated_at: "2026-07-21T00:00:04.000Z", value: "new" },
      { id: "old", updated_at: "2026-07-21T00:00:03.000Z", value: "newer" }
    ]);
    expect(mergeAnalysisPreferences(stored, incoming, 3)).toContainEqual({
      id: "same",
      updated_at: "2026-07-21T00:00:02.000Z",
      value: "d1"
    });
  });
});
