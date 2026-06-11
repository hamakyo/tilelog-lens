import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYSIS_GOALS,
  buildAnalysisGoalStatuses
} from "../src/shared/goals";
import { makeSnapshot } from "./fixtures";

describe("analysis goals", () => {
  it("evaluates enabled goals against the latest snapshot", () => {
    const statuses = buildAnalysisGoalStatuses(
      DEFAULT_ANALYSIS_GOALS,
      makeSnapshot({
        avg_place: 2.4,
        win_rate: 23,
        deal_in_rate: 12.5,
        fourth_rate: 22,
        rank_points: 640,
        rank_points_max: 800
      })
    );

    expect(statuses.find((goal) => goal.id === "avg_place")).toMatchObject({
      achieved: true,
      delta_to_target: -0.05
    });
    expect(statuses.find((goal) => goal.id === "deal_in_rate")).toMatchObject({
      achieved: false,
      delta_to_target: 0.5
    });
    expect(statuses.find((goal) => goal.id === "win_rate")).toMatchObject({
      achieved: true,
      delta_to_target: -1
    });
    expect(statuses.some((goal) => goal.id === "rank_point_progress")).toBe(false);
  });
});
