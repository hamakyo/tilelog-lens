import { useState } from "react";
import { PRIVACY_DISCLAIMER } from "../../shared/constants";
import type { AnalysisGoal } from "../../shared/types";
import {
  loadAnalysisGoals,
  resetAnalysisGoals,
  saveAnalysisGoals
} from "../lib/analysisGoals";

export function SettingsPage() {
  const [goals, setGoals] = useState<AnalysisGoal[]>(() => loadAnalysisGoals());
  const [message, setMessage] = useState<string | null>(null);

  function updateGoal(id: AnalysisGoal["id"], patch: Partial<AnalysisGoal>) {
    setGoals((current) =>
      current.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal))
    );
  }

  function handleSaveGoals() {
    saveAnalysisGoals(goals);
    setMessage("分析目標を保存しました。");
  }

  function handleResetGoals() {
    setGoals(resetAnalysisGoals());
    setMessage("分析目標を初期値に戻しました。");
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">設定</p>
          <h1>プライバシーとデプロイ</h1>
        </div>
      </div>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>分析目標</h2>
          <p>ダッシュボードで最新値との達成状況を表示します。</p>
        </div>
        <div className="table-scroll compact-table">
          <table>
            <thead>
              <tr>
                <th>有効</th>
                <th>指標</th>
                <th>条件</th>
                <th>目標値</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal) => (
                <tr key={goal.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={goal.enabled}
                      onChange={(event) =>
                        updateGoal(goal.id, { enabled: event.target.checked })
                      }
                    />
                  </td>
                  <td>{goal.label}</td>
                  <td>{goal.direction === "at_most" ? "以下" : "以上"}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={goal.target_value}
                      onChange={(event) =>
                        updateGoal(goal.id, {
                          target_value: Number(event.target.value)
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-actions split-actions">
          <button type="button" className="secondary-button" onClick={handleResetGoals}>
            初期値に戻す
          </button>
          <button type="button" className="primary-button" onClick={handleSaveGoals}>
            目標を保存
          </button>
        </div>
        {message ? <p className="form-message">{message}</p> : null}
      </section>

      <section className="settings-panel">
        <h2>アクセス制御</h2>
        <p>
          本番環境は、所有者メールのみを許可するCloudflare AccessのメールOTPで保護します。Worker側でもAccess JWTを検証します。
        </p>
      </section>

      <section className="settings-panel">
        <h2>スクリーンショットの扱い</h2>
        <p>
          ローカル画像の選択は、ブラウザ内のプレビュー、SHA-256、画像サイズ取得にだけ使います。APIは画像、ファイル、base64、blob、data URLを含むpayloadを拒否します。
        </p>
      </section>

      <section className="settings-panel">
        <h2>免責事項</h2>
        <p>{PRIVACY_DISCLAIMER}</p>
      </section>
    </main>
  );
}
