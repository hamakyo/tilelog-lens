import { useState } from "react";
import { Download } from "lucide-react";

export function ExportPage() {
  const [anonymize, setAnonymize] = useState(true);

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Export</p>
          <h1>Downloads</h1>
        </div>
      </div>

      <section className="export-grid">
        <a className="export-action" href="/api/export/snapshots.csv">
          <Download size={22} aria-hidden="true" />
          <span>Snapshots CSV</span>
        </a>
        <a className="export-action" href="/api/export/deltas.csv">
          <Download size={22} aria-hidden="true" />
          <span>Deltas CSV</span>
        </a>
        <a
          className="export-action"
          href={`/api/export/ai-context.json?anonymize=${String(anonymize)}`}
        >
          <Download size={22} aria-hidden="true" />
          <span>AI JSON</span>
        </a>
      </section>

      <section className="settings-panel">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={anonymize}
            onChange={(event) => setAnonymize(event.target.checked)}
          />
          <span>Anonymize player identifiers in AI JSON</span>
        </label>
        <p>
          Review notes before uploading exports to third-party AI tools. Screenshots are
          not included in downloads and are not stored by the app.
        </p>
      </section>
    </main>
  );
}
