import { useEffect, useMemo, useState } from "react";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import { GAME_MODE_LABELS } from "../../shared/constants";
import { summarizeDataQualityIssues } from "../../shared/dataQuality";
import { buildDataQualityReport } from "../../shared/analysis/dataQuality";
import type { DataQualityIssue, Snapshot } from "../../shared/types";
import { listAllSnapshots } from "../lib/api";
import { formatDateTime } from "../lib/format";

type QualityPageProps = {
  navigate: (path: string) => void;
};

export function QualityPage({ navigate }: QualityPageProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedCode, setSelectedCode] = useState<DataQualityIssue["code"] | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAllSnapshots()
      .then((result) => setSnapshots(result.items))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  const issues = useMemo(() => buildDataQualityReport(snapshots), [snapshots]);
  const issueSnapshots = useMemo(
    () => new Map(snapshots.map((snapshot) => [snapshot.id, snapshot])),
    [snapshots]
  );
  const issueCodes = useMemo(
    () =>
      Array.from(
        issues.reduce((codes, issue) => codes.add(issue.code), new Set<string>())
      ),
    [issues]
  );
  const issueSummaries = useMemo(
    () => summarizeDataQualityIssues(issues),
    [issues]
  );
  const filteredIssues = useMemo(
    () =>
      selectedCode === "all"
        ? issues
        : issues.filter((issue) => issue.code === selectedCode),
    [issues, selectedCode]
  );
  const affectedSnapshotCount = useMemo(
    () => new Set(issues.map((issue) => issue.snapshot_id)).size,
    [issues]
  );
  const filteredSnapshotCount = useMemo(
    () => new Set(filteredIssues.map((issue) => issue.snapshot_id)).size,
    [filteredIssues]
  );

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">品質</p>
          <h1>データ品質レポート</h1>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">記録を読み込んでいます...</p> : null}

      <section className="summary-grid">
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>警告件数</span>
          <strong>{issues.length}</strong>
        </div>
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>記録数</span>
          <strong>{snapshots.length}</strong>
        </div>
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>影響記録</span>
          <strong>{affectedSnapshotCount}</strong>
        </div>
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>警告種別</span>
          <strong>{issueCodes.length}</strong>
        </div>
      </section>

      <section className="filter-bar" aria-label="品質警告の絞り込み">
        <button
          type="button"
          className={selectedCode === "all" ? "active" : ""}
          onClick={() => setSelectedCode("all")}
        >
          すべて
        </button>
        {issueSummaries.map((summary) => (
          <button
            key={summary.code}
            type="button"
            className={selectedCode === summary.code ? "active" : ""}
            onClick={() => setSelectedCode(summary.code)}
          >
            {summary.label}
          </button>
        ))}
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>問題種別サマリー</h2>
          <p>件数が多い順に、分析前に確認すべき内容を表示します。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>種別</th>
                <th>件数</th>
                <th>コード</th>
                <th>確認内容</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {issueSummaries.length === 0 ? (
                <tr>
                  <td colSpan={5}>品質上の警告はありません。</td>
                </tr>
              ) : (
                issueSummaries.map((summary) => (
                  <tr key={summary.code}>
                    <td>{summary.label}</td>
                    <td>{summary.count}</td>
                    <td>
                      <span className="code-pill">{summary.code}</span>
                    </td>
                    <td>{summary.action}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => setSelectedCode(summary.code)}
                      >
                        絞り込み
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>修正候補</h2>
          <p>
            {selectedCode === "all"
              ? `累積値、順位率、重複候補から確認が必要な記録を抽出します。`
              : `${filteredIssues.length}件 / ${filteredSnapshotCount}記録に絞り込んでいます。`}
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>モード</th>
                <th>記録</th>
                <th>コード</th>
                <th>内容</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={6}>確認が必要な記録はありません。</td>
                </tr>
              ) : (
                filteredIssues.map((issue) => {
                  const snapshot = issueSnapshots.get(issue.snapshot_id);
                  return (
                    <tr key={`${issue.snapshot_id}-${issue.code}-${issue.message}`}>
                      <td>{formatDateTime(issue.observed_at_utc)}</td>
                      <td>{GAME_MODE_LABELS[issue.game_mode]}</td>
                      <td>
                        #{issue.snapshot_id}
                        {snapshot ? ` / ${snapshot.matches}戦` : ""}
                      </td>
                      <td>
                        <span className="code-pill">{issue.code}</span>
                      </td>
                      <td>{issue.message}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => navigate(`/snapshots/${issue.snapshot_id}`)}
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
