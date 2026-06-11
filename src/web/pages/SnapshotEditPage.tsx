import { useEffect, useState } from "react";
import type {
  Snapshot,
  SnapshotCreateInput,
  SnapshotRevision,
  ValidationWarning
} from "../../shared/types";
import { SnapshotForm } from "../components/SnapshotForm";
import { getSnapshot, listSnapshotRevisions, updateSnapshot } from "../lib/api";
import { formatDateTime } from "../lib/format";

type SnapshotEditPageProps = {
  id: number;
};

export function SnapshotEditPage({ id }: SnapshotEditPageProps) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revisions, setRevisions] = useState<SnapshotRevision[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSnapshot(id), listSnapshotRevisions(id)])
      .then(([snapshotResult, revisionResult]) => {
        setSnapshot(snapshotResult.item);
        setRevisions(revisionResult.items);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "記録の読み込みに失敗しました。")
      );
  }, [id]);

  async function handleSubmit(input: SnapshotCreateInput): Promise<ValidationWarning[]> {
    const result = await updateSnapshot(id, input);
    setSnapshot(result.item);
    const revisionResult = await listSnapshotRevisions(id);
    setRevisions(revisionResult.items);
    return result.warnings ?? [];
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">編集</p>
          <h1>記録 {id}</h1>
        </div>
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
      {snapshot ? (
        <SnapshotForm
          initialSnapshot={snapshot}
          submitLabel="記録を更新"
          onSubmit={handleSubmit}
        />
      ) : (
        <p className="empty-state">記録を読み込んでいます...</p>
      )}
      <section className="table-section">
        <div className="section-heading">
          <h2>変更履歴</h2>
          <p>更新時に変更された項目だけを記録します。</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>項目</th>
                <th>変更前</th>
                <th>変更後</th>
              </tr>
            </thead>
            <tbody>
              {revisions.length === 0 ? (
                <tr>
                  <td colSpan={4}>変更履歴はまだありません。</td>
                </tr>
              ) : (
                revisions.flatMap((revision) =>
                  revision.changed_fields.map((change) => (
                    <tr key={`${revision.id}-${String(change.field)}`}>
                      <td>{formatDateTime(revision.created_at)}</td>
                      <td>{String(change.field)}</td>
                      <td>{change.before ?? "-"}</td>
                      <td>{change.after ?? "-"}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
