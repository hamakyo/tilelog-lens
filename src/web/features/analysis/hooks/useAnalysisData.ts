import { useEffect, useState } from "react";
import type { Snapshot } from "../../../../shared/types";
import { listAllSnapshots } from "../../../lib/api";

export function useAnalysisData() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedMode, setSelectedMode] = useState<Snapshot["game_mode"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAllSnapshots()
      .then((snapshotResult) => {
        setSnapshots(snapshotResult.items);
        const latestSnapshot = [...snapshotResult.items].sort(
          (a, b) =>
            b.observed_at_utc.localeCompare(a.observed_at_utc) || b.id - a.id
        )[0];
        setSelectedMode((current) => current ?? latestSnapshot?.game_mode ?? null);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "読み込みに失敗しました。")
      )
      .finally(() => setLoading(false));
  }, []);

  return {
    snapshots,
    selectedMode,
    setSelectedMode,
    error,
    loading
  };
}
