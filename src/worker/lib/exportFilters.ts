import { GAME_MODES } from "../../shared/constants";
import type { AnalysisFilterInput } from "../../shared/analysisFilters";

export function parseExportFilters(query: (name: string) => string | undefined): AnalysisFilterInput {
  const gameMode = query("game_mode");

  return {
    game_mode: GAME_MODES.includes(gameMode as (typeof GAME_MODES)[number])
      ? (gameMode as AnalysisFilterInput["game_mode"])
      : "all",
    observed_date_from: query("observed_date_from") || undefined,
    observed_date_to: query("observed_date_to") || undefined
  };
}
