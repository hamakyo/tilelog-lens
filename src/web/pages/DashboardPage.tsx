import { useEffect, useMemo, useState } from "react";
import { Activity, Gauge, ShieldAlert } from "lucide-react";
import type { EstimatedDelta, Snapshot } from "../../shared/types";
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
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Load failed."))
      .finally(() => setLoading(false));
  }, []);

  const latest = snapshots[0];
  const chartData = useMemo(() => toChartPoints(snapshots), [snapshots]);
  const latestDelta = deltas[deltas.length - 1];

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>TileLog Lens</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => navigate("/import")}>
          <Activity size={18} aria-hidden="true" />
          <span>New snapshot</span>
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">Loading statistics...</p> : null}

      <section className="summary-grid">
        <div className="summary-tile">
          <Gauge size={20} aria-hidden="true" />
          <span>Latest average place</span>
          <strong>{latest ? formatDecimal(latest.avg_place) : "-"}</strong>
        </div>
        <div className="summary-tile">
          <Activity size={20} aria-hidden="true" />
          <span>Latest win / deal-in</span>
          <strong>
            {latest ? `${formatRate(latest.win_rate)} / ${formatRate(latest.deal_in_rate)}` : "-"}
          </strong>
        </div>
        <div className="summary-tile">
          <ShieldAlert size={20} aria-hidden="true" />
          <span>Latest match delta</span>
          <strong>{latestDelta ? formatNumber(latestDelta.matches_delta) : "-"}</strong>
        </div>
      </section>

      <div className="chart-grid">
        <TrendChart
          title="Average Place"
          data={chartData}
          lines={[{ dataKey: "avg_place", label: "Average place", color: "#1f6f8b" }]}
        />
        <TrendChart
          title="Win And Deal-In"
          data={chartData}
          lines={[
            { dataKey: "win_rate", label: "Win", color: "#117a65" },
            { dataKey: "deal_in_rate", label: "Deal-in", color: "#b23b3b" }
          ]}
        />
        <TrendChart
          title="Attack Defense Gap"
          data={chartData}
          lines={[
            { dataKey: "attack_defense_gap", label: "Gap", color: "#7f5f01" }
          ]}
        />
        <TrendChart
          title="Call And Riichi"
          data={chartData}
          lines={[
            { dataKey: "call_rate", label: "Call", color: "#2f6fed" },
            { dataKey: "riichi_rate", label: "Riichi", color: "#b0477d" }
          ]}
        />
        <TrendChart
          title="Top Two And Bottom Two"
          data={chartData}
          lines={[
            { dataKey: "top_two_rate", label: "Top two", color: "#147d64" },
            { dataKey: "bottom_two_rate", label: "Bottom two", color: "#9b3b3b" }
          ]}
        />
        <TrendChart
          title="Rank Points"
          data={chartData.filter((point) => point.rank_points != null)}
          lines={[{ dataKey: "rank_points", label: "Rank points", color: "#3d5a80" }]}
        />
      </div>

      <section className="table-section">
        <div className="section-heading">
          <h2>Period Delta Estimates</h2>
          <p>Period rates are estimated from rounded cumulative screenshots.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Matches</th>
                <th>Win</th>
                <th>Deal-in</th>
                <th>Call</th>
                <th>Riichi</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {deltas.length === 0 ? (
                <tr>
                  <td colSpan={8}>No deltas yet.</td>
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
