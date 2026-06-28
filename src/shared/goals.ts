import { RANK_LEVELS, RANK_POINT_MAX_BY_RANK_AND_LEVEL } from "./constants";
import type { AnalysisGoal, AnalysisGoalStatus, GoalGapComment, Snapshot } from "./types";

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

export function buildGoalGapComments(statuses: AnalysisGoalStatus[]): GoalGapComment[] {
  const weightedGap = (status: Pick<AnalysisGoalStatus, "id" | "delta_to_target">) => {
    const delta = status.delta_to_target ?? 0;
    if (status.id === "avg_place") return delta * 20;
    if (status.id === "rank_point_progress") return delta * 0.5;
    return delta;
  };

  return statuses
    .filter(
      (status): status is AnalysisGoalStatus & {
        current_value: number;
        delta_to_target: number;
      } =>
        status.achieved === false &&
        status.current_value != null &&
        status.delta_to_target != null &&
        status.delta_to_target > 0
    )
    .map((status) => {
      const severity: GoalGapComment["severity"] =
        status.delta_to_target >= (status.id === "avg_place" ? 0.15 : 3)
          ? "risk"
          : "watch";

      return {
        id: `goal-gap-${status.id}`,
        title: `${status.label}が目標未達`,
        severity,
        message:
          status.direction === "at_most"
            ? `${status.label}は目標より${status.delta_to_target.toFixed(2)}高い状態です。`
            : `${status.label}は目標まで${status.delta_to_target.toFixed(2)}不足しています。`,
        current_value: status.current_value,
        target_value: status.target_value,
        delta_to_target: status.delta_to_target
      };
    })
    .sort((a, b) => {
      const sourceA = statuses.find((status) => `goal-gap-${status.id}` === a.id);
      const sourceB = statuses.find((status) => `goal-gap-${status.id}` === b.id);
      return weightedGap(sourceB ?? { id: "win_rate", delta_to_target: b.delta_to_target }) -
        weightedGap(sourceA ?? { id: "win_rate", delta_to_target: a.delta_to_target });
    })
    .slice(0, 3);
}
