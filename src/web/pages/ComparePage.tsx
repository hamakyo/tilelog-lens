import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { GAME_MODE_LABELS } from "../../shared/constants";
import { buildSnapshotComparison } from "../../shared/metrics";
import type { Snapshot, SnapshotComparisonMetric } from "../../shared/types";
import { listSnapshots } from "../lib/api";
import { formatDecimal, formatNumber, formatRate } from "../lib/format";

function snapshotLabel(snapshot: Snapshot): string {
  return `${snapshot.observed_date} ${snapshot.observed_time} / ${GAME_MODE_LABELS[snapshot.game_mode]} / ${snapshot.matches}戦`;
}

function formatMetricValue(
  value: number | null,
  unit: SnapshotComparisonMetric["unit"]
): string {
  if (value == null) return "-";
  if (unit === "rate") return formatRate(value);
  if (unit === "place") return formatDecimal(value);
  if (unit === "rank_point") return `${formatNumber(value)}pt`;
  return formatNumber(value);
}

function metricTone(metric: SnapshotComparisonMetric): string {
  if (metric.delta == null || metric.delta === 0 || metric.better_direction === "neutral") {
    return "neutral";
  }
  const improved =
    metric.better_direction === "up" ? metric.delta > 0 : metric.delta < 0;
  return improved ? "good" : "bad";
}

export function ComparePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSnapshots()
      .then((result) => {
        setSnapshots(result.items);
        const ordered = [...result.items].sort((a, b) =>
          a.observed_at_utc.localeCompare(b.observed_at_utc)
        );
        setFromId(String(ordered.at(-2)?.id ?? ordered[0]?.id ?? ""));
        setToId(String(ordered.at(-1)?.id ?? ordered[0]?.id ?? ""));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  const fromSnapshot = snapshots.find((snapshot) => snapshot.id === Number(fromId));
  const toSnapshot = snapshots.find((snapshot) => snapshot.id === Number(toId));
  const comparison = useMemo(
    () =>
      fromSnapshot && toSnapshot
        ? buildSnapshotComparison(fromSnapshot, toSnapshot)
        : null,
    [fromSnapshot, toSnapshot]
  );

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">比較</p>
          <h1>スナップショット比較</h1>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">記録を読み込んでいます...</p> : null}

      <section className="form-section">
        <h2>比較対象</h2>
        <div className="form-grid compare-grid">
          <label>
            <span>開始</span>
            <select value={fromId} onChange={(event) => setFromId(event.target.value)}>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshotLabel(snapshot)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>終了</span>
            <select value={toId} onChange={(event) => setToId(event.target.value)}>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshotLabel(snapshot)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!comparison ? (
        <p className="empty-state">比較できる記録がまだありません。</p>
      ) : (
        <>
          <section className="summary-grid">
            <div className="summary-tile">
              <GitCompareArrows size={20} aria-hidden="true" />
              <span>対戦数差分</span>
              <strong>{formatNumber(comparison.matches_delta)}</strong>
            </div>
            <div className="summary-tile">
              <GitCompareArrows size={20} aria-hidden="true" />
              <span>品質</span>
              <strong>
                {comparison.quality === "ok"
                  ? "比較可能"
                  : comparison.quality === "different_mode"
                    ? "モード違い"
                    : comparison.quality === "same_matches"
                      ? "同対戦数"
                      : "逆順"}
              </strong>
            </div>
          </section>

          <section className="table-section">
            <div className="section-heading">
              <h2>指標差分</h2>
              <p>正の値が常に良いとは限らないため、改善方向を色で表示します。</p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>指標</th>
                    <th>開始</th>
                    <th>終了</th>
                    <th>差分</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.metrics.map((metric) => (
                    <tr key={metric.key}>
                      <td>{metric.label}</td>
                      <td>{formatMetricValue(metric.from_value, metric.unit)}</td>
                      <td>{formatMetricValue(metric.to_value, metric.unit)}</td>
                      <td className={`comparison-delta ${metricTone(metric)}`}>
                        {metric.delta != null && metric.delta > 0 ? "+" : ""}
                        {formatMetricValue(metric.delta, metric.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
