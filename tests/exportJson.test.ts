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
        observed_at_utc: "2026-06-01T00:00:00.000Z",
        matches: 100,
        win_rate: 24,
        deal_in_rate: 10,
        fourth_rate: 20
      }),
      makeSnapshot({
        id: 2,
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
    expect(context.improvement_priorities.length).toBeGreaterThan(0);
    expect(context.rank_point_analysis).not.toBeUndefined();
    expect(context.analysis_request.focus).toContain("改善優先度");
  });
});
