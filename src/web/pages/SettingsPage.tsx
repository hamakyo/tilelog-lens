import { useState } from "react";
import {
  customMetricOperands,
  customMetricOperators,
  type CustomMetricDefinition,
  type CustomMetricOperand,
  type CustomMetricOperator
} from "../../shared/customMetrics";
import { PRIVACY_DISCLAIMER } from "../../shared/constants";
import type { AnalysisGoal } from "../../shared/types";
import {
  loadAnalysisGoals,
  resetAnalysisGoals,
  saveAnalysisGoals
} from "../lib/analysisGoals";
import {
  loadCustomMetrics,
  resetCustomMetrics,
  saveCustomMetrics
} from "../lib/customMetrics";
import {
  buildPreferencesFromIds,
  dashboardCardDefinitions,
  dashboardCardPresetLabels,
  dashboardCardPresets,
  loadDashboardCardPreferences,
  resetDashboardCardPreferences,
  saveDashboardCardPreferences,
  type DashboardCardId,
  type DashboardCardPreference,
  type DashboardCardPresetId
} from "../lib/dashboardCards";
import type { SidebarPreference } from "../lib/sidebar";
import type { ThemePreference } from "../lib/theme";

type SettingsPageProps = {
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  sidebarPreference: SidebarPreference;
  onSidebarPreferenceChange: (preference: SidebarPreference) => void;
};

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "デバイス準拠" }
];

const sidebarOptions: Array<{ value: SidebarPreference; label: string }> = [
  { value: "expanded", label: "通常" },
  { value: "collapsed", label: "コンパクト" },
  { value: "auto", label: "自動" }
];

const emptyCustomMetricDraft: CustomMetricDefinition = {
  id: "draft",
  label: "",
  left: "win_rate",
  operator: "subtract",
  right: "deal_in_rate",
  unit: "number"
};

export function SettingsPage({
  themePreference,
  onThemePreferenceChange,
  sidebarPreference,
  onSidebarPreferenceChange
}: SettingsPageProps) {
  const [goals, setGoals] = useState<AnalysisGoal[]>(() => loadAnalysisGoals());
  const [customMetrics, setCustomMetrics] = useState<CustomMetricDefinition[]>(() =>
    loadCustomMetrics()
  );
  const [dashboardCards, setDashboardCards] =
    useState<DashboardCardPreference[]>(() => loadDashboardCardPreferences());
  const [customMetricDraft, setCustomMetricDraft] =
    useState<CustomMetricDefinition>(emptyCustomMetricDraft);
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

  function handleAddCustomMetric() {
    const label = customMetricDraft.label.trim();
    if (!label) {
      setMessage("カスタム指標名を入力してください。");
      return;
    }
    if (customMetricDraft.left === customMetricDraft.right) {
      setMessage("左右に異なる指標を選択してください。");
      return;
    }

    setCustomMetrics((current) => [
      ...current,
      {
        ...customMetricDraft,
        id: `custom-${Date.now()}`,
        label
      }
    ]);
    setCustomMetricDraft(emptyCustomMetricDraft);
    setMessage("カスタム指標を追加しました。保存すると反映されます。");
  }

  function handleSaveCustomMetrics() {
    saveCustomMetrics(customMetrics);
    setMessage("カスタム指標を保存しました。");
  }

  function handleResetCustomMetrics() {
    setCustomMetrics(resetCustomMetrics());
    setCustomMetricDraft(emptyCustomMetricDraft);
    setMessage("カスタム指標を初期値に戻しました。");
  }

  function dashboardCardDefinition(id: DashboardCardId) {
    return dashboardCardDefinitions.find((definition) => definition.id === id);
  }

  function toggleDashboardCard(id: DashboardCardId, enabled: boolean) {
    setDashboardCards((current) =>
      current.map((card) => (card.id === id ? { ...card, enabled } : card))
    );
  }

  function moveDashboardCard(id: DashboardCardId, direction: -1 | 1) {
    setDashboardCards((current) => {
      const index = current.findIndex((card) => card.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function applyDashboardCardPreset(presetId: DashboardCardPresetId) {
    setDashboardCards(buildPreferencesFromIds(dashboardCardPresets[presetId]));
    setMessage(`${dashboardCardPresetLabels[presetId]}のカード構成を適用しました。保存すると反映されます。`);
  }

  function handleSaveDashboardCards() {
    saveDashboardCardPreferences(dashboardCards);
    setMessage("ダッシュボードカード設定を保存しました。");
  }

  function handleResetDashboardCards() {
    setDashboardCards(resetDashboardCardPreferences());
    setMessage("ダッシュボードカード設定を初期値に戻しました。");
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">設定</p>
          <h1>プライバシーとデプロイ</h1>
        </div>
      </div>

      {message ? <p className="form-message">{message}</p> : null}

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>テーマ</h2>
          <p>表示テーマを選択します。</p>
        </div>
        <div className="segmented-control" role="group" aria-label="テーマ">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={themePreference === option.value ? "active" : ""}
              aria-pressed={themePreference === option.value}
              onClick={() => onThemePreferenceChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>サイドバー</h2>
          <p>PC表示のメニュー幅を選択します。</p>
        </div>
        <div className="segmented-control" role="group" aria-label="サイドバー">
          {sidebarOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={sidebarPreference === option.value ? "active" : ""}
              aria-pressed={sidebarPreference === option.value}
              onClick={() => onSidebarPreferenceChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>ダッシュボードカード</h2>
          <p>表示するカードと並び順を選択します。</p>
        </div>
        <div className="segmented-control" role="group" aria-label="カードプリセット">
          {(Object.keys(dashboardCardPresets) as DashboardCardPresetId[]).map((presetId) => (
            <button
              key={presetId}
              type="button"
              onClick={() => applyDashboardCardPreset(presetId)}
            >
              {dashboardCardPresetLabels[presetId]}
            </button>
          ))}
        </div>
        <div className="table-scroll compact-table">
          <table>
            <thead>
              <tr>
                <th>表示</th>
                <th>カード</th>
                <th>説明</th>
                <th>順序</th>
              </tr>
            </thead>
            <tbody>
              {dashboardCards.map((card, index) => {
                const definition = dashboardCardDefinition(card.id);
                return (
                  <tr key={card.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={card.enabled}
                        onChange={(event) =>
                          toggleDashboardCard(card.id, event.target.checked)
                        }
                      />
                    </td>
                    <td>{definition?.label ?? card.id}</td>
                    <td>{definition?.description ?? "-"}</td>
                    <td>
                      <div className="table-action-row">
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          disabled={index === 0}
                          onClick={() => moveDashboardCard(card.id, -1)}
                        >
                          上へ
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          disabled={index === dashboardCards.length - 1}
                          onClick={() => moveDashboardCard(card.id, 1)}
                        >
                          下へ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="form-actions split-actions">
          <button type="button" className="secondary-button" onClick={handleResetDashboardCards}>
            初期値に戻す
          </button>
          <button type="button" className="primary-button" onClick={handleSaveDashboardCards}>
            カード設定を保存
          </button>
        </div>
      </section>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>分析目標</h2>
          <p>詳細分析で最新値との達成状況を表示します。</p>
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
      </section>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>カスタム指標</h2>
          <p>許可済みの指標同士を組み合わせて、詳細分析に表示します。</p>
        </div>
        <div className="form-grid custom-metric-grid">
          <label>
            <span>表示名</span>
            <input
              type="text"
              value={customMetricDraft.label}
              onChange={(event) =>
                setCustomMetricDraft((current) => ({
                  ...current,
                  label: event.target.value
                }))
              }
              placeholder="例: 和了率 - 放銃率"
            />
          </label>
          <label>
            <span>左の指標</span>
            <select
              value={customMetricDraft.left}
              onChange={(event) =>
                setCustomMetricDraft((current) => ({
                  ...current,
                  left: event.target.value as CustomMetricOperand
                }))
              }
            >
              {Object.entries(customMetricOperands).map(([value, operand]) => (
                <option key={value} value={value}>
                  {operand.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>演算</span>
            <select
              value={customMetricDraft.operator}
              onChange={(event) =>
                setCustomMetricDraft((current) => ({
                  ...current,
                  operator: event.target.value as CustomMetricOperator
                }))
              }
            >
              {Object.entries(customMetricOperators).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>右の指標</span>
            <select
              value={customMetricDraft.right}
              onChange={(event) =>
                setCustomMetricDraft((current) => ({
                  ...current,
                  right: event.target.value as CustomMetricOperand
                }))
              }
            >
              {Object.entries(customMetricOperands).map(([value, operand]) => (
                <option key={value} value={value}>
                  {operand.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>単位</span>
            <select
              value={customMetricDraft.unit}
              onChange={(event) =>
                setCustomMetricDraft((current) => ({
                  ...current,
                  unit: event.target.value as CustomMetricDefinition["unit"]
                }))
              }
            >
              <option value="number">数値</option>
              <option value="rate">%</option>
              <option value="rank_point">pt</option>
              <option value="place">順位</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={handleResetCustomMetrics}>
            初期値に戻す
          </button>
          <button type="button" className="secondary-button" onClick={handleAddCustomMetric}>
            指標を追加
          </button>
          <button type="button" className="primary-button" onClick={handleSaveCustomMetrics}>
            指標を保存
          </button>
        </div>
        <div className="table-scroll compact-table">
          <table>
            <thead>
              <tr>
                <th>表示名</th>
                <th>式</th>
                <th>単位</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {customMetrics.length === 0 ? (
                <tr>
                  <td colSpan={4}>カスタム指標はありません。</td>
                </tr>
              ) : (
                customMetrics.map((metric) => (
                  <tr key={metric.id}>
                    <td>{metric.label}</td>
                    <td>
                      {customMetricOperands[metric.left].label}{" "}
                      {customMetricOperators[metric.operator]}{" "}
                      {customMetricOperands[metric.right].label}
                    </td>
                    <td>{metric.unit}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() =>
                          setCustomMetrics((current) =>
                            current.filter((item) => item.id !== metric.id)
                          )
                        }
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
