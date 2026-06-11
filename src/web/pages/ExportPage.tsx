import { useState } from "react";
import { Download, Eye, LoaderCircle } from "lucide-react";

type PreviewKind = "snapshots" | "deltas" | "ai";

type ExportPreview = {
  label: string;
  contentType: string;
  contentDisposition: string;
  lineCount: number;
  text: string;
};

const previewLabels: Record<PreviewKind, string> = {
  snapshots: "記録CSV",
  deltas: "差分CSV",
  ai: "AI用JSON"
};

export function ExportPage() {
  const [anonymize, setAnonymize] = useState(true);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState<PreviewKind | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function exportPath(kind: PreviewKind): string {
    if (kind === "snapshots") return "/api/export/snapshots.csv";
    if (kind === "deltas") return "/api/export/deltas.csv";
    return `/api/export/ai-context.json?anonymize=${String(anonymize)}`;
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
        const data = JSON.parse(text) as {
          schema_version?: string;
          exported_at?: string;
          privacy?: unknown;
          snapshots?: unknown[];
          improvement_priorities?: unknown[];
          data_quality_issues?: unknown[];
        };
        setPreview({
          label: previewLabels[kind],
          contentType,
          contentDisposition,
          lineCount: text.split(/\r?\n/).length,
          text: JSON.stringify(
            {
              schema_version: data.schema_version,
              exported_at: data.exported_at,
              privacy: data.privacy,
              snapshot_count: data.snapshots?.length ?? 0,
              improvement_priority_count: data.improvement_priorities?.length ?? 0,
              data_quality_issue_count: data.data_quality_issues?.length ?? 0,
              snapshots_preview: data.snapshots?.slice(0, 2) ?? []
            },
            null,
            2
          )
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
