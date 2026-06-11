import { useEffect, useMemo, useState } from "react";
import { Activity, Flag, Gauge, ShieldAlert } from "lucide-react";
import type { EstimatedDelta, Snapshot } from "../../shared/types";
import {
  GAME_MODE_LABELS,
  GAME_MODES,
  RANK_LEVEL_LABELS,
  RANK_LEVELS,
  RANK_NAME_LABELS,
  RANK_POINT_MAX_BY_RANK_AND_LEVEL
} from "../../shared/constants";
import {
  buildEstimatedDeltas,
  buildImprovementPriorities,
  buildPeriodAnalyses,
  buildRankPointAnalysis
} from "../../shared/metrics";
import { listDeltas, listSnapshots } from "../lib/api";
import { formatDateTime, formatDecimal, formatNumber, formatRate } from "../lib/format";
import { TrendChart } from "../components/TrendChart";

type DashboardPageProps = {
  navigate: (path: string) => void;
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

export function DashboardPage({ navigate }: DashboardPageProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [deltas, setDeltas] = useState<EstimatedDelta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<Snapshot["game_mode"] | "all">("all");

  useEffect(() => {
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
  const displaySnapshots = useMemo(
    () =>
      selectedMode === "all"
        ? snapshots
        : snapshots.filter((snapshot) => snapshot.game_mode === selectedMode),
    [selectedMode, snapshots]
  );
  const latest = displaySnapshots[0];
  const latestMode = latest?.game_mode ?? (selectedMode === "all" ? null : selectedMode);
  const modeSnapshots = useMemo(
    () =>
      latestMode
        ? snapshots.filter((snapshot) => snapshot.game_mode === latestMode)
        : displaySnapshots,
    [displaySnapshots, latestMode, snapshots]
  );
  const chartData = useMemo(() => toChartPoints(displaySnapshots), [displaySnapshots]);
  const periodAnalyses = useMemo(
    () => buildPeriodAnalyses(modeSnapshots),
    [modeSnapshots]
  );
  const improvementPriorities = useMemo(
    () => buildImprovementPriorities(modeSnapshots),
    [modeSnapshots]
  );
  const rankPointAnalysis = useMemo(
    () => buildRankPointAnalysis(modeSnapshots),
    [modeSnapshots]
  );
  const displayDeltas = useMemo(
    () =>
      selectedMode === "all"
        ? deltas
        : buildEstimatedDeltas(displaySnapshots),
    [deltas, displaySnapshots, selectedMode]
  );
  const latestDelta = displayDeltas[displayDeltas.length - 1];

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">ダッシュボード</p>
          <h1>TileLog Lens</h1>
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
    </main>
  );
}
