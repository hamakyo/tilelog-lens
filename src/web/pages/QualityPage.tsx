import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { GAME_MODE_LABELS } from "../../shared/constants";
import { buildDataQualityReport } from "../../shared/metrics";
import type { Snapshot } from "../../shared/types";
import { listSnapshots } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function QualityPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSnapshots()
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
          <span>確認対象</span>
          <strong>{issues.length}</strong>
        </div>
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>記録数</span>
          <strong>{snapshots.length}</strong>
        </div>
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>警告種別</span>
          <strong>{issueCodes.length}</strong>
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>修正候補</h2>
          <p>累積値、順位率、重複候補から確認が必要な記録を抽出します。</p>
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
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={5}>確認が必要な記録はありません。</td>
                </tr>
              ) : (
                issues.map((issue) => {
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
