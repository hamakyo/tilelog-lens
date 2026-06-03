import { useState } from "react";
import { Download } from "lucide-react";

export function ExportPage() {
  const [anonymize, setAnonymize] = useState(true);

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">エクスポート</p>
          <h1>ダウンロード</h1>
        </div>
      </div>

      <section className="export-grid">
        <a className="export-action" href="/api/export/snapshots.csv">
          <Download size={22} aria-hidden="true" />
          <span>記録CSV</span>
        </a>
        <a className="export-action" href="/api/export/deltas.csv">
          <Download size={22} aria-hidden="true" />
          <span>差分CSV</span>
        </a>
        <a
          className="export-action"
          href={`/api/export/ai-context.json?anonymize=${String(anonymize)}`}
        >
          <Download size={22} aria-hidden="true" />
          <span>AI用JSON</span>
        </a>
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
    </main>
  );
}
