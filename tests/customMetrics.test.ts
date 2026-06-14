import { describe, expect, it } from "vitest";
import {
  buildCustomMetricResults,
  computeCustomMetric,
  sanitizeCustomMetricDefinitions
} from "../src/shared/customMetrics";
import { makeSnapshot } from "./fixtures";

describe("custom metrics", () => {
  it("computes allowed metric formulas", () => {
    const result = computeCustomMetric(
      makeSnapshot({
        win_rate: 24.5,
        deal_in_rate: 12.25
      }),
      {
        id: "gap",
        label: "和了率 - 放銃率",
        left: "win_rate",
        operator: "subtract",
        right: "deal_in_rate",
        unit: "number"
      }
    );

    expect(result.value).toBe(12.25);
  });

  it("returns null for division by zero", () => {
    const result = computeCustomMetric(
      makeSnapshot({
        call_rate: 30,
        riichi_rate: 0
      }),
      {
        id: "ratio",
        label: "副露 / 立直",
        left: "call_rate",
        operator: "divide",
        right: "riichi_rate",
        unit: "number"
      }
    );

    expect(result.value).toBeNull();
  });

  it("returns null results without a snapshot", () => {
    expect(
      buildCustomMetricResults(undefined, [
        {
          id: "gap",
          label: "攻守差",
          left: "win_rate",
          operator: "subtract",
          right: "deal_in_rate",
          unit: "number"
        }
      ])
    ).toEqual([
      {
        definition: {
          id: "gap",
          label: "攻守差",
          left: "win_rate",
          operator: "subtract",
          right: "deal_in_rate",
          unit: "number"
        },
        value: null
      }
    ]);
  });

  it("sanitizes invalid definitions", () => {
    expect(
      sanitizeCustomMetricDefinitions([
        {
          id: "blank",
          label: " ",
          left: "win_rate",
          operator: "subtract",
          right: "deal_in_rate",
          unit: "number"
        },
        {
          id: "same",
          label: "同じ指標",
          left: "win_rate",
          operator: "subtract",
          right: "win_rate",
          unit: "number"
        },
        {
          id: "ok",
          label: " 攻守差 ",
          left: "win_rate",
          operator: "subtract",
          right: "deal_in_rate",
          unit: "number"
        }
      ])
    ).toEqual([
      {
        id: "ok",
        label: "攻守差",
        left: "win_rate",
        operator: "subtract",
        right: "deal_in_rate",
        unit: "number"
      }
    ]);
  });
});
