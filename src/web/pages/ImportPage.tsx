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
          <p className="eyebrow">インポート</p>
          <h1>新規記録</h1>
        </div>
      </div>
      <SnapshotForm submitLabel="記録を保存" onSubmit={handleSubmit} />
    </main>
  );
}
