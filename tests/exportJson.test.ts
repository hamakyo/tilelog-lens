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
});
