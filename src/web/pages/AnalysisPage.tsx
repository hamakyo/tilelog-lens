import { useEffect, useMemo, useState } from "react";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import Flag from "lucide-react/dist/esm/icons/flag.js";
import Gauge from "lucide-react/dist/esm/icons/gauge.js";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert.js";
import type { AnalysisGoal, EstimatedDelta, Snapshot } from "../../shared/types";
import {
  GAME_MODE_LABELS,
  GAME_MODES,
  RANK_LEVEL_LABELS,
  RANK_LEVELS,
  RANK_NAME_LABELS,
  RANK_POINT_MAX_BY_RANK_AND_LEVEL
} from "../../shared/constants";
import {
  buildAnalysisFilterSummary,
  filterSnapshotsForAnalysis,
  type AnalysisFilterInput
} from "../../shared/analysisFilters";
import { buildAnalysisTemplateReports } from "../../shared/analysisTemplates";
import {
  buildCustomMetricResults,
  type CustomMetricDefinition
} from "../../shared/customMetrics";
import { detectOutlierSignals } from "../../shared/outliers";
import { buildTagAnalyses } from "../../shared/tags";
import {
  buildEstimatedDeltas,
  buildImprovementPriorities,
  buildAnalysisComments,
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
} from "../../shared/metrics";
import { buildAnalysisGoalStatuses, buildGoalGapComments } from "../../shared/goals";
import { listDeltas, listSnapshots } from "../lib/api";
import { loadAnalysisGoals } from "../lib/analysisGoals";
import { loadCustomMetrics } from "../lib/customMetrics";
import { formatDateTime, formatDecimal, formatNumber, formatRate } from "../lib/format";
import { TrendChart } from "../components/TrendChart";

type AnalysisPageProps = {
  navigate: (path: string) => void;
};

type DashboardFilterForm = {
  observedDateFrom: string;
  observedDateTo: string;
  minMatches: string;
  maxMatches: string;
  minWinRate: string;
  maxDealInRate: string;
  maxAvgPlace: string;
};

type ChartPoint = {
  label: string;
  avg_place: number;
  win_rate: number;
  deal_in_rate: number;
  attack_defense_gap: number;
  call_rate: number;
  riichi_rate: number;
  top_two_rate: number;
  bottom_two_rate: number;
  rank_points: number | null;
  rank_point_progress: number | null;
};

type ChartMetricKey = Exclude<keyof ChartPoint, "label">;

type AnalysisTab = "overview" | "riichi" | "improvement" | "detail";

const analysisTabs: Array<{ id: AnalysisTab; label: string }> = [
  { id: "overview", label: "概要" },
  { id: "riichi", label: "立直" },
  { id: "improvement", label: "改善" },
  { id: "detail", label: "詳細" }
];

const chartMetricOptions: Array<{
  key: ChartMetricKey;
  label: string;
  color: string;
}> = [
  { key: "avg_place", label: "平均順位", color: "#1f6f8b" },
  { key: "win_rate", label: "和了率", color: "#117a65" },
  { key: "deal_in_rate", label: "放銃率", color: "#b23b3b" },
  { key: "attack_defense_gap", label: "攻守差", color: "#7f5f01" },
  { key: "call_rate", label: "副露率", color: "#2f6fed" },
  { key: "riichi_rate", label: "立直率", color: "#b0477d" },
  { key: "top_two_rate", label: "1-2位率", color: "#147d64" },
  { key: "bottom_two_rate", label: "3-4位率", color: "#9b3b3b" },
  { key: "rank_point_progress", label: "段位pt進捗", color: "#3d5a80" }
];

const emptyDashboardFilters: DashboardFilterForm = {
  observedDateFrom: "",
  observedDateTo: "",
  minMatches: "",
  maxMatches: "",
  minWinRate: "",
  maxDealInRate: "",
  maxAvgPlace: ""
};

function toChartPoints(snapshots: Snapshot[]): ChartPoint[] {
  return [...snapshots]
    .sort((a, b) => a.observed_at_utc.localeCompare(b.observed_at_utc))
    .map((snapshot) => {
      const rankPointsMax = rankPointMaxForSnapshot(snapshot);

      return {
        label: `${snapshot.observed_date} ${snapshot.observed_time}`,
        avg_place: snapshot.avg_place,
        win_rate: snapshot.win_rate,
        deal_in_rate: snapshot.deal_in_rate,
        attack_defense_gap: Number((snapshot.win_rate - snapshot.deal_in_rate).toFixed(2)),
        call_rate: snapshot.call_rate,
        riichi_rate: snapshot.riichi_rate,
        top_two_rate: Number((snapshot.first_rate + snapshot.second_rate).toFixed(2)),
        bottom_two_rate: Number((snapshot.third_rate + snapshot.fourth_rate).toFixed(2)),
        rank_points: snapshot.rank_points,
        rank_point_progress:
          snapshot.rank_points != null && rankPointsMax != null
            ? Number(((snapshot.rank_points / rankPointsMax) * 100).toFixed(2))
            : null
      };
    });
}

function formatSignedNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

function metricUnitValue(value: number | null, unit: "number" | "rate" | "rank_point" | "place"): string {
  if (value == null) return "-";
  if (unit === "rate") return formatRate(value);
  if (unit === "rank_point") return `${formatNumber(value)}pt`;
  if (unit === "place") return formatDecimal(value);
  return formatDecimal(value);
}

function metricTone(
  delta: number | null,
  betterDirection: "up" | "down" | "neutral"
): string {
  if (delta == null || delta === 0 || betterDirection === "neutral") return "neutral";
  const improved = betterDirection === "up" ? delta > 0 : delta < 0;
  return improved ? "good" : "bad";
}

function goalValueText(goal: AnalysisGoal, value: number | null): string {
  if (value == null) return "-";
  if (
    goal.id === "win_rate" ||
    goal.id === "deal_in_rate" ||
    goal.id === "fourth_rate" ||
    goal.id === "rank_point_progress"
  ) {
    return formatRate(value);
  }
  return formatDecimal(value);
}

function rankLabel(snapshot: Snapshot | undefined): string {
  if (!snapshot?.rank_name) return "-";
  const level = snapshot.rank_level;
  const levelLabel =
    level != null && RANK_LEVELS.includes(level as (typeof RANK_LEVELS)[number])
      ? ` ${RANK_LEVEL_LABELS[level as (typeof RANK_LEVELS)[number]]}`
      : "";

  return `${RANK_NAME_LABELS[snapshot.rank_name as keyof typeof RANK_NAME_LABELS] ?? snapshot.rank_name}${levelLabel}`;
}

function rankPointMaxForSnapshot(snapshot: Snapshot): number | null {
  if (snapshot.rank_points_max != null) return snapshot.rank_points_max;
  const level = snapshot.rank_level;
  if (snapshot.rank_name == null || level == null) return null;
  if (!RANK_LEVELS.includes(level as (typeof RANK_LEVELS)[number])) return null;

  return (
    RANK_POINT_MAX_BY_RANK_AND_LEVEL[
      snapshot.rank_name as keyof typeof RANK_POINT_MAX_BY_RANK_AND_LEVEL
    ]?.[level as (typeof RANK_LEVELS)[number]] ?? null
  );
}

function optionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function analysisTabPanelClass(tab: AnalysisTab, activeTab: AnalysisTab): string {
  return `analysis-tab-panel${activeTab === tab ? " active" : ""}`;
}

export function AnalysisPage({ navigate }: AnalysisPageProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [deltas, setDeltas] = useState<EstimatedDelta[]>([]);
  const [analysisGoals, setAnalysisGoals] = useState<AnalysisGoal[]>(() =>
    loadAnalysisGoals()
  );
  const [customMetrics, setCustomMetrics] = useState<CustomMetricDefinition[]>(() =>
    loadCustomMetrics()
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<Snapshot["game_mode"] | "all">("all");
  const [filterForm, setFilterForm] =
    useState<DashboardFilterForm>(emptyDashboardFilters);
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<ChartMetricKey[]>([
    "avg_place",
    "win_rate",
    "deal_in_rate"
  ]);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("overview");

  useEffect(() => {
    setAnalysisGoals(loadAnalysisGoals());
    setCustomMetrics(loadCustomMetrics());
    Promise.all([listSnapshots(), listDeltas()])
      .then(([snapshotResult, deltaResult]) => {
        setSnapshots(snapshotResult.items);
        setDeltas(deltaResult.items);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  const availableModes = useMemo(
    () => GAME_MODES.filter((mode) => snapshots.some((snapshot) => snapshot.game_mode === mode)),
    [snapshots]
  );
  const analysisFilters = useMemo<AnalysisFilterInput>(
    () => ({
      game_mode: selectedMode,
      observed_date_from: filterForm.observedDateFrom || undefined,
      observed_date_to: filterForm.observedDateTo || undefined,
      min_matches: optionalNumber(filterForm.minMatches),
      max_matches: optionalNumber(filterForm.maxMatches),
      min_win_rate: optionalNumber(filterForm.minWinRate),
      max_deal_in_rate: optionalNumber(filterForm.maxDealInRate),
      max_avg_place: optionalNumber(filterForm.maxAvgPlace)
    }),
    [filterForm, selectedMode]
  );
  const displaySnapshots = useMemo(
    () => filterSnapshotsForAnalysis(snapshots, analysisFilters),
    [analysisFilters, snapshots]
  );
  const filterSummary = useMemo(
    () => buildAnalysisFilterSummary(snapshots, displaySnapshots, analysisFilters),
    [analysisFilters, displaySnapshots, snapshots]
  );
  const latest = displaySnapshots[0];
  const latestMode = latest?.game_mode ?? (selectedMode === "all" ? null : selectedMode);
  const modeSnapshots = useMemo(
    () =>
      latestMode
        ? displaySnapshots.filter((snapshot) => snapshot.game_mode === latestMode)
        : displaySnapshots,
    [displaySnapshots, latestMode]
  );
  const chartData = useMemo(() => toChartPoints(displaySnapshots), [displaySnapshots]);
  const selectedChartLines = useMemo(
    () =>
      chartMetricOptions
        .filter((option) => selectedChartMetrics.includes(option.key))
        .map((option) => ({
          dataKey: option.key,
          label: option.label,
          color: option.color
        })),
    [selectedChartMetrics]
  );
  const periodAnalyses = useMemo(
    () => buildPeriodAnalyses(modeSnapshots),
    [modeSnapshots]
  );
  const riichiTrendAnalyses = useMemo(
    () => buildRiichiTrendAnalyses(modeSnapshots),
    [modeSnapshots]
  );
  const riichiRiskSignals = useMemo(
    () => buildRiichiRiskSignals(modeSnapshots),
    [modeSnapshots]
  );
  const attackStyle = useMemo(
    () => buildAttackStyleClassification(modeSnapshots),
    [modeSnapshots]
  );
  const periodComparisons = useMemo(
    () => buildPeriodComparisons(modeSnapshots),
    [modeSnapshots]
  );
  const improvementPriorities = useMemo(
    () => buildImprovementPriorities(modeSnapshots),
    [modeSnapshots]
  );
  const regressionFactors = useMemo(
    () => buildRecentRegressionFactors(modeSnapshots),
    [modeSnapshots]
  );
  const focusRecommendations = useMemo(
    () => buildFocusRecommendations(modeSnapshots),
    [modeSnapshots]
  );
  const analysisComments = useMemo(
    () => buildAnalysisComments(modeSnapshots),
    [modeSnapshots]
  );
  const analysisTemplateReports = useMemo(
    () => buildAnalysisTemplateReports(modeSnapshots),
    [modeSnapshots]
  );
  const outlierSignals = useMemo(
    () => detectOutlierSignals(modeSnapshots),
    [modeSnapshots]
  );
  const tagAnalyses = useMemo(
    () => buildTagAnalyses(modeSnapshots),
    [modeSnapshots]
  );
  const rankPointAnalysis = useMemo(
    () => buildRankPointAnalysis(modeSnapshots),
    [modeSnapshots]
  );
  const metricDistributions = useMemo(
    () => buildMetricDistributions(modeSnapshots),
    [modeSnapshots]
  );
  const stabilityScore = useMemo(
    () => buildStabilityScore(modeSnapshots),
    [modeSnapshots]
  );
  const goalStatuses = useMemo(
    () => buildAnalysisGoalStatuses(analysisGoals, latest),
    [analysisGoals, latest]
  );
  const goalGapComments = useMemo(
    () => buildGoalGapComments(goalStatuses),
    [goalStatuses]
  );
  const customMetricResults = useMemo(
    () => buildCustomMetricResults(latest, customMetrics),
    [customMetrics, latest]
  );
  const displayDeltas = useMemo(
    () =>
      filterSummary.active_filter_count === 0
        ? deltas
        : buildEstimatedDeltas(displaySnapshots),
    [deltas, displaySnapshots, filterSummary.active_filter_count]
  );
  const latestDelta = displayDeltas[displayDeltas.length - 1];

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">ダッシュボード</p>
          <h1>詳細分析</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => navigate("/import")}>
          <Activity size={18} aria-hidden="true" />
          <span>新規記録</span>
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">成績を読み込んでいます...</p> : null}

      <section className="filter-bar" aria-label="ゲームモード切替">
        <button
          type="button"
          className={selectedMode === "all" ? "active" : ""}
          onClick={() => setSelectedMode("all")}
        >
          すべて
        </button>
        {availableModes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={selectedMode === mode ? "active" : ""}
            onClick={() => setSelectedMode(mode)}
          >
            {GAME_MODE_LABELS[mode]}
          </button>
        ))}
      </section>

      <section className="form-section analysis-filter-panel">
        <div className="section-heading inline-heading">
          <div>
            <h2>分析フィルタ</h2>
            <p>
              {filterSummary.total_count}件中 {filterSummary.filtered_count}件を分析対象にしています。
              {filterSummary.active_filter_count > 0
                ? ` 有効な条件: ${filterSummary.active_filter_count}件`
                : " 条件は未指定です。"}
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSelectedMode("all");
              setFilterForm(emptyDashboardFilters);
            }}
          >
            条件をリセット
          </button>
        </div>
        <div className="form-grid analysis-filter-grid">
          <label>
            <span>開始日</span>
            <input
              type="date"
              value={filterForm.observedDateFrom}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  observedDateFrom: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>終了日</span>
            <input
              type="date"
              value={filterForm.observedDateTo}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  observedDateTo: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>対戦数 下限</span>
            <input
              type="number"
              min="0"
              value={filterForm.minMatches}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  minMatches: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>対戦数 上限</span>
            <input
              type="number"
              min="0"
              value={filterForm.maxMatches}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  maxMatches: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>和了率 下限</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={filterForm.minWinRate}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  minWinRate: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>放銃率 上限</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={filterForm.maxDealInRate}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  maxDealInRate: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>平均順位 上限</span>
            <input
              type="number"
              min="1"
              max="4"
              step="0.01"
              value={filterForm.maxAvgPlace}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  maxAvgPlace: event.target.value
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="summary-grid">
        <div className="summary-tile">
          <Gauge size={20} aria-hidden="true" />
          <span>最新の平均順位</span>
          <strong>{latest ? formatDecimal(latest.avg_place) : "-"}</strong>
        </div>
        <div className="summary-tile">
          <Activity size={20} aria-hidden="true" />
          <span>最新の和了率 / 放銃率</span>
          <strong>
            {latest ? `${formatRate(latest.win_rate)} / ${formatRate(latest.deal_in_rate)}` : "-"}
          </strong>
        </div>
        <div className="summary-tile">
          <ShieldAlert size={20} aria-hidden="true" />
          <span>最新の対戦数差分</span>
          <strong>{latestDelta ? formatNumber(latestDelta.matches_delta) : "-"}</strong>
        </div>
        <div className="summary-tile">
          <Flag size={20} aria-hidden="true" />
          <span>段位 / 昇格まで</span>
          <strong>
            {rankPointAnalysis?.remaining_points == null
              ? rankLabel(latest)
              : `${rankLabel(latest)} / ${formatNumber(rankPointAnalysis.remaining_points)}pt`}
          </strong>
        </div>
      </section>

      <section className="analysis-tab-bar" role="tablist" aria-label="詳細分析カテゴリ">
        {analysisTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <div className={analysisTabPanelClass("overview", activeTab)}>
      <section className="analysis-section">
        <div className="section-heading">
          <h2>分析目標</h2>
          <p>設定ページで目標値を変更できます。</p>
        </div>
        {goalStatuses.length === 0 ? (
          <p className="empty-state">有効な分析目標はありません。</p>
        ) : (
          <>
            <div className="goal-grid">
              {goalStatuses.map((goal) => (
                <article className="goal-tile" key={goal.id}>
                  <div className="period-tile-header">
                    <strong>{goal.label}</strong>
                    <span
                      className={`quality-pill ${
                        goal.achieved == null
                          ? "quality-insufficient_data"
                          : goal.achieved
                            ? "quality-ok"
                            : "quality-limited_data"
                      }`}
                    >
                      {goal.achieved == null ? "未判定" : goal.achieved ? "達成" : "未達"}
                    </span>
                  </div>
                  <dl className="period-metrics">
                    <div>
                      <dt>現在</dt>
                      <dd>{goalValueText(goal, goal.current_value)}</dd>
                    </div>
                    <div>
                      <dt>目標</dt>
                      <dd>
                        {goal.direction === "at_most" ? "≦ " : "≧ "}
                        {goalValueText(goal, goal.target_value)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            {goalGapComments.length > 0 ? (
              <div className="priority-list">
                {goalGapComments.map((comment) => (
                  <article className="comment-item" key={comment.id}>
                    <span className={`severity-pill severity-${comment.severity}`}>
                      {comment.severity === "risk" ? "危" : "注"}
                    </span>
                    <div className="priority-body">
                      <h3>{comment.title}</h3>
                      <p>{comment.message}</p>
                      <p>
                        現在 {formatDecimal(comment.current_value)} / 目標{" "}
                        {formatDecimal(comment.target_value)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>カスタム指標</h2>
          <p>設定ページで追加した式を、最新スナップショットに対して計算します。</p>
        </div>
        {customMetricResults.length === 0 ? (
          <p className="empty-state">カスタム指標はありません。</p>
        ) : (
          <div className="goal-grid">
            {customMetricResults.map((result) => (
              <article className="goal-tile" key={result.definition.id}>
                <div className="period-tile-header">
                  <strong>{result.definition.label}</strong>
                  <span>{result.definition.unit}</span>
                </div>
                <dl className="period-metrics">
                  <div>
                    <dt>最新値</dt>
                    <dd>{metricUnitValue(result.value, result.definition.unit)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="analysis-section rank-point-section">
        <div className="section-heading">
          <h2>段位ポイント分析</h2>
          <p>{latestMode ? GAME_MODE_LABELS[latestMode] : "すべて"}</p>
        </div>
        {!rankPointAnalysis ? (
          <p className="empty-state">まだ段位ポイント分析はありません。</p>
        ) : (
          <div className="rank-point-grid">
            <div className="rank-point-panel rank-point-main">
              <div className="rank-point-title">
                <span>現在</span>
                <strong>{rankLabel(latest)}</strong>
              </div>
              <div className="rank-progress-bar" aria-label="段位ポイント進捗">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, rankPointAnalysis.progress_rate ?? 0))}%`
                  }}
                />
              </div>
              <dl className="rank-point-metrics">
                <div>
                  <dt>ポイント</dt>
                  <dd>
                    {rankPointAnalysis.current_points == null
                      ? "-"
                      : `${formatNumber(rankPointAnalysis.current_points)} / ${formatNumber(rankPointAnalysis.point_max)}`}
                  </dd>
                </div>
                <div>
                  <dt>進捗</dt>
                  <dd>{formatRate(rankPointAnalysis.progress_rate)}</dd>
                </div>
                <div>
                  <dt>昇格まで</dt>
                  <dd>
                    {rankPointAnalysis.remaining_points == null
                      ? "-"
                      : `${formatNumber(rankPointAnalysis.remaining_points)}pt`}
                  </dd>
                </div>
                <div>
                  <dt>概算必要対戦数</dt>
                  <dd>
                    {rankPointAnalysis.projected_matches_to_promotion == null
                      ? "-"
                      : `${formatNumber(rankPointAnalysis.projected_matches_to_promotion)}戦`}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rank-point-panel">
              <div className="rank-point-title">
                <span>前回から</span>
                <strong>{formatSignedNumber(rankPointAnalysis.point_delta)}pt</strong>
              </div>
              <dl className="rank-point-metrics compact">
                <div>
                  <dt>比較対象</dt>
                  <dd>
                    {rankPointAnalysis.rank_changed_since_previous
                      ? "段位変更後のため未比較"
                      : `${formatNumber(rankPointAnalysis.previous_points)}pt`}
                  </dd>
                </div>
                <div>
                  <dt>対戦数差分</dt>
                  <dd>
                    {rankPointAnalysis.matches_delta == null
                      ? "-"
                      : `${formatNumber(rankPointAnalysis.matches_delta)}戦`}
                  </dd>
                </div>
                <div>
                  <dt>pt / 戦</dt>
                  <dd>{formatDecimal(rankPointAnalysis.points_per_match)}</dd>
                </div>
                <div>
                  <dt>状態</dt>
                  <dd>
                    {rankPointAnalysis.status === "ready"
                      ? "分析可能"
                      : rankPointAnalysis.status === "missing_cap"
                        ? "上限未設定"
                        : "ポイント未入力"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>攻撃タイプ</h2>
          <p>立直率・副露率・和了率・放銃率から現在の傾向を分類します。</p>
        </div>
        {!attackStyle ? (
          <p className="empty-state">攻撃タイプの判定には記録が必要です。</p>
        ) : (
          <article className="comment-item">
            <span className={`severity-pill severity-${attackStyle.status}`}>
              {attackStyle.status === "good"
                ? "良"
                : attackStyle.status === "watch"
                  ? "注"
                  : "危"}
            </span>
            <div className="priority-body">
              <h3>{attackStyle.label}</h3>
              <p>{attackStyle.summary}</p>
              <p>{attackStyle.focus.join(" / ")}</p>
            </div>
          </article>
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>直近期間</h2>
          <p>{latestMode ? GAME_MODE_LABELS[latestMode] : "すべて"}</p>
        </div>
        <div className="period-grid">
          {periodAnalyses.length === 0 ? (
            <p className="empty-state">まだ期間分析はありません。</p>
          ) : (
            periodAnalyses.map((period) => (
              <div className="period-tile" key={period.label}>
                <div className="period-tile-header">
                  <strong>{period.label}</strong>
                  <span>{period.actual_matches > 0 ? `${period.actual_matches}戦` : "-"}</span>
                </div>
                {period.quality === "insufficient_data" ? (
                  <p className="period-empty">記録不足</p>
                ) : (
                  <dl className="period-metrics">
                    <div>
                      <dt>平均順位</dt>
                      <dd>{formatDecimal(period.period_avg_place)}</dd>
                    </div>
                    <div>
                      <dt>和了率</dt>
                      <dd>{formatRate(period.period_win_rate)}</dd>
                    </div>
                    <div>
                      <dt>放銃率</dt>
                      <dd>{formatRate(period.period_deal_in_rate)}</dd>
                    </div>
                    <div>
                      <dt>攻守差</dt>
                      <dd>{formatDecimal(period.attack_defense_gap)}</dd>
                    </div>
                  </dl>
                )}
                <span className={`quality-pill quality-${period.quality}`}>
                  {period.quality === "ok"
                    ? "良好"
                    : period.quality === "limited_data"
                      ? "概算"
                      : "不足"}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      </div>

      <div className={analysisTabPanelClass("riichi", activeTab)}>
      <section className="analysis-section">
        <div className="section-heading">
          <h2>立直トレンド</h2>
          <p>直近期の立直率と、和了率・放銃率の組み合わせを確認します。</p>
        </div>
        <div className="period-grid">
          {riichiTrendAnalyses.map((trend) => (
            <article className="period-tile" key={trend.label}>
              <div className="period-tile-header">
                <strong>{trend.label}</strong>
                <span>{trend.actual_matches > 0 ? `${trend.actual_matches}戦` : "-"}</span>
              </div>
              <dl className="period-metrics">
                <div>
                  <dt>立直率</dt>
                  <dd>{formatRate(trend.riichi_rate)}</dd>
                </div>
                <div>
                  <dt>和了率</dt>
                  <dd>{formatRate(trend.win_rate)}</dd>
                </div>
                <div>
                  <dt>放銃率</dt>
                  <dd>{formatRate(trend.deal_in_rate)}</dd>
                </div>
                <div>
                  <dt>バランス</dt>
                  <dd>{formatDecimal(trend.balance_gap)}</dd>
                </div>
              </dl>
              <p className="period-empty">{trend.message}</p>
              <span className={`quality-pill quality-${trend.status}`}>
                {trend.status === "good"
                  ? "良好"
                  : trend.status === "watch"
                    ? "注意"
                    : trend.status === "risk"
                      ? "危険"
                      : "不足"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>立直リスクシグナル</h2>
          <p>立直率と攻守指標の組み合わせから、確認すべき兆候を抽出します。</p>
        </div>
        {riichiRiskSignals.length === 0 ? (
          <p className="empty-state">大きな立直リスクシグナルはありません。</p>
        ) : (
          <div className="priority-list">
            {riichiRiskSignals.map((signal) => (
              <article className="comment-item" key={signal.id}>
                <span className={`severity-pill severity-${signal.severity}`}>
                  {signal.severity === "risk" ? "危" : "注"}
                </span>
                <div className="priority-body">
                  <h3>{signal.title}</h3>
                  <p>{signal.message}</p>
                  <p>{signal.focus.join(" / ")}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>

      <div className={analysisTabPanelClass("detail", activeTab)}>
      <section className="analysis-section">
        <div className="section-heading">
          <h2>指標分布</h2>
          <p>現在の分析対象内で、最新値が平均からどの程度離れているかを確認します。</p>
        </div>
        <article className="comment-item">
          <span className={`severity-pill severity-${stabilityScore.status}`}>
            {stabilityScore.status === "stable"
              ? "安"
              : stabilityScore.status === "watch"
                ? "注"
                : stabilityScore.status === "volatile"
                  ? "揺"
                  : "不"}
          </span>
          <div className="priority-body">
            <h3>
              安定性スコア{" "}
              {stabilityScore.score == null ? "-" : formatNumber(stabilityScore.score)}
            </h3>
            <p>{stabilityScore.summary}</p>
            {stabilityScore.volatile_metrics.length > 0 ||
            stabilityScore.watch_metrics.length > 0 ? (
              <p>
                変動大: {stabilityScore.volatile_metrics.join(" / ") || "-"} / 注意:{" "}
                {stabilityScore.watch_metrics.join(" / ") || "-"}
              </p>
            ) : null}
          </div>
        </article>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>指標</th>
                <th>件数</th>
                <th>最新</th>
                <th>平均</th>
                <th>中央値</th>
                <th>範囲</th>
                <th>平均との差</th>
                <th>安定性</th>
              </tr>
            </thead>
            <tbody>
              {metricDistributions.map((distribution) => (
                <tr key={distribution.key}>
                  <td>{distribution.label}</td>
                  <td>{formatNumber(distribution.count)}</td>
                  <td>{metricUnitValue(distribution.latest_value, distribution.unit)}</td>
                  <td>{metricUnitValue(distribution.average, distribution.unit)}</td>
                  <td>{metricUnitValue(distribution.median, distribution.unit)}</td>
                  <td>
                    {metricUnitValue(distribution.min, distribution.unit)} -{" "}
                    {metricUnitValue(distribution.max, distribution.unit)}
                  </td>
                  <td>
                    {distribution.latest_delta_from_average != null &&
                    distribution.latest_delta_from_average > 0
                      ? "+"
                      : ""}
                    {metricUnitValue(distribution.latest_delta_from_average, distribution.unit)}
                  </td>
                  <td>
                    <span className={`quality-pill quality-${distribution.stability}`}>
                      {distribution.stability === "stable"
                        ? "安定"
                        : distribution.stability === "watch"
                          ? "注意"
                          : distribution.stability === "volatile"
                            ? "変動大"
                            : "不足"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>期間比較</h2>
          <p>直近窓と月単位の平均値を比較します。</p>
        </div>
        <div className="period-comparison-grid">
          {periodComparisons.map((comparison) => (
            <article className="period-comparison-card" key={comparison.id}>
              <div className="period-tile-header">
                <strong>{comparison.label}</strong>
                <span>
                  {comparison.quality === "ok"
                    ? "比較可能"
                    : comparison.quality === "limited_data"
                      ? "データ少"
                      : "不足"}
                </span>
              </div>
              <p>
                {comparison.from_label} {comparison.from_count}件 / {comparison.to_label} {comparison.to_count}件
              </p>
              <div className="table-scroll compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>指標</th>
                      <th>{comparison.from_label}</th>
                      <th>{comparison.to_label}</th>
                      <th>差分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.metrics.map((metric) => (
                      <tr key={metric.key}>
                        <td>{metric.label}</td>
                        <td>{metricUnitValue(metric.from_value, metric.unit)}</td>
                        <td>{metricUnitValue(metric.to_value, metric.unit)}</td>
                        <td className={`comparison-delta ${metricTone(metric.delta, metric.better_direction)}`}>
                          {metric.delta != null && metric.delta > 0 ? "+" : ""}
                          {metricUnitValue(metric.delta, metric.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </section>
      </div>

      <div className={analysisTabPanelClass("improvement", activeTab)}>
      <section className="analysis-section">
        <div className="section-heading">
          <h2>改善優先度</h2>
          <p>{improvementPriorities.length > 0 ? `${improvementPriorities.length}件` : "課題なし"}</p>
        </div>
        {improvementPriorities.length === 0 ? (
          <p className="empty-state">大きく悪化している指標はありません。</p>
        ) : (
          <div className="priority-list">
            {improvementPriorities.map((priority) => (
              <article className="priority-item" key={priority.id}>
                <div className="priority-score">
                  <span className={`severity-pill severity-${priority.severity}`}>
                    {priority.severity === "high"
                      ? "高"
                      : priority.severity === "medium"
                        ? "中"
                        : "低"}
                  </span>
                  <strong>{priority.score}</strong>
                </div>
                <div className="priority-body">
                  <h3>{priority.title}</h3>
                  <p>{priority.reason}</p>
                  <p>{priority.action}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>悪化要因ランキング</h2>
          <p>直近10件とその前10件を比較し、悪化幅の大きい指標を表示します。</p>
        </div>
        {regressionFactors.length === 0 ? (
          <p className="empty-state">大きく悪化している直近期の要因はありません。</p>
        ) : (
          <div className="priority-list">
            {regressionFactors.map((factor) => (
              <article className="priority-item" key={factor.key}>
                <div className="priority-score">
                  <span className={`severity-pill severity-${factor.severity}`}>
                    {factor.severity === "high"
                      ? "高"
                      : factor.severity === "medium"
                        ? "中"
                        : "低"}
                  </span>
                  <strong>{factor.score}</strong>
                </div>
                <div className="priority-body">
                  <h3>{factor.label}</h3>
                  <p>{factor.message}</p>
                  <p>
                    前回 {metricUnitValue(factor.previous_value, factor.unit)} / 直近{" "}
                    {metricUnitValue(factor.current_value, factor.unit)} / 差分{" "}
                    {factor.delta != null && factor.delta > 0 ? "+" : ""}
                    {metricUnitValue(factor.delta, factor.unit)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>見るべき項目</h2>
          <p>現在の数値から、次に確認すると効果が大きい観点を提示します。</p>
        </div>
        <div className="priority-list">
          {focusRecommendations.map((recommendation) => (
            <article className="comment-item" key={recommendation.id}>
              <span className={`severity-pill severity-${recommendation.priority}`}>
                {recommendation.priority === "high"
                  ? "高"
                  : recommendation.priority === "medium"
                    ? "中"
                    : "低"}
              </span>
              <div className="priority-body">
                <h3>{recommendation.title}</h3>
                <p>{recommendation.reason}</p>
                <p>{recommendation.check_items.join(" / ")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>分析テンプレート</h2>
          <p>目的別に最新値をチェックします。</p>
        </div>
        <div className="priority-list">
          {analysisTemplateReports.map((report) => (
            <article className="comment-item" key={report.id}>
              <span className={`severity-pill severity-${report.status}`}>
                {report.status === "good"
                  ? "良"
                  : report.status === "watch"
                    ? "注"
                    : report.status === "risk"
                      ? "危"
                      : "不"}
              </span>
              <div className="priority-body">
                <h3>{report.title}</h3>
                <p>{report.summary}</p>
                <p>{report.focus.join(" / ")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>変化点</h2>
          <p>最新値が過去平均から大きくズレた指標を表示します。</p>
        </div>
        {outlierSignals.length === 0 ? (
          <p className="empty-state">大きな変化点は検出されていません。</p>
        ) : (
          <div className="priority-list">
            {outlierSignals.map((signal) => (
              <article className="comment-item" key={signal.id}>
                <span className={`severity-pill severity-${signal.severity}`}>
                  {signal.severity === "risk" ? "危" : "注"}
                </span>
                <div className="priority-body">
                  <h3>{signal.label}</h3>
                  <p>{signal.message}</p>
                  <p>
                    現在 {formatDecimal(signal.current_value)} / 過去平均{" "}
                    {formatDecimal(signal.baseline_value)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>

      <div className={analysisTabPanelClass("detail", activeTab)}>
      <section className="analysis-section">
        <div className="section-heading">
          <h2>自由選択チャート</h2>
          <p>表示したい指標を選択して時系列で確認します。</p>
        </div>
        <div className="chart-metric-picker">
          {chartMetricOptions.map((option) => (
            <label className="checkbox-row" key={option.key}>
              <input
                type="checkbox"
                checked={selectedChartMetrics.includes(option.key)}
                onChange={(event) =>
                  setSelectedChartMetrics((current) =>
                    event.target.checked
                      ? [...current, option.key]
                      : current.filter((key) => key !== option.key)
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {selectedChartLines.length === 0 ? (
          <p className="empty-state">表示する指標を選択してください。</p>
        ) : (
          <TrendChart
            title="選択指標"
            data={chartData}
            lines={selectedChartLines}
          />
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>タグ別分析</h2>
          <p>メモ内の #タグ ごとに平均値を集計します。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>タグ</th>
                <th>件数</th>
                <th>平均順位</th>
                <th>和了率</th>
                <th>放銃率</th>
                <th>四位率</th>
              </tr>
            </thead>
            <tbody>
              {tagAnalyses.length === 0 ? (
                <tr>
                  <td colSpan={6}>メモに #タグ を追加すると集計できます。</td>
                </tr>
              ) : (
                tagAnalyses.map((analysis) => (
                  <tr key={analysis.tag}>
                    <td>#{analysis.tag}</td>
                    <td>{formatNumber(analysis.snapshot_count)}</td>
                    <td>{formatDecimal(analysis.avg_place)}</td>
                    <td>{formatRate(analysis.win_rate)}</td>
                    <td>{formatRate(analysis.deal_in_rate)}</td>
                    <td>{formatRate(analysis.fourth_rate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>分析コメント</h2>
          <p>最新値と直近期から自動生成します。</p>
        </div>
        {analysisComments.length === 0 ? (
          <p className="empty-state">分析コメントはまだありません。</p>
        ) : (
          <div className="priority-list">
            {analysisComments.map((comment) => (
              <article className="comment-item" key={comment.id}>
                <span className={`severity-pill severity-${comment.severity}`}>
                  {comment.severity === "good"
                    ? "良"
                    : comment.severity === "watch"
                      ? "注"
                      : "危"}
                </span>
                <div className="priority-body">
                  <h3>{comment.title}</h3>
                  <p>{comment.message}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="chart-grid">
        <TrendChart
          title="平均順位"
          data={chartData}
          lines={[{ dataKey: "avg_place", label: "平均順位", color: "#1f6f8b" }]}
        />
        <TrendChart
          title="和了率と放銃率"
          data={chartData}
          lines={[
            { dataKey: "win_rate", label: "和了率", color: "#117a65" },
            { dataKey: "deal_in_rate", label: "放銃率", color: "#b23b3b" }
          ]}
        />
        <TrendChart
          title="攻守差"
          data={chartData}
          lines={[
            { dataKey: "attack_defense_gap", label: "差分", color: "#7f5f01" }
          ]}
        />
        <TrendChart
          title="副露率と立直率"
          data={chartData}
          lines={[
            { dataKey: "call_rate", label: "副露率", color: "#2f6fed" },
            { dataKey: "riichi_rate", label: "立直率", color: "#b0477d" }
          ]}
        />
        <TrendChart
          title="上位率と下位率"
          data={chartData}
          lines={[
            { dataKey: "top_two_rate", label: "1-2位率", color: "#147d64" },
            { dataKey: "bottom_two_rate", label: "3-4位率", color: "#9b3b3b" }
          ]}
        />
        <TrendChart
          title="段位ポイント進捗"
          data={chartData.filter((point) => point.rank_point_progress != null)}
          lines={[
            { dataKey: "rank_point_progress", label: "進捗率", color: "#3d5a80" }
          ]}
        />
      </div>

      <section className="table-section">
        <div className="section-heading">
          <h2>期間差分の推定</h2>
          <p>期間内の率は、丸められた累積スクリーンショットから推定しています。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>開始</th>
                <th>終了</th>
                <th>対戦数</th>
                <th>和了率</th>
                <th>放銃率</th>
                <th>副露率</th>
                <th>立直率</th>
                <th>品質</th>
              </tr>
            </thead>
            <tbody>
              {displayDeltas.length === 0 ? (
                <tr>
                  <td colSpan={8}>まだ差分はありません。</td>
                </tr>
              ) : (
                displayDeltas.map((delta) => (
                  <tr key={`${delta.from_snapshot_id}-${delta.to_snapshot_id}`}>
                    <td>{formatDateTime(delta.from_observed_at_utc)}</td>
                    <td>{formatDateTime(delta.to_observed_at_utc)}</td>
                    <td>{delta.matches_delta}</td>
                    <td>{formatRate(delta.period_win_rate)}</td>
                    <td>{formatRate(delta.period_deal_in_rate)}</td>
                    <td>{formatRate(delta.period_call_rate)}</td>
                    <td>{formatRate(delta.period_riichi_rate)}</td>
                    <td>{delta.quality}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </main>
  );
}
