import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../src/shared/types";
import {
  buildAnalysisExperimentProgress,
  loadAnalysisExperiments,
  setAnalysisExperimentStatus,
  startAnalysisExperiment
} from "../src/web/lib/analysisExperiments";

const values = new Map<string, string>();

function snapshot(overrides: Partial<Snapshot>): Snapshot {
  return {
    id: 1,
    observed_date: "2026-01-01",
    observed_time: "12:00",
    observed_at_utc: "2026-01-01T03:00:00.000Z",
    timezone: "Asia/Tokyo",
    game_mode: "east",
    player_name: null,
    player_id: null,
    rank_name: null,
    rank_level: null,
    rank_points: 100,
    rank_points_max: 800,
    matches: 100,
    avg_win_score: 6500,
    avg_place: 2.5,
    max_renchan: 4,
    avg_win_turn: 12,
    first_rate: 25,
    second_rate: 25,
    third_rate: 25,
    fourth_rate: 25,
    bust_rate: 3,
    win_rate: 20,
    tsumo_rate: 30,
    deal_in_rate: 14,
    call_rate: 28,
    riichi_rate: 18,
    note: null,
    source_image_sha256: null,
    file_name: null,
    file_last_modified: null,
    exif_taken_at: null,
    image_width: null,
    image_height: null,
    parser_version: null,
    source_image_stored: 0,
    created_at: "2026-01-01T03:00:00.000Z",
    updated_at: "2026-01-01T03:00:00.000Z",
    ...overrides
  };
}

beforeEach(() => {
  values.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }
  });
});

describe("analysis experiments", () => {
  it("tracks progress from the baseline snapshot", () => {
    const baseline = snapshot({});
    const started = startAnalysisExperiment(
      [],
      {
        title: "放銃率改善",
        metric: "deal_in_rate",
        target_value: 12,
        target_matches: 50
      },
      baseline
    );
    const latest = snapshot({
      id: 2,
      observed_at_utc: "2026-01-03T03:00:00.000Z",
      matches: 125,
      deal_in_rate: 11.8
    });

    expect(buildAnalysisExperimentProgress(started.item, [latest, baseline])).toMatchObject({
      matches_delta: 25,
      matches_progress_rate: 50,
      metric_delta: -2.2,
      achieved: false,
      quality: "ready"
    });
    expect(loadAnalysisExperiments()).toHaveLength(1);
  });

  it("can complete an experiment", () => {
    const started = startAnalysisExperiment(
      [],
      { title: "和了率改善", metric: "win_rate", target_value: 22, target_matches: 30 },
      snapshot({})
    );
    const completed = setAnalysisExperimentStatus(started.items, started.item.id, "completed");
    expect(completed[0].status).toBe("completed");
    expect(completed[0].completed_at).not.toBeNull();
  });
});
