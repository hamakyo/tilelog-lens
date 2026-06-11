import { APP_NAME, GAME_NAME } from "./constants";
import {
  buildDataQualityWarnings,
  buildDataQualityReport,
  buildAnalysisComments,
  buildDerivedMetrics,
  buildEstimatedDeltas,
  buildImprovementPriorities,
  buildPeriodComparisons,
  buildPeriodAnalyses,
  buildRankPointAnalysis
} from "./metrics";
import type { AiContext, Snapshot } from "./types";

const metricsDescription: Record<string, string> = {
  avg_place: "平均順位。低いほど良い。",
  win_rate: "和了率。",
  deal_in_rate: "放銃率。",
  call_rate: "副露率。",
  riichi_rate: "立直率。",
  attack_defense_gap: "和了率から放銃率を引いた値。一般的には高いほど良い。",
  top_two_rate: "一位率と二位率の合計。",
  bottom_two_rate: "三位率と四位率の合計。",
  rank_point_progress: "段位ポイントをポイント上限で割った進捗。"
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
  const ordered = [...sanitizedSnapshots].sort((a, b) =>
    a.observed_at_utc.localeCompare(b.observed_at_utc)
  );
  const latest = ordered.at(-1);
  const latestModeSnapshots = latest
    ? ordered.filter((snapshot) => snapshot.game_mode === latest.game_mode)
    : ordered;

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
    period_analyses: buildPeriodAnalyses(latestModeSnapshots),
    period_comparisons: buildPeriodComparisons(latestModeSnapshots),
    analysis_comments: buildAnalysisComments(latestModeSnapshots),
    improvement_priorities: buildImprovementPriorities(latestModeSnapshots),
    rank_point_analysis: buildRankPointAnalysis(latestModeSnapshots),
    data_quality_warnings: latest
      ? buildDataQualityWarnings(latest, ordered, { excludeId: latest.id })
      : [],
    data_quality_issues: buildDataQualityReport(ordered),
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
        "段位ポイントの推移",
        "直近期の悪化指標",
        "期間比較",
        "改善優先度",
        "データ品質警告",
        "サンプル数が十分か"
      ]
    }
  };
}
