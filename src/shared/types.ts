import type { GAME_MODES } from "./constants";

export type GameMode = (typeof GAME_MODES)[number];

export type Snapshot = {
  id: number;
  observed_date: string;
  observed_time: string;
  timezone: string;
  observed_at_utc: string;
  game_mode: GameMode;
  player_name: string | null;
  player_id: string | null;
  rank_name: string | null;
  rank_level: number | null;
  rank_points: number | null;
  rank_points_max: number | null;
  matches: number;
  avg_win_score: number | null;
  avg_place: number;
  max_renchan: number | null;
  avg_win_turn: number | null;
  first_rate: number;
  second_rate: number;
  third_rate: number;
  fourth_rate: number;
  bust_rate: number | null;
  win_rate: number;
  tsumo_rate: number | null;
  deal_in_rate: number;
  call_rate: number;
  riichi_rate: number;
  note: string | null;
  source_image_sha256: string | null;
  file_name: string | null;
  file_last_modified: string | null;
  exif_taken_at: string | null;
  image_width: number | null;
  image_height: number | null;
  parser_version: string | null;
  source_image_stored: 0;
  created_at: string;
  updated_at: string;
};

export type SnapshotCreateInput = {
  observed_date: string;
  observed_time: string;
  timezone: string;
  game_mode: GameMode;
  matches: number;
  avg_place: number;
  first_rate: number;
  second_rate: number;
  third_rate: number;
  fourth_rate: number;
  win_rate: number;
  deal_in_rate: number;
  call_rate: number;
  riichi_rate: number;
  player_name?: string | null;
  player_id?: string | null;
  rank_name?: string | null;
  rank_level?: number | null;
  rank_points?: number | null;
  rank_points_max?: number | null;
  avg_win_score?: number | null;
  max_renchan?: number | null;
  avg_win_turn?: number | null;
  bust_rate?: number | null;
  tsumo_rate?: number | null;
  note?: string | null;
  source_image_sha256?: string | null;
  file_name?: string | null;
  file_last_modified?: string | null;
  exif_taken_at?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  parser_version?: string | null;
  import_metadata?: {
    extracted_field_count?: number | null;
    status_message?: string | null;
  } | null;
};

export type SnapshotUpdateInput = SnapshotCreateInput;

export type ValidationWarning = {
  code:
    | "RANK_RATE_SUM_NOT_100"
    | "AVG_PLACE_MISMATCH"
    | "RANK_POINTS_EXCEED_CAP"
    | "RATE_DELTA_NEGATIVE"
    | "PERIOD_DELTA_INCONSISTENT"
    | "MATCHES_DECREASED"
    | "DUPLICATE_IMAGE_HASH"
    | "DUPLICATE_OBSERVED_AT";
  message: string;
  severity: "warning";
};

export type DerivedMetric = {
  snapshot_id: number;
  observed_at_utc: string;
  attack_defense_gap: number;
  top_two_rate: number;
  bottom_two_rate: number;
  rank_point_progress: number | null;
  calculated_avg_place: number;
};

export type EstimatedDelta = {
  from_snapshot_id: number;
  to_snapshot_id: number;
  from_observed_at_utc: string;
  to_observed_at_utc: string;
  matches_delta: number;
  estimated_first_delta?: number;
  estimated_second_delta?: number;
  estimated_third_delta?: number;
  estimated_fourth_delta?: number;
  estimated_win_delta?: number;
  estimated_deal_in_delta?: number;
  estimated_call_delta?: number;
  estimated_riichi_delta?: number;
  estimated_tsumo_delta?: number;
  period_first_rate?: number;
  period_second_rate?: number;
  period_third_rate?: number;
  period_fourth_rate?: number;
  period_win_rate?: number;
  period_deal_in_rate?: number;
  period_call_rate?: number;
  period_riichi_rate?: number;
  period_tsumo_rate?: number;
  quality: "ok" | "same_matches" | "negative_matches" | "insufficient_data";
};

export type PeriodAnalysis = {
  label: string;
  target_matches: number;
  actual_matches: number;
  from_snapshot_id: number;
  to_snapshot_id: number;
  from_observed_at_utc: string;
  to_observed_at_utc: string;
  period_avg_place?: number;
  period_first_rate?: number;
  period_second_rate?: number;
  period_third_rate?: number;
  period_fourth_rate?: number;
  period_win_rate?: number;
  period_deal_in_rate?: number;
  period_call_rate?: number;
  period_riichi_rate?: number;
  attack_defense_gap?: number;
  quality: "ok" | "limited_data" | "insufficient_data";
};

export type RiichiTrendAnalysis = {
  label: string;
  actual_matches: number;
  riichi_rate: number | null;
  win_rate: number | null;
  deal_in_rate: number | null;
  balance_gap: number | null;
  status: "good" | "watch" | "risk" | "insufficient_data";
  message: string;
};

export type RiichiRiskSignal = {
  id: string;
  title: string;
  severity: "watch" | "risk";
  message: string;
  focus: string[];
};

export type AttackStyleClassification = {
  type:
    | "riichi_focused"
    | "call_focused"
    | "over_push"
    | "under_attack"
    | "defensive"
    | "balanced";
  label: string;
  status: "good" | "watch" | "risk";
  summary: string;
  focus: string[];
};

export type ImprovementPriority = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  metric: string;
  current_value: number;
  target_value: number;
};

export type RankPointAnalysis = {
  rank_name: string | null;
  rank_level: number | null;
  current_points: number | null;
  point_max: number | null;
  progress_rate: number | null;
  remaining_points: number | null;
  previous_points: number | null;
  point_delta: number | null;
  matches_delta: number | null;
  points_per_match: number | null;
  projected_matches_to_promotion: number | null;
  rank_changed_since_previous: boolean;
  status: "ready" | "missing_points" | "missing_cap";
};

export type MetricDistribution = {
  key: string;
  label: string;
  unit: "number" | "rate" | "rank_point" | "place";
  count: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  standard_deviation: number | null;
  latest_value: number | null;
  latest_delta_from_average: number | null;
  stability: "stable" | "watch" | "volatile" | "insufficient_data";
};

export type AnalysisGoalMetric =
  | "avg_place"
  | "win_rate"
  | "deal_in_rate"
  | "fourth_rate"
  | "attack_defense_gap"
  | "rank_point_progress";

export type AnalysisGoal = {
  id: AnalysisGoalMetric;
  label: string;
  target_value: number;
  direction: "at_most" | "at_least";
  enabled: boolean;
};

export type AnalysisGoalStatus = AnalysisGoal & {
  current_value: number | null;
  achieved: boolean | null;
  delta_to_target: number | null;
};

export type SnapshotRevision = {
  id: number;
  snapshot_id: number;
  changed_fields: Array<{
    field: keyof Snapshot;
    before: string | number | null;
    after: string | number | null;
  }>;
  created_at: string;
};

export type ImportEvent = {
  id: number;
  snapshot_id: number | null;
  status: "saved" | "failed";
  source_image_sha256: string | null;
  file_name: string | null;
  image_width: number | null;
  image_height: number | null;
  parser_version: string | null;
  extracted_field_count: number | null;
  message: string | null;
  created_at: string;
};

export type AnalysisComment = {
  id: string;
  severity: "good" | "watch" | "risk";
  title: string;
  message: string;
};

export type SnapshotComparisonMetric = {
  key: string;
  label: string;
  from_value: number | null;
  to_value: number | null;
  delta: number | null;
  unit: "number" | "rate" | "rank_point" | "place";
  better_direction: "up" | "down" | "neutral";
};

export type SnapshotComparison = {
  from_snapshot_id: number;
  to_snapshot_id: number;
  from_observed_at_utc: string;
  to_observed_at_utc: string;
  matches_delta: number;
  metrics: SnapshotComparisonMetric[];
  quality: "ok" | "same_matches" | "negative_matches" | "different_mode";
};

export type PeriodComparison = {
  id: string;
  label: string;
  from_label: string;
  to_label: string;
  from_count: number;
  to_count: number;
  metrics: SnapshotComparisonMetric[];
  quality: "ok" | "limited_data" | "insufficient_data";
};

export type DuplicateSnapshotCandidate = {
  snapshot_id: number;
  observed_at_utc: string;
  observed_date: string;
  observed_time: string;
  game_mode: GameMode;
  matches: number;
  reason: "same_image_hash" | "same_observed_at" | "same_date_and_matches";
  message: string;
};

export type DataQualityIssue = {
  snapshot_id: number;
  observed_at_utc: string;
  game_mode: GameMode;
  code: ValidationWarning["code"];
  message: string;
  severity: "warning";
};

export type AiContext = {
  schema_version: "1.0";
  app: string;
  game: string;
  exported_at: string;
  privacy: {
    anonymized: boolean;
    screenshots_included: false;
    source_images_stored: false;
  };
  metrics_description: Record<string, string>;
  snapshots: Snapshot[];
  derived_metrics: DerivedMetric[];
  estimated_deltas: EstimatedDelta[];
  period_analyses: PeriodAnalysis[];
  period_comparisons: PeriodComparison[];
  analysis_comments: AnalysisComment[];
  improvement_priorities: ImprovementPriority[];
  rank_point_analysis: RankPointAnalysis | null;
  data_quality_warnings: ValidationWarning[];
  data_quality_issues: DataQualityIssue[];
  notes: Array<{
    snapshot_id: number;
    observed_at_utc: string;
    note: string;
  }>;
  analysis_request: {
    language: "ja";
    goal: string;
    focus: string[];
  };
};
