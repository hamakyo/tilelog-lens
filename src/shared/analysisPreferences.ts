import { z } from "zod";
import { GAME_MODES } from "./constants";
import type { GameMode } from "./types";

export const ANALYSIS_VIEW_LIMIT = 20;
export const ANALYSIS_EXPERIMENT_LIMIT = 30;

export const analysisViewTabs = ["overview", "riichi", "improvement", "detail"] as const;
export const analysisViewChartMetrics = [
  "avg_place",
  "win_rate",
  "deal_in_rate",
  "attack_defense_gap",
  "call_rate",
  "riichi_rate",
  "top_two_rate",
  "bottom_two_rate",
  "rank_point_progress"
] as const;
export const analysisExperimentMetrics = [
  "avg_place",
  "win_rate",
  "deal_in_rate",
  "fourth_rate",
  "riichi_rate",
  "rank_points"
] as const;

export type AnalysisViewTab = (typeof analysisViewTabs)[number];
export type AnalysisViewChartMetric = (typeof analysisViewChartMetrics)[number];
export type AnalysisExperimentMetric = (typeof analysisExperimentMetrics)[number];
export type AnalysisExperimentStatus = "active" | "completed";

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

export type AnalysisExperiment = {
  id: string;
  title: string;
  game_mode: GameMode;
  metric: AnalysisExperimentMetric;
  target_value: number;
  target_matches: number;
  baseline_snapshot_id: number | null;
  baseline_value: number;
  baseline_matches: number;
  baseline_observed_at_utc: string;
  status: AnalysisExperimentStatus;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
};

const timestamp = z.string().datetime({ offset: true });
const analysisViewFiltersSchema = z.object({
  observedDateFrom: z.string().max(32),
  observedDateTo: z.string().max(32),
  minMatches: z.string().max(32),
  maxMatches: z.string().max(32),
  minWinRate: z.string().max(32),
  maxDealInRate: z.string().max(32),
  maxAvgPlace: z.string().max(32)
});

export const analysisViewDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  game_mode: z.enum(GAME_MODES),
  filters: analysisViewFiltersSchema,
  tab: z.enum(analysisViewTabs),
  chart_metrics: z.array(z.enum(analysisViewChartMetrics)).max(analysisViewChartMetrics.length)
});

export const savedAnalysisViewSchema = analysisViewDraftSchema.extend({
  id: z.string().min(1).max(100),
  created_at: timestamp,
  updated_at: timestamp
});

export const analysisExperimentDraftSchema = z.object({
  title: z.string().trim().min(1).max(60),
  game_mode: z.enum(GAME_MODES),
  metric: z.enum(analysisExperimentMetrics),
  target_value: z.number().finite(),
  target_matches: z.number().int().min(1).max(10000),
  baseline_snapshot_id: z.number().int().positive().nullable(),
  baseline_value: z.number().finite(),
  baseline_matches: z.number().int().min(0),
  baseline_observed_at_utc: timestamp,
  status: z.enum(["active", "completed"]),
  completed_at: timestamp.nullable()
});

export const analysisExperimentSchema = analysisExperimentDraftSchema.extend({
  id: z.string().min(1).max(100),
  created_at: timestamp,
  updated_at: timestamp
});

export const analysisPreferencesSyncSchema = z.object({
  views: z.array(savedAnalysisViewSchema).max(ANALYSIS_VIEW_LIMIT),
  experiments: z.array(analysisExperimentSchema).max(ANALYSIS_EXPERIMENT_LIMIT)
});
