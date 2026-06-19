import { useEffect, useState } from "react";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import Database from "lucide-react/dist/esm/icons/database.js";
import Server from "lucide-react/dist/esm/icons/server.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import { getHealth, type HealthResponse } from "../lib/api";
import { formatDateTime } from "../lib/format";

function statusLabel(status: "ok" | "error"): string {
  return status === "ok" ? "正常" : "異常";
}

export function SystemPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = () => {
    setLoading(true);
    setError(null);
    getHealth()
      .then(setHealth)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "状態確認に失敗しました。"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">運用</p>
          <h1>システム状態</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadHealth}>
          <Activity size={18} aria-hidden="true" />
          <span>再確認</span>
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">状態を確認しています...</p> : null}

      <section className="summary-grid">
        <div className="summary-tile">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>全体状態</span>
          <strong>{health ? (health.ok ? "正常" : "異常") : "-"}</strong>
        </div>
        <div className="summary-tile">
          <Server size={20} aria-hidden="true" />
          <span>環境</span>
          <strong>{health?.environment ?? "-"}</strong>
        </div>
        <div className="summary-tile">
          <Activity size={20} aria-hidden="true" />
          <span>確認時刻</span>
          <strong>{health ? formatDateTime(health.checked_at) : "-"}</strong>
        </div>
        <div className="summary-tile">
          <Database size={20} aria-hidden="true" />
          <span>D1</span>
          <strong>{health ? statusLabel(health.checks.d1) : "-"}</strong>
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>チェック結果</h2>
          <p>認証済みユーザーだけが確認できる、最小限の稼働状態です。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>対象</th>
                <th>状態</th>
                <th>用途</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Worker</td>
                <td>
                  <span className="quality-pill quality-stable">
                    {health ? statusLabel(health.checks.worker) : "-"}
                  </span>
                </td>
                <td>APIルーティングと静的アセット配信</td>
              </tr>
              <tr>
                <td>Cloudflare D1</td>
                <td>
                  <span
                    className={`quality-pill ${
                      health?.checks.d1 === "ok" ? "quality-stable" : "quality-volatile"
                    }`}
                  >
                    {health ? statusLabel(health.checks.d1) : "-"}
                  </span>
                </td>
                <td>スナップショット、変更履歴、取込履歴の保存</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
