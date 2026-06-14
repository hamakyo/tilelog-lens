import type { GameMode, Snapshot } from "./types";

export type AnalysisFilterInput = {
  game_mode?: GameMode | "all";
  observed_date_from?: string;
  observed_date_to?: string;
  min_matches?: number | null;
  max_matches?: number | null;
  min_win_rate?: number | null;
  max_deal_in_rate?: number | null;
  max_avg_place?: number | null;
};

export type AnalysisFilterSummary = {
  total_count: number;
  filtered_count: number;
  active_filter_count: number;
};

export function filterSnapshotsForAnalysis(
  snapshots: Snapshot[],
  filters: AnalysisFilterInput
): Snapshot[] {
  return snapshots.filter((snapshot) => snapshotMatchesAnalysisFilters(snapshot, filters));
}

export function buildAnalysisFilterSummary(
  snapshots: Snapshot[],
  filteredSnapshots: Snapshot[],
  filters: AnalysisFilterInput
): AnalysisFilterSummary {
  return {
    total_count: snapshots.length,
    filtered_count: filteredSnapshots.length,
    active_filter_count: countActiveAnalysisFilters(filters)
  };
}

export function countActiveAnalysisFilters(filters: AnalysisFilterInput): number {
  let count = 0;
  if (filters.game_mode && filters.game_mode !== "all") count += 1;
  if (filters.observed_date_from) count += 1;
  if (filters.observed_date_to) count += 1;
  if (filters.min_matches != null) count += 1;
  if (filters.max_matches != null) count += 1;
  if (filters.min_win_rate != null) count += 1;
  if (filters.max_deal_in_rate != null) count += 1;
  if (filters.max_avg_place != null) count += 1;
  return count;
}

function snapshotMatchesAnalysisFilters(
  snapshot: Snapshot,
  filters: AnalysisFilterInput
): boolean {
  if (filters.game_mode && filters.game_mode !== "all" && snapshot.game_mode !== filters.game_mode) {
    return false;
  }

  if (filters.observed_date_from && snapshot.observed_date < filters.observed_date_from) {
    return false;
  }

  if (filters.observed_date_to && snapshot.observed_date > filters.observed_date_to) {
    return false;
  }

  if (filters.min_matches != null && snapshot.matches < filters.min_matches) {
    return false;
  }

  if (filters.max_matches != null && snapshot.matches > filters.max_matches) {
    return false;
  }

  if (filters.min_win_rate != null && snapshot.win_rate < filters.min_win_rate) {
    return false;
  }

  if (filters.max_deal_in_rate != null && snapshot.deal_in_rate > filters.max_deal_in_rate) {
    return false;
  }

  if (filters.max_avg_place != null && snapshot.avg_place > filters.max_avg_place) {
    return false;
  }

  return true;
}
