import { RANK_LEVELS, RANK_POINT_MAX_BY_RANK_AND_LEVEL } from "./constants";
import type { AnalysisGoal, AnalysisGoalStatus, Snapshot } from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const DEFAULT_ANALYSIS_GOALS: AnalysisGoal[] = [
  {
    id: "avg_place",
    label: "平均順位",
    target_value: 2.45,
    direction: "at_most",
    enabled: true
  },
  {
    id: "deal_in_rate",
    label: "放銃率",
    target_value: 12,
    direction: "at_most",
    enabled: true
  },
  {
    id: "win_rate",
    label: "和了率",
    target_value: 22,
    direction: "at_least",
    enabled: true
  },
  {
    id: "fourth_rate",
    label: "四位率",
    target_value: 23,
    direction: "at_most",
    enabled: true
  },
  {
    id: "attack_defense_gap",
    label: "攻守差",
    target_value: 8,
    direction: "at_least",
    enabled: true
  },
  {
    id: "rank_point_progress",
    label: "段位pt進捗",
    target_value: 80,
    direction: "at_least",
    enabled: false
  }
];

function rankPointMaxForSnapshot(snapshot: Snapshot): number | null {
  if (snapshot.rank_points_max != null) return snapshot.rank_points_max;
  const level = snapshot.rank_level;
  if (snapshot.rank_name == null || level == null) return null;
  if (!RANK_LEVELS.includes(level as (typeof RANK_LEVELS)[number])) return null;

  return (
    RANK_POINT_MAX_BY_RANK_AND_LEVEL[
      snapshot.rank_name as keyof typeof RANK_POINT_MAX_BY_RANK_AND_LEVEL
    ]?.[level as (typeof RANK_LEVELS)[number]] ?? null
  );
}

function currentGoalValue(goal: AnalysisGoal, snapshot: Snapshot): number | null {
  if (goal.id === "attack_defense_gap") {
    return round2(snapshot.win_rate - snapshot.deal_in_rate);
  }

  if (goal.id === "rank_point_progress") {
    const pointMax = rankPointMaxForSnapshot(snapshot);
    if (snapshot.rank_points == null || pointMax == null) return null;
    return round2((snapshot.rank_points / pointMax) * 100);
  }

  return snapshot[goal.id];
}

export function buildAnalysisGoalStatuses(
  goals: AnalysisGoal[],
  latestSnapshot: Snapshot | undefined
): AnalysisGoalStatus[] {
  return goals
    .filter((goal) => goal.enabled)
    .map((goal) => {
      const currentValue = latestSnapshot ? currentGoalValue(goal, latestSnapshot) : null;
      const achieved =
        currentValue == null
          ? null
          : goal.direction === "at_most"
            ? currentValue <= goal.target_value
            : currentValue >= goal.target_value;

      return {
        ...goal,
        current_value: currentValue,
        achieved,
        delta_to_target:
          currentValue == null
            ? null
            : goal.direction === "at_most"
              ? round2(currentValue - goal.target_value)
              : round2(goal.target_value - currentValue)
      };
    });
}
