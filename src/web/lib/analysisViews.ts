import { GAME_MODES } from "../../shared/constants";
import type { GameMode } from "../../shared/types";

export type AnalysisViewTab = "overview" | "riichi" | "improvement" | "detail";

export type AnalysisViewChartMetric =
  | "avg_place"
  | "win_rate"
  | "deal_in_rate"
  | "attack_defense_gap"
  | "call_rate"
  | "riichi_rate"
  | "top_two_rate"
  | "bottom_two_rate"
  | "rank_point_progress";

export type AnalysisViewFilters = {
  observedDateFrom: string;
  observedDateTo: string;
  minMatches: string;
  maxMatches: string;
  minWinRate: string;
  maxDealInRate: string;
  maxAvgPlace: string;
};

export type SavedAnalysisView = {
  id: string;
  name: string;
  game_mode: GameMode;
  filters: AnalysisViewFilters;
  tab: AnalysisViewTab;
  chart_metrics: AnalysisViewChartMetric[];
  created_at: string;
  updated_at: string;
};

export type AnalysisViewDraft = Omit<SavedAnalysisView, "id" | "created_at" | "updated_at">;

const storageKey = "tilelog-lens:analysis-views";
const tabs: AnalysisViewTab[] = ["overview", "riichi", "improvement", "detail"];
const chartMetrics: AnalysisViewChartMetric[] = [
  "avg_place",
  "win_rate",
  "deal_in_rate",
  "attack_defense_gap",
  "call_rate",
  "riichi_rate",
  "top_two_rate",
  "bottom_two_rate",
  "rank_point_progress"
];
const filterKeys: Array<keyof AnalysisViewFilters> = [
  "observedDateFrom",
  "observedDateTo",
  "minMatches",
  "maxMatches",
  "minWinRate",
  "maxDealInRate",
  "maxAvgPlace"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function sanitizeFilters(value: unknown): AnalysisViewFilters | null {
  if (!isRecord(value)) return null;

  const result = {} as AnalysisViewFilters;
  for (const key of filterKeys) {
    const field = value[key];
    if (typeof field !== "string") return null;
    result[key] = field.slice(0, 32);
  }
  return result;
}

function sanitizeView(value: unknown): SavedAnalysisView | null {
  if (!isRecord(value)) return null;
  const filters = sanitizeFilters(value.filters);
  const gameMode = value.game_mode;
  const tab = value.tab;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !GAME_MODES.includes(gameMode as GameMode) ||
    !tabs.includes(tab as AnalysisViewTab) ||
    !filters ||
    !Array.isArray(value.chart_metrics) ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    return null;
  }

  const metrics = Array.from(
    new Set(
      value.chart_metrics.filter((metric): metric is AnalysisViewChartMetric =>
        chartMetrics.includes(metric as AnalysisViewChartMetric)
      )
    )
  );

  return {
    id: value.id.slice(0, 100),
    name: value.name.trim().slice(0, 40),
    game_mode: gameMode as GameMode,
    filters,
    tab: tab as AnalysisViewTab,
    chart_metrics: metrics,
    created_at: value.created_at,
    updated_at: value.updated_at
  };
}

export function loadAnalysisViews(): SavedAnalysisView[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeView)
      .filter((view): view is SavedAnalysisView => view != null && view.name.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function saveAnalysisViews(views: SavedAnalysisView[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(views.slice(0, 20)));
  } catch {
    // Storage can be unavailable in hardened browser settings.
  }
}

export function upsertAnalysisView(
  views: SavedAnalysisView[],
  draft: AnalysisViewDraft,
  existingId?: string
): { item: SavedAnalysisView; items: SavedAnalysisView[] } {
  const now = new Date().toISOString();
  const existing = existingId ? views.find((view) => view.id === existingId) : undefined;
  const item: SavedAnalysisView = {
    ...draft,
    name: draft.name.trim().slice(0, 40),
    id: existing?.id ?? globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}`,
    created_at: existing?.created_at ?? now,
    updated_at: now
  };
  const items = existing
    ? views.map((view) => (view.id === existing.id ? item : view))
    : [item, ...views].slice(0, 20);
  saveAnalysisViews(items);
  return { item, items };
}

export function deleteAnalysisView(
  views: SavedAnalysisView[],
  id: string
): SavedAnalysisView[] {
  const items = views.filter((view) => view.id !== id);
  saveAnalysisViews(items);
  return items;
}
