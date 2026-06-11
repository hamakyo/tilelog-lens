import { DEFAULT_ANALYSIS_GOALS } from "../../shared/goals";
import type { AnalysisGoal } from "../../shared/types";

const analysisGoalsStorageKey = "tilelog-lens:analysis-goals";

function normalizeGoals(goals: AnalysisGoal[]): AnalysisGoal[] {
  const storedById = new Map(goals.map((goal) => [goal.id, goal]));

  return DEFAULT_ANALYSIS_GOALS.map((defaultGoal) => {
    const stored = storedById.get(defaultGoal.id);
    if (!stored) return defaultGoal;

    return {
      ...defaultGoal,
      target_value: Number.isFinite(stored.target_value)
        ? stored.target_value
        : defaultGoal.target_value,
      enabled:
        typeof stored.enabled === "boolean"
          ? stored.enabled
          : defaultGoal.enabled
    };
  });
}

export function loadAnalysisGoals(): AnalysisGoal[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(analysisGoalsStorageKey) ?? "[]"
    ) as AnalysisGoal[];
    return normalizeGoals(parsed);
  } catch {
    return DEFAULT_ANALYSIS_GOALS;
  }
}

export function saveAnalysisGoals(goals: AnalysisGoal[]): void {
  window.localStorage.setItem(
    analysisGoalsStorageKey,
    JSON.stringify(normalizeGoals(goals))
  );
}

export function resetAnalysisGoals(): AnalysisGoal[] {
  saveAnalysisGoals(DEFAULT_ANALYSIS_GOALS);
  return DEFAULT_ANALYSIS_GOALS;
}
