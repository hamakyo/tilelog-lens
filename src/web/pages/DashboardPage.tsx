import { useEffect, useMemo, useState } from "react";
import { Activity, Gauge, ShieldAlert } from "lucide-react";
import type { EstimatedDelta, Snapshot } from "../../shared/types";
import { GAME_MODE_LABELS } from "../../shared/constants";
import {
  buildImprovementPriorities,
  buildPeriodAnalyses
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
};

function toChartPoints(snapshots: Snapshot[]): ChartPoint[] {
  return [...snapshots]
    .sort((a, b) => a.observed_at_utc.localeCompare(b.observed_at_utc))
    .map((snapshot) => ({
      label: `${snapshot.observed_date} ${snapshot.observed_time}`,
      avg_place: snapshot.avg_place,
      win_rate: snapshot.win_rate,
      deal_in_rate: snapshot.deal_in_rate,
      attack_defense_gap: Number((snapshot.win_rate - snapshot.deal_in_rate).toFixed(2)),
      call_rate: snapshot.call_rate,
      riichi_rate: snapshot.riichi_rate,
      top_two_rate: Number((snapshot.first_rate + snapshot.second_rate).toFixed(2)),
      bottom_two_rate: Number((snapshot.third_rate + snapshot.fourth_rate).toFixed(2)),
      rank_points: snapshot.rank_points
    }));
}

export function DashboardPage({ navigate }: DashboardPageProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [deltas, setDeltas] = useState<EstimatedDelta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listSnapshots(), listDeltas()])
      .then(([snapshotResult, deltaResult]) => {
        setSnapshots(snapshotResult.items);
        setDeltas(deltaResult.items);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  const latest = snapshots[0];
  const modeSnapshots = useMemo(
    () =>
      latest
        ? snapshots.filter((snapshot) => snapshot.game_mode === latest.game_mode)
        : [],
    [latest, snapshots]
  );
  const chartData = useMemo(() => toChartPoints(snapshots), [snapshots]);
  const periodAnalyses = useMemo(
    () => buildPeriodAnalyses(modeSnapshots),
    [modeSnapshots]
  );
  const improvementPriorities = useMemo(
    () => buildImprovementPriorities(modeSnapshots),
    [modeSnapshots]
  );
  const latestDelta = deltas[deltas.length - 1];

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
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <h2>直近期間</h2>
          <p>{latest ? GAME_MODE_LABELS[latest.game_mode] : "-"}</p>
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
          title="段位ポイント"
          data={chartData.filter((point) => point.rank_points != null)}
          lines={[{ dataKey: "rank_points", label: "段位ポイント", color: "#3d5a80" }]}
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
              {deltas.length === 0 ? (
                <tr>
                  <td colSpan={8}>まだ差分はありません。</td>
                </tr>
              ) : (
                deltas.map((delta) => (
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
