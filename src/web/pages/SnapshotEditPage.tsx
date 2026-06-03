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
        setError(caught instanceof Error ? caught.message : "Snapshot load failed.")
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
          <p className="eyebrow">Edit</p>
          <h1>Snapshot {id}</h1>
        </div>
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
      {snapshot ? (
        <SnapshotForm
          initialSnapshot={snapshot}
          submitLabel="Update snapshot"
          onSubmit={handleSubmit}
        />
      ) : (
        <p className="empty-state">Loading snapshot...</p>
      )}
    </main>
  );
}
