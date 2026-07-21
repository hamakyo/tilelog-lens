import { useEffect, useState } from "react";
import type {
  AnalysisExperiment,
  SavedAnalysisView
} from "../../../../shared/analysisPreferences";
import { listAnalysisPreferences, syncAnalysisPreferences } from "../../../lib/api";
import {
  loadAnalysisExperiments,
  saveAnalysisExperiments
} from "../../../lib/analysisExperiments";
import { loadAnalysisViews, saveAnalysisViews } from "../../../lib/analysisViews";

const migrationMarkerKey = "tilelog-lens:analysis-preferences-d1-synced-v1";

function hasCompletedInitialSync(): boolean {
  try {
    return window.localStorage.getItem(migrationMarkerKey) === "true";
  } catch {
    return false;
  }
}

function markInitialSyncCompleted(): void {
  try {
    window.localStorage.setItem(migrationMarkerKey, "true");
  } catch {
    // D1 remains authoritative when storage is unavailable.
  }
}

export function useAnalysisPreferences() {
  const [savedViews, setSavedViews] = useState<SavedAnalysisView[]>(loadAnalysisViews);
  const [analysisExperiments, setAnalysisExperiments] = useState<AnalysisExperiment[]>(
    loadAnalysisExperiments
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    const request = hasCompletedInitialSync()
      ? listAnalysisPreferences()
      : syncAnalysisPreferences({
          views: loadAnalysisViews(),
          experiments: loadAnalysisExperiments()
        });
    request
      .then((result) => {
        setSavedViews(result.views);
        setAnalysisExperiments(result.experiments);
        saveAnalysisViews(result.views);
        saveAnalysisExperiments(result.experiments);
        markInitialSyncCompleted();
        setSyncError(null);
      })
      .catch((caught) =>
        setSyncError(
          caught instanceof Error
            ? `分析設定を同期できませんでした: ${caught.message}`
            : "分析設定を同期できませんでした。"
        )
      )
      .finally(() => setSyncing(false));
  }, []);

  return {
    savedViews,
    setSavedViews,
    analysisExperiments,
    setAnalysisExperiments,
    syncError,
    syncing
  };
}
