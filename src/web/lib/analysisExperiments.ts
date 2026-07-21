import { GAME_MODES } from "../../shared/constants";
import type { GameMode, Snapshot } from "../../shared/types";
import {
  analysisExperimentMetrics as metrics,
  type AnalysisExperiment,
  type AnalysisExperimentMetric,
  type AnalysisExperimentStatus
} from "../../shared/analysisPreferences";

export type {
  AnalysisExperiment,
  AnalysisExperimentMetric,
  AnalysisExperimentStatus
} from "../../shared/analysisPreferences";

export type AnalysisExperimentProgress = {
  current_value: number | null;
  metric_delta: number | null;
  matches_delta: number | null;
  matches_progress_rate: number;
  achieved: boolean | null;
  quality: "ready" | "missing_data" | "counter_reset";
};

export const analysisExperimentMetricDefinitions: Record<
  AnalysisExperimentMetric,
  { label: string; unit: "rate" | "place" | "rank_point"; direction: "at_most" | "at_least" }
> = {
  avg_place: { label: "平均順位", unit: "place", direction: "at_most" },
  win_rate: { label: "和了率", unit: "rate", direction: "at_least" },
  deal_in_rate: { label: "放銃率", unit: "rate", direction: "at_most" },
  fourth_rate: { label: "四位率", unit: "rate", direction: "at_most" },
  riichi_rate: { label: "立直率", unit: "rate", direction: "at_least" },
  rank_points: { label: "段位ポイント", unit: "rank_point", direction: "at_least" }
};

const storageKey = "tilelog-lens:analysis-experiments";
function metricValue(snapshot: Snapshot, metric: AnalysisExperimentMetric): number | null {
  const value = snapshot[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function sanitizeExperiment(value: unknown): AnalysisExperiment | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !GAME_MODES.includes(value.game_mode as GameMode) ||
    !metrics.includes(value.metric as AnalysisExperimentMetric) ||
    typeof value.target_value !== "number" ||
    !Number.isFinite(value.target_value) ||
    typeof value.target_matches !== "number" ||
    !Number.isInteger(value.target_matches) ||
    value.target_matches < 1 ||
    (value.baseline_snapshot_id !== null && typeof value.baseline_snapshot_id !== "number") ||
    typeof value.baseline_value !== "number" ||
    !Number.isFinite(value.baseline_value) ||
    typeof value.baseline_matches !== "number" ||
    !Number.isInteger(value.baseline_matches) ||
    typeof value.baseline_observed_at_utc !== "string" ||
    (value.status !== "active" && value.status !== "completed") ||
    typeof value.created_at !== "string" ||
    (value.completed_at !== null && typeof value.completed_at !== "string") ||
    (value.updated_at != null && typeof value.updated_at !== "string")
  ) {
    return null;
  }

  return {
    id: value.id.slice(0, 100),
    title: value.title.trim().slice(0, 60),
    game_mode: value.game_mode as GameMode,
    metric: value.metric as AnalysisExperimentMetric,
    target_value: value.target_value,
    target_matches: value.target_matches,
    baseline_snapshot_id: value.baseline_snapshot_id as number | null,
    baseline_value: value.baseline_value,
    baseline_matches: value.baseline_matches,
    baseline_observed_at_utc: value.baseline_observed_at_utc,
    status: value.status,
    created_at: value.created_at,
    completed_at: value.completed_at as string | null,
    updated_at:
      typeof value.updated_at === "string"
        ? value.updated_at
        : (value.completed_at as string | null) ?? value.created_at
  };
}

export function loadAnalysisExperiments(): AnalysisExperiment[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeExperiment)
      .filter((experiment): experiment is AnalysisExperiment =>
        experiment != null && experiment.title.length > 0
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function saveAnalysisExperiments(experiments: AnalysisExperiment[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(experiments.slice(0, 30)));
  } catch {
    // Storage can be unavailable in hardened browser settings.
  }
}

export function startAnalysisExperiment(
  experiments: AnalysisExperiment[],
  input: {
    title: string;
    metric: AnalysisExperimentMetric;
    target_value: number;
    target_matches: number;
  },
  baseline: Snapshot
): { item: AnalysisExperiment; items: AnalysisExperiment[] } {
  const baselineValue = metricValue(baseline, input.metric);
  if (baselineValue == null) throw new Error("開始値を取得できません。");

  const item: AnalysisExperiment = {
    id: globalThis.crypto?.randomUUID?.() ?? `experiment-${Date.now()}`,
    title: input.title.trim().slice(0, 60),
    game_mode: baseline.game_mode,
    metric: input.metric,
    target_value: input.target_value,
    target_matches: Math.max(1, Math.round(input.target_matches)),
    baseline_snapshot_id: baseline.id,
    baseline_value: baselineValue,
    baseline_matches: baseline.matches,
    baseline_observed_at_utc: baseline.observed_at_utc,
    status: "active",
    created_at: new Date().toISOString(),
    completed_at: null,
    updated_at: new Date().toISOString()
  };
  const items = [item, ...experiments].slice(0, 30);
  saveAnalysisExperiments(items);
  return { item, items };
}

export function setAnalysisExperimentStatus(
  experiments: AnalysisExperiment[],
  id: string,
  status: AnalysisExperimentStatus
): AnalysisExperiment[] {
  const now = new Date().toISOString();
  const items = experiments.map((experiment) =>
    experiment.id === id
      ? {
          ...experiment,
          status,
          completed_at: status === "completed" ? now : null,
          updated_at: now
        }
      : experiment
  );
  saveAnalysisExperiments(items);
  return items;
}

export function deleteAnalysisExperiment(
  experiments: AnalysisExperiment[],
  id: string
): AnalysisExperiment[] {
  const items = experiments.filter((experiment) => experiment.id !== id);
  saveAnalysisExperiments(items);
  return items;
}

export function buildAnalysisExperimentProgress(
  experiment: AnalysisExperiment,
  snapshots: Snapshot[]
): AnalysisExperimentProgress {
  const latest = snapshots
    .filter(
      (snapshot) =>
        snapshot.game_mode === experiment.game_mode &&
        snapshot.observed_at_utc >= experiment.baseline_observed_at_utc
    )
    .sort((a, b) => b.observed_at_utc.localeCompare(a.observed_at_utc))[0];
  const currentValue = latest ? metricValue(latest, experiment.metric) : null;
  if (!latest || currentValue == null) {
    return {
      current_value: null,
      metric_delta: null,
      matches_delta: null,
      matches_progress_rate: 0,
      achieved: null,
      quality: "missing_data"
    };
  }

  const matchesDelta = latest.matches - experiment.baseline_matches;
  if (matchesDelta < 0) {
    return {
      current_value: currentValue,
      metric_delta: currentValue - experiment.baseline_value,
      matches_delta: matchesDelta,
      matches_progress_rate: 0,
      achieved: null,
      quality: "counter_reset"
    };
  }

  const definition = analysisExperimentMetricDefinitions[experiment.metric];
  return {
    current_value: currentValue,
    metric_delta: Number((currentValue - experiment.baseline_value).toFixed(2)),
    matches_delta: matchesDelta,
    matches_progress_rate: Math.min(
      100,
      Number(((matchesDelta / experiment.target_matches) * 100).toFixed(2))
    ),
    achieved:
      matchesDelta < experiment.target_matches
        ? false
        : definition.direction === "at_most"
          ? currentValue <= experiment.target_value
          : currentValue >= experiment.target_value,
    quality: "ready"
  };
}
