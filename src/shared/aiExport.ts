import { APP_NAME, GAME_NAME } from "./constants";
import type { AiContext, Snapshot } from "./types";
import { buildDerivedMetrics, buildEstimatedDeltas } from "../worker/lib/metrics";

const metricsDescription: Record<string, string> = {
  avg_place: "Average placement. Lower is better.",
  win_rate: "Winning hand rate.",
  deal_in_rate: "Deal-in rate.",
  call_rate: "Open call rate.",
  riichi_rate: "Riichi declaration rate.",
  attack_defense_gap: "win_rate minus deal_in_rate. Higher is generally better.",
  top_two_rate: "first_rate plus second_rate.",
  bottom_two_rate: "third_rate plus fourth_rate.",
  rank_point_progress: "rank_points divided by rank_points_max when present."
};

export function buildAiContext(
  snapshots: Snapshot[],
  options: { anonymize?: boolean; exportedAt?: string } = {}
): AiContext {
  const anonymized = options.anonymize !== false;
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const sanitizedSnapshots = snapshots.map((snapshot) => ({
    ...snapshot,
    player_name: anonymized ? null : snapshot.player_name,
    player_id: anonymized ? null : snapshot.player_id
  }));

  return {
    schema_version: "1.0",
    app: APP_NAME,
    game: GAME_NAME,
    exported_at: exportedAt,
    privacy: {
      anonymized,
      screenshots_included: false,
      source_images_stored: false
    },
    metrics_description: metricsDescription,
    snapshots: sanitizedSnapshots,
    derived_metrics: buildDerivedMetrics(sanitizedSnapshots),
    estimated_deltas: buildEstimatedDeltas(sanitizedSnapshots),
    notes: sanitizedSnapshots
      .filter((snapshot) => snapshot.note != null && snapshot.note.trim() !== "")
      .map((snapshot) => ({
        snapshot_id: snapshot.id,
        observed_at_utc: snapshot.observed_at_utc,
        note: snapshot.note ?? ""
      })),
    analysis_request: {
      language: "ja",
      goal: "雀魂の戦績推移を分析し、改善優先度を特定してください。",
      focus: [
        "平均順位の推移",
        "和了率と放銃率のバランス",
        "副露率の変化",
        "立直率の変化",
        "3位・4位率の低減",
        "段位ポイントの推移"
      ]
    }
  };
}
