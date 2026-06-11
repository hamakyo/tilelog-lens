import { useEffect, useState } from "react";
import type { ImportEvent } from "../../shared/types";
import { listImportEvents } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function ImportHistoryPage() {
  const [events, setEvents] = useState<ImportEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listImportEvents()
      .then((result) => setEvents(result.items))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">履歴</p>
          <h1>インポート履歴</h1>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="empty-state">履歴を読み込んでいます...</p> : null}

      <section className="table-section">
        <div className="section-heading">
          <h2>処理結果</h2>
          <p>画像本体は保存せず、ハッシュ・ファイル名・OCR項目数だけを記録します。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>結果</th>
                <th>記録</th>
                <th>ファイル</th>
                <th>OCR項目数</th>
                <th>画像サイズ</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7}>インポート履歴はまだありません。</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.created_at)}</td>
                    <td>
                      <span className={`code-pill ${event.status === "saved" ? "pill-ok" : "pill-warning"}`}>
                        {event.status === "saved" ? "保存済み" : "失敗"}
                      </span>
                    </td>
                    <td>{event.snapshot_id == null ? "-" : `#${event.snapshot_id}`}</td>
                    <td>{event.file_name ?? "-"}</td>
                    <td>{event.extracted_field_count ?? "-"}</td>
                    <td>
                      {event.image_width != null && event.image_height != null
                        ? `${event.image_width} x ${event.image_height}`
                        : "-"}
                    </td>
                    <td>{event.source_image_sha256 ? `${event.source_image_sha256.slice(0, 12)}...` : "-"}</td>
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
