import type { GameMode } from "./types";

export type AnalysisProfileThresholds = {
  over_push_deal_in: number;
  over_push_riichi: number;
  over_push_call: number;
  under_attack_win: number;
  under_attack_riichi: number;
  under_attack_call: number;
  riichi_focused_riichi: number;
  riichi_focused_call_max: number;
  call_focused_call: number;
  call_focused_riichi_max: number;
  favorable_attack_defense_gap: number;
  favorable_call_deal_in: number;
  defensive_deal_in: number;
  defensive_win_max: number;
};

export type AnalysisProfile = {
  id: string;
  version: "1.0.0";
  status: "provisional";
  game_mode: GameMode;
  thresholds: AnalysisProfileThresholds;
};

const currentThresholds: AnalysisProfileThresholds = {
  over_push_deal_in: 13,
  over_push_riichi: 23,
  over_push_call: 35,
  under_attack_win: 20,
  under_attack_riichi: 17,
  under_attack_call: 30,
  riichi_focused_riichi: 23,
  riichi_focused_call_max: 32,
  call_focused_call: 35,
  call_focused_riichi_max: 22,
  favorable_attack_defense_gap: 8,
  favorable_call_deal_in: 12,
  defensive_deal_in: 10.5,
  defensive_win_max: 21
};

function profile(gameMode: GameMode): AnalysisProfile {
  return {
    id: `mahjong-soul-${gameMode}-provisional`,
    version: "1.0.0",
    status: "provisional",
    game_mode: gameMode,
    thresholds: { ...currentThresholds }
  };
}

export const analysisProfiles: Record<GameMode, AnalysisProfile> = {
  east: profile("east"),
  south: profile("south"),
  three_player: profile("three_player"),
  other: profile("other")
};

export function getAnalysisProfile(gameMode: GameMode): AnalysisProfile {
  return analysisProfiles[gameMode];
}
