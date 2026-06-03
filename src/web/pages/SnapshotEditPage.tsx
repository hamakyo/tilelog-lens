import { useEffect, useState } from "react";
import type { Snapshot, SnapshotCreateInput, ValidationWarning } from "../../shared/types";
import { SnapshotForm } from "../components/SnapshotForm";
import { getSnapshot, updateSnapshot } from "../lib/api";

type SnapshotEditPageProps = {
  id: number;
};

export function SnapshotEditPage({ id }: SnapshotEditPageProps) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSnapshot(id)
      .then((result) => setSnapshot(result.item))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "記録の読み込みに失敗しました。")
      );
  }, [id]);

  async function handleSubmit(input: SnapshotCreateInput): Promise<ValidationWarning[]> {
    const result = await updateSnapshot(id, input);
    setSnapshot(result.item);
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
    </main>
  );
}
