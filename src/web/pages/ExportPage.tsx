import { useState } from "react";
import Download from "lucide-react/dist/esm/icons/download.js";
import Eye from "lucide-react/dist/esm/icons/eye.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import Upload from "lucide-react/dist/esm/icons/upload.js";
import { GAME_MODE_LABELS, GAME_MODES } from "../../shared/constants";
import { analysisScopeToSearchParams } from "../../shared/analysisFilters";
import type { AiContext, Snapshot, SnapshotCreateInput } from "../../shared/types";
import { createSnapshot } from "../lib/api";

type PreviewKind = "snapshots" | "deltas" | "ai";

type ExportPreview = {
  label: string;
  contentType: string;
  contentDisposition: string;
  lineCount: number;
  text: string;
};

type AiContextPreview = {
  schema_version?: string;
  exported_at?: string;
  privacy?: AiContext["privacy"];
  analysis_counts: {
    snapshots: number;
    derived_metrics: number;
    estimated_deltas: number;
    period_analyses: number;
    period_comparisons: number;
    metric_distributions: number;
    riichi_trends: number;
    riichi_risk_signals: number;
    improvement_priorities: number;
    regression_factors: number;
    focus_recommendations: number;
    goal_gap_comments: number;
    data_quality_issues: number;
  };
  highlights: {
    latest_observed_at_utc: string | null;
    latest_game_mode: string | null;
    latest_matches: number | null;
    attack_style: string | null;
    stability: string | null;
    top_improvement_priority: string | null;
    top_regression_factor: string | null;
  };
  summary?: AiContext["summary"];
  analysis_request?: AiContext["analysis_request"];
  snapshots_preview: AiContext["snapshots"];
};

const previewLabels: Record<PreviewKind, string> = {
  snapshots: "記録CSV",
  deltas: "差分CSV",
  ai: "AI用JSON"
};

export function ExportPage() {
  const [anonymize, setAnonymize] = useState(true);
  const [exportGameMode, setExportGameMode] = useState("all");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [aiGoal, setAiGoal] = useState("雀魂の戦績推移を分析し、改善優先度を特定してください。");
  const [aiFocus, setAiFocus] = useState(
    [
      "平均順位の推移",
      "和了率と放銃率のバランス",
      "副露率の変化",
      "立直率の変化",
      "改善優先度"
    ].join("\n")
  );
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState<PreviewKind | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [restoreItems, setRestoreItems] = useState<SnapshotCreateInput[]>([]);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  function exportPath(kind: PreviewKind): string {
    const params = analysisScopeToSearchParams({
      game_mode: exportGameMode as (typeof GAME_MODES)[number] | "all",
      observed_date_from: exportDateFrom || undefined,
      observed_date_to: exportDateTo || undefined
    });

    if (kind === "snapshots") return withParams("/api/export/snapshots.csv", params);
    if (kind === "deltas") return withParams("/api/export/deltas.csv", params);
    params.set("anonymize", String(anonymize));
    params.set("goal", aiGoal);
    params.set("focus", aiFocus);
    return withParams("/api/export/ai-context.json", params);
  }

  async function handlePreview(kind: PreviewKind) {
    setPreviewBusy(kind);
    setPreviewError(null);

    try {
      const response = await fetch(exportPath(kind));
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`プレビュー取得に失敗しました: ${response.status}`);
      }

      const contentType = response.headers.get("Content-Type") ?? "-";
      const contentDisposition = response.headers.get("Content-Disposition") ?? "-";
      if (kind === "ai") {
        const data = JSON.parse(text) as AiContext;
        setPreview({
          label: previewLabels[kind],
          contentType,
          contentDisposition,
          lineCount: text.split(/\r?\n/).length,
          text: JSON.stringify(buildAiContextPreview(data), null, 2)
        });
        return;
      }

      const lines = text.split(/\r?\n/);
      setPreview({
        label: previewLabels[kind],
        contentType,
        contentDisposition,
        lineCount: lines.length,
        text: lines.slice(0, 12).join("\n")
      });
    } catch (error) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : "プレビュー取得に失敗しました。");
    } finally {
      setPreviewBusy(null);
    }
  }

  function snapshotToInput(snapshot: Snapshot): SnapshotCreateInput {
    return {
      observed_date: snapshot.observed_date,
      observed_time: snapshot.observed_time,
      timezone: snapshot.timezone,
      game_mode: snapshot.game_mode,
      player_name: snapshot.player_name,
      player_id: snapshot.player_id,
      rank_name: snapshot.rank_name,
      rank_level: snapshot.rank_level,
      rank_points: snapshot.rank_points,
      rank_points_max: snapshot.rank_points_max,
      matches: snapshot.matches,
      avg_win_score: snapshot.avg_win_score,
      avg_place: snapshot.avg_place,
      max_renchan: snapshot.max_renchan,
      avg_win_turn: snapshot.avg_win_turn,
      first_rate: snapshot.first_rate,
      second_rate: snapshot.second_rate,
      third_rate: snapshot.third_rate,
      fourth_rate: snapshot.fourth_rate,
      bust_rate: snapshot.bust_rate,
      win_rate: snapshot.win_rate,
      tsumo_rate: snapshot.tsumo_rate,
      deal_in_rate: snapshot.deal_in_rate,
      call_rate: snapshot.call_rate,
      riichi_rate: snapshot.riichi_rate,
      note: snapshot.note,
      source_image_sha256: snapshot.source_image_sha256,
      file_name: snapshot.file_name,
      file_last_modified: snapshot.file_last_modified,
      exif_taken_at: snapshot.exif_taken_at,
      image_width: snapshot.image_width,
      image_height: snapshot.image_height,
      parser_version: snapshot.parser_version,
      import_metadata: {
        extracted_field_count: null,
        status_message: "json_restore"
      }
    };
  }

  async function handleRestoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as { snapshots?: Snapshot[] };
      const items = Array.isArray(data.snapshots)
        ? data.snapshots.map(snapshotToInput)
        : [];
      setRestoreItems(items);
      setRestoreMessage(`${items.length}件の復元候補を読み込みました。`);
    } catch (error) {
      setRestoreItems([]);
      setRestoreMessage(error instanceof Error ? error.message : "JSONの読み込みに失敗しました。");
    }
  }

  async function handleRestoreImport() {
    if (restoreItems.length === 0) return;

    setRestoreBusy(true);
    let saved = 0;
    let skipped = 0;

    try {
      for (const item of restoreItems) {
        try {
          await createSnapshot(item);
          saved += 1;
        } catch {
          skipped += 1;
        }
      }
      setRestoreMessage(`復元インポート完了: 保存 ${saved}件 / スキップ ${skipped}件`);
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">エクスポート</p>
          <h1>ダウンロード</h1>
        </div>
      </div>

      <section className="export-grid">
        {(["snapshots", "deltas", "ai"] as PreviewKind[]).map((kind) => (
          <div className="export-card" key={kind}>
            <a
              className="export-action"
              href={exportPath(kind)}
              download={
                kind === "snapshots"
                  ? "tilelog-snapshots.csv"
                  : kind === "deltas"
                    ? "tilelog-deltas.csv"
                    : "tilelog-ai-context.json"
              }
            >
              <Download size={22} aria-hidden="true" />
              <span>{previewLabels[kind]}</span>
            </a>
            <button
              type="button"
              className="secondary-button"
              aria-label={`${previewLabels[kind]}プレビュー`}
              disabled={previewBusy != null}
              onClick={() => void handlePreview(kind)}
            >
              {previewBusy === kind ? (
                <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
              <span>プレビュー</span>
            </button>
          </div>
        ))}
      </section>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>出力条件</h2>
          <p>CSV/JSONに含める記録を絞り込みます。</p>
        </div>
        <div className="form-grid export-filter-grid">
          <label>
            <span>ゲームモード</span>
            <select
              value={exportGameMode}
              onChange={(event) => setExportGameMode(event.target.value)}
            >
              <option value="all">すべて</option>
              {GAME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {GAME_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>開始日</span>
            <input
              type="date"
              value={exportDateFrom}
              onChange={(event) => setExportDateFrom(event.target.value)}
            />
          </label>
          <label>
            <span>終了日</span>
            <input
              type="date"
              value={exportDateTo}
              onChange={(event) => setExportDateTo(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="settings-panel">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={anonymize}
            onChange={(event) => setAnonymize(event.target.checked)}
          />
          <span>AI用JSONのプレイヤー識別情報を匿名化する</span>
        </label>
        <p>
          外部AIツールへアップロードする前に、メモの内容を確認してください。スクリーンショットはダウンロードに含まれず、アプリにも保存されません。
        </p>
        <div className="form-grid export-request-grid">
          <label>
            <span>分析目的</span>
            <textarea
              value={aiGoal}
              maxLength={300}
              rows={3}
              onChange={(event) => setAiGoal(event.target.value)}
            />
          </label>
          <label>
            <span>注目指標</span>
            <textarea
              value={aiFocus}
              maxLength={1600}
              rows={6}
              onChange={(event) => setAiFocus(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="settings-panel">
        <div className="section-heading inline-heading">
          <h2>JSON復元</h2>
          <p>AI用JSON内の数値スナップショットを再インポートします。</p>
        </div>
        <div className="image-row">
          <label className="file-button">
            <Upload size={18} aria-hidden="true" />
            <span>JSONを選択</span>
            <input type="file" accept="application/json,.json" onChange={handleRestoreFile} />
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={restoreBusy || restoreItems.length === 0}
            onClick={() => void handleRestoreImport()}
          >
            {restoreBusy ? (
              <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
            ) : (
              <Upload size={18} aria-hidden="true" />
            )}
            <span>復元インポート</span>
          </button>
        </div>
        {restoreMessage ? <p className="form-message">{restoreMessage}</p> : null}
      </section>

      {previewError ? <p className="error-banner">{previewError}</p> : null}
      {preview ? (
        <section className="table-section">
          <div className="section-heading">
            <h2>{preview.label}プレビュー</h2>
            <p>
              {preview.lineCount}行 / Content-Type: {preview.contentType} / Content-Disposition: {preview.contentDisposition}
            </p>
          </div>
          <pre className="export-preview">{preview.text}</pre>
        </section>
      ) : null}
    </main>
  );
}

function withParams(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function buildAiContextPreview(data: AiContext): AiContextPreview {
  const latestSnapshot = data.snapshots.at(-1) ?? null;
  const topPriority = data.improvement_priorities[0] ?? null;
  const topRegressionFactor = data.regression_factors[0] ?? null;

  return {
    schema_version: data.schema_version,
    exported_at: data.exported_at,
    privacy: data.privacy,
    analysis_counts: {
      snapshots: data.snapshots.length,
      derived_metrics: data.derived_metrics.length,
      estimated_deltas: data.estimated_deltas.length,
      period_analyses: data.period_analyses.length,
      period_comparisons: data.period_comparisons.length,
      metric_distributions: data.metric_distributions.length,
      riichi_trends: data.riichi_trends.length,
      riichi_risk_signals: data.riichi_risk_signals.length,
      improvement_priorities: data.improvement_priorities.length,
      regression_factors: data.regression_factors.length,
      focus_recommendations: data.focus_recommendations.length,
      goal_gap_comments: data.goal_gap_comments.length,
      data_quality_issues: data.data_quality_issues.length
    },
    highlights: {
      latest_observed_at_utc: latestSnapshot?.observed_at_utc ?? null,
      latest_game_mode: latestSnapshot?.game_mode ?? null,
      latest_matches: latestSnapshot?.matches ?? null,
      attack_style: data.attack_style?.label ?? null,
      stability: data.stability_score.status,
      top_improvement_priority: topPriority?.title ?? null,
      top_regression_factor: topRegressionFactor?.label ?? null
    },
    summary: data.summary,
    analysis_request: data.analysis_request,
    snapshots_preview: data.snapshots.slice(0, 2)
  };
}
