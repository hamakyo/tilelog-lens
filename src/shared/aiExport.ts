import { APP_NAME, GAME_NAME } from "./constants";
import {
  buildDerivedMetrics,
  buildRankPointAnalysis,
  buildMetricDistributions,
  buildStabilityScore
} from "./metrics";
import {
  buildEstimatedDeltas,
  buildPeriodAnalyses,
  buildPeriodComparisons
} from "./analysis/periodMetrics";
import {
  buildAnalysisAssessment,
  buildAttackStyleClassification,
  buildRiichiRiskSignals,
  buildRiichiTrendAnalyses
} from "./analysis/styleClassification";
import {
  buildAnalysisComments,
  buildFocusRecommendations,
  buildImprovementPriorities,
  buildRecentRegressionFactors
} from "./analysis/improvement";
import {
  buildDataQualityReport,
  buildDataQualityWarnings
} from "./analysis/dataQuality";
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
  attack_style: "立直率・副露率・和了率・放銃率から分類した長期の攻撃傾向。",
  analysis_assessment: "累積値による長期スタイルと、推定期間値による直近状態を分離した評価。",
  regression_factors: "直近10件とその前10件を比較した悪化要因ランキング。",
  focus_recommendations: "現在の数値から次に確認すると効果が大きい観点。",
  stability_score: "分析対象内の指標ばらつきから見た安定性評価。",
  goal_gap_comments: "既定の分析目標に対する未達差分コメント。"
};

function formatSummaryRate(value: number): string {
  return `${value.toFixed(2)}%`;
}

function buildAiContextSummary(input: {
  snapshotCount: number;
  latest: Snapshot | undefined;
  attackStyle: AiContext["attack_style"];
  improvementPriorities: AiContext["improvement_priorities"];
  regressionFactors: AiContext["regression_factors"];
  focusRecommendations: AiContext["focus_recommendations"];
  stabilityScore: AiContext["stability_score"];
  dataQualityIssues: AiContext["data_quality_issues"];
}): AiContext["summary"] {
  const latest = input.latest;
  const topPriority = input.improvementPriorities[0];
  const topRegression = input.regressionFactors[0];
  const topFindings = [
    latest
      ? `最新記録は${latest.observed_at_utc}、${latest.matches}戦、平均順位${latest.avg_place.toFixed(2)}です。`
      : "記録がまだありません。",
    latest
      ? `和了率${formatSummaryRate(latest.win_rate)}、放銃率${formatSummaryRate(latest.deal_in_rate)}、立直率${formatSummaryRate(latest.riichi_rate)}です。`
      : null,
    input.attackStyle ? `攻撃タイプは「${input.attackStyle.label}」です。` : null,
    `安定性は「${input.stabilityScore.status}」です。`,
    topRegression ? `主な悪化要因は「${topRegression.label}」です。` : null,
    topPriority ? `最優先の改善項目は「${topPriority.title}」です。` : null
  ].filter((finding): finding is string => finding != null);
  const recommendedActions = input.focusRecommendations
    .slice(0, 3)
    .map((recommendation) => `${recommendation.title}: ${recommendation.reason}`);

  return {
    snapshot_count: input.snapshotCount,
    latest_observed_at_utc: latest?.observed_at_utc ?? null,
    latest_game_mode: latest?.game_mode ?? null,
    latest_metrics: latest
      ? {
          matches: latest.matches,
          avg_place: latest.avg_place,
          win_rate: latest.win_rate,
          deal_in_rate: latest.deal_in_rate,
          call_rate: latest.call_rate,
          riichi_rate: latest.riichi_rate,
          fourth_rate: latest.fourth_rate
        }
      : null,
    attack_style_label: input.attackStyle?.label ?? null,
    stability_status: input.stabilityScore.status,
    top_findings: topFindings,
    recommended_actions: recommendedActions,
    data_quality_issue_count: input.dataQualityIssues.length,
    summary_text: `${topFindings.join(" ")}${
      recommendedActions.length > 0
        ? ` 次に見る項目: ${recommendedActions.map((action) => action.split(":")[0]).join(" / ")}。`
        : ""
    }`
  };
}

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
  const derivedMetrics = buildDerivedMetrics(sanitizedSnapshots);
  const estimatedDeltas = buildEstimatedDeltas(sanitizedSnapshots);
  const periodAnalyses = buildPeriodAnalyses(latestModeSnapshots);
  const periodComparisons = buildPeriodComparisons(latestModeSnapshots);
  const metricDistributions = buildMetricDistributions(latestModeSnapshots);
  const riichiTrends = buildRiichiTrendAnalyses(latestModeSnapshots);
  const riichiRiskSignals = buildRiichiRiskSignals(latestModeSnapshots);
  const attackStyle = buildAttackStyleClassification(latestModeSnapshots);
  const analysisAssessment = buildAnalysisAssessment(latestModeSnapshots);
  const analysisComments = buildAnalysisComments(latestModeSnapshots);
  const improvementPriorities = buildImprovementPriorities(latestModeSnapshots);
  const regressionFactors = buildRecentRegressionFactors(latestModeSnapshots);
  const focusRecommendations = buildFocusRecommendations(latestModeSnapshots);
  const stabilityScore = buildStabilityScore(latestModeSnapshots);
  const goalGapComments = buildGoalGapComments(goalStatuses);
  const rankPointAnalysis = buildRankPointAnalysis(latestModeSnapshots);
  const dataQualityWarnings = latest
    ? buildDataQualityWarnings(latest, ordered, { excludeId: latest.id })
    : [];
  const dataQualityIssues = buildDataQualityReport(ordered);
  const summary = buildAiContextSummary({
    snapshotCount: sanitizedSnapshots.length,
    latest,
    attackStyle,
    improvementPriorities,
    regressionFactors,
    focusRecommendations,
    stabilityScore,
    dataQualityIssues
  });

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
    analysis_engine: {
      version: "2.0.0",
      profile_id: analysisAssessment?.profile.id ?? null,
      profile_version: analysisAssessment?.profile.version ?? null,
      profile_status: analysisAssessment?.profile.status ?? null
    },
    analysis_assessment: analysisAssessment,
    summary,
    snapshots: sanitizedSnapshots,
    derived_metrics: derivedMetrics,
    estimated_deltas: estimatedDeltas,
    period_analyses: periodAnalyses,
    period_comparisons: periodComparisons,
    metric_distributions: metricDistributions,
    riichi_trends: riichiTrends,
    riichi_risk_signals: riichiRiskSignals,
    attack_style: attackStyle,
    analysis_comments: analysisComments,
    improvement_priorities: improvementPriorities,
    regression_factors: regressionFactors,
    focus_recommendations: focusRecommendations,
    stability_score: stabilityScore,
    goal_gap_comments: goalGapComments,
    rank_point_analysis: rankPointAnalysis,
    data_quality_warnings: dataQualityWarnings,
    data_quality_issues: dataQualityIssues,
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
