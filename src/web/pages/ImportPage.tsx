import type { SnapshotCreateInput, ValidationWarning } from "../../shared/types";
import { SnapshotForm } from "../components/SnapshotForm";
import { createSnapshot } from "../lib/api";

export function ImportPage() {
  async function handleSubmit(input: SnapshotCreateInput): Promise<ValidationWarning[]> {
    const result = await createSnapshot(input);
    return result.warnings ?? [];
  }

  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Import</p>
          <h1>New Snapshot</h1>
        </div>
      </div>
      <SnapshotForm submitLabel="Save snapshot" onSubmit={handleSubmit} />
    </main>
  );
}
