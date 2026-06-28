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
  buildRankPointAnalysis,
  buildMetricDistributions,
  buildRiichiTrendAnalyses,
  buildRiichiRiskSignals,
  buildAttackStyleClassification,
  buildRecentRegressionFactors,
  buildFocusRecommendations,
  buildStabilityScore
} from "./metrics";
import { DEFAULT_ANALYSIS_GOALS, buildAnalysisGoalStatuses, buildGoalGapComments } from "./goals";
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
  rank_point_progress: "段位ポイントをポイント上限で割った進捗。",
  riichi_trends: "直近期の立直率と、和了率・放銃率の組み合わせ評価。",
  riichi_risk_signals: "立直率と攻守指標の組み合わせから抽出した確認ポイント。",
  attack_style: "立直率・副露率・和了率・放銃率から分類した攻撃傾向。",
  regression_factors: "直近10件とその前10件を比較した悪化要因ランキング。",
  focus_recommendations: "現在の数値から次に確認すると効果が大きい観点。",
  stability_score: "分析対象内の指標ばらつきから見た安定性評価。",
  goal_gap_comments: "既定の分析目標に対する未達差分コメント。"
};

export function buildAiContext(
  snapshots: Snapshot[],
  options: {
    anonymize?: boolean;
    exportedAt?: string;
    analysisRequest?: {
      goal?: string;
      focus?: string[];
    };
  } = {}
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

  const defaultAnalysisRequest = {
    language: "ja" as const,
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
      "立直トレンド",
      "立直リスクシグナル",
      "攻撃タイプ分類",
      "悪化要因ランキング",
      "見るべき項目",
      "安定性スコア",
      "目標未達差分",
      "データ品質警告",
      "サンプル数が十分か"
    ]
  };
  const goalStatuses = buildAnalysisGoalStatuses(DEFAULT_ANALYSIS_GOALS, latest);

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
    metric_distributions: buildMetricDistributions(latestModeSnapshots),
    riichi_trends: buildRiichiTrendAnalyses(latestModeSnapshots),
    riichi_risk_signals: buildRiichiRiskSignals(latestModeSnapshots),
    attack_style: buildAttackStyleClassification(latestModeSnapshots),
    analysis_comments: buildAnalysisComments(latestModeSnapshots),
    improvement_priorities: buildImprovementPriorities(latestModeSnapshots),
    regression_factors: buildRecentRegressionFactors(latestModeSnapshots),
    focus_recommendations: buildFocusRecommendations(latestModeSnapshots),
    stability_score: buildStabilityScore(latestModeSnapshots),
    goal_gap_comments: buildGoalGapComments(goalStatuses),
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
      goal: options.analysisRequest?.goal?.trim() || defaultAnalysisRequest.goal,
      focus:
        options.analysisRequest?.focus != null &&
        options.analysisRequest.focus.length > 0
          ? options.analysisRequest.focus
          : defaultAnalysisRequest.focus
    }
  };
}
