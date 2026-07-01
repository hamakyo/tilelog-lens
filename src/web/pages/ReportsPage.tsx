import { useEffect, useMemo, useState } from "react";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import { GAME_MODE_LABELS, GAME_MODES } from "../../shared/constants";
import {
  buildPeriodReports,
  type PeriodReport,
  type ReportPeriod
} from "../../shared/reports";
import type { Snapshot } from "../../shared/types";
import { listSnapshots } from "../lib/api";
import { formatDateTime, formatDecimal, formatNumber, formatRate } from "../lib/format";

const reportPeriodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "week", label: "週次" },
  { value: "month", label: "月次" }
];

function reportQualityLabel(quality: PeriodReport["quality"]): string {
  if (quality === "ok") return "推定あり";
  if (quality === "limited_data") return "差分不足";
  return "記録不足";
}

export function ReportsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("week");
  const [selectedMode, setSelectedMode] = useState<Snapshot["game_mode"] | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSnapshots()
      .then((result) => setSnapshots(result.items))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。")
      )
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
  const reports = useMemo(
    () => buildPeriodReports(displaySnapshots, selectedPeriod),
    [displaySnapshots, selectedPeriod]
  );
  const latestReport = reports[0];
  const totalEstimatedMatches = reports.reduce(
    (sum, report) => sum + (report.matches_delta ?? 0),
    0
  );
  const actionableReportCount = reports.filter((report) =>
    report.recommended_actions.some((action) => !action.startsWith("大きな警戒項目"))
  ).length;

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">レポート</p>
          <h1>週次・月次レポート</h1>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">記録を読み込んでいます...</p> : null}

      <section className="filter-bar" aria-label="レポート種別">
        {reportPeriodOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={selectedPeriod === option.value ? "active" : ""}
            onClick={() => setSelectedPeriod(option.value)}
          >
            {option.label}
          </button>
        ))}
      </section>

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
          <FileText size={20} aria-hidden="true" />
          <span>レポート数</span>
          <strong>{formatNumber(reports.length)}</strong>
        </div>
        <div className="summary-tile">
          <CalendarDays size={20} aria-hidden="true" />
          <span>最新レポート</span>
          <strong>{latestReport?.period_key ?? "-"}</strong>
        </div>
        <div className="summary-tile">
          <FileText size={20} aria-hidden="true" />
          <span>推定対象対戦数</span>
          <strong>{formatNumber(totalEstimatedMatches)}</strong>
        </div>
        <div className="summary-tile">
          <CalendarDays size={20} aria-hidden="true" />
          <span>確認項目あり</span>
          <strong>{formatNumber(actionableReportCount)}</strong>
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading inline-heading">
          <div>
            <h2>{selectedPeriod === "week" ? "週次レポート" : "月次レポート"}</h2>
            <p>同じゲームモード内の累積値から、期間内の推定差分を作成します。</p>
          </div>
        </div>
        {reports.length === 0 ? (
          <p className="empty-state">表示できるレポートはありません。</p>
        ) : (
          <div className="period-grid">
            {reports.slice(0, 6).map((report) => (
              <article className="period-tile" key={report.id}>
                <div className="period-tile-header">
                  <strong>{report.label}</strong>
                  <span className={`quality-pill quality-${report.quality}`}>
                    {reportQualityLabel(report.quality)}
                  </span>
                </div>
                <dl className="period-metrics">
                  <div>
                    <dt>記録数</dt>
                    <dd>{formatNumber(report.snapshot_count)}</dd>
                  </div>
                  <div>
                    <dt>対戦差分</dt>
                    <dd>{formatNumber(report.matches_delta)}</dd>
                  </div>
                  <div>
                    <dt>平均順位</dt>
                    <dd>{formatDecimal(report.latest_metrics.avg_place)}</dd>
                  </div>
                  <div>
                    <dt>和了 / 放銃</dt>
                    <dd>
                      {formatRate(report.period_metrics?.period_win_rate)} /{" "}
                      {formatRate(report.period_metrics?.period_deal_in_rate)}
                    </dd>
                  </div>
                </dl>
                <p className="period-empty">{report.findings[0]}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>レポート詳細</h2>
          <p>最新の期間から順に表示します。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>期間</th>
                <th>モード</th>
                <th>範囲</th>
                <th>対戦差分</th>
                <th>最新平均順位</th>
                <th>期間和了率</th>
                <th>期間放銃率</th>
                <th>次に見る項目</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={8}>記録を追加するとレポートを表示できます。</td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.period_key}</td>
                    <td>{GAME_MODE_LABELS[report.game_mode]}</td>
                    <td>
                      {formatDateTime(report.from_observed_at_utc)} -{" "}
                      {formatDateTime(report.to_observed_at_utc)}
                    </td>
                    <td>{formatNumber(report.matches_delta)}</td>
                    <td>{formatDecimal(report.latest_metrics.avg_place)}</td>
                    <td>{formatRate(report.period_metrics?.period_win_rate)}</td>
                    <td>{formatRate(report.period_metrics?.period_deal_in_rate)}</td>
                    <td>{report.recommended_actions[0]}</td>
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
