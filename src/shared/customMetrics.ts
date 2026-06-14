import type { Snapshot } from "./types";

export type CustomMetricOperand =
  | "avg_place"
  | "first_rate"
  | "second_rate"
  | "third_rate"
  | "fourth_rate"
  | "win_rate"
  | "deal_in_rate"
  | "call_rate"
  | "riichi_rate"
  | "attack_defense_gap"
  | "top_two_rate"
  | "bottom_two_rate"
  | "rank_points";

export type CustomMetricOperator = "add" | "subtract" | "multiply" | "divide";

export type CustomMetricDefinition = {
  id: string;
  label: string;
  left: CustomMetricOperand;
  operator: CustomMetricOperator;
  right: CustomMetricOperand;
  unit: "number" | "rate" | "rank_point" | "place";
};

export type CustomMetricResult = {
  definition: CustomMetricDefinition;
  value: number | null;
};

export const customMetricOperands: Record<
  CustomMetricOperand,
  { label: string; unit: CustomMetricDefinition["unit"] }
> = {
  avg_place: { label: "平均順位", unit: "place" },
  first_rate: { label: "一位率", unit: "rate" },
  second_rate: { label: "二位率", unit: "rate" },
  third_rate: { label: "三位率", unit: "rate" },
  fourth_rate: { label: "四位率", unit: "rate" },
  win_rate: { label: "和了率", unit: "rate" },
  deal_in_rate: { label: "放銃率", unit: "rate" },
  call_rate: { label: "副露率", unit: "rate" },
  riichi_rate: { label: "立直率", unit: "rate" },
  attack_defense_gap: { label: "攻守差", unit: "number" },
  top_two_rate: { label: "1-2位率", unit: "rate" },
  bottom_two_rate: { label: "3-4位率", unit: "rate" },
  rank_points: { label: "段位ポイント", unit: "rank_point" }
};

export const customMetricOperators: Record<CustomMetricOperator, string> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/"
};

export const defaultCustomMetrics: CustomMetricDefinition[] = [
  {
    id: "win-minus-deal-in",
    label: "和了率 - 放銃率",
    left: "win_rate",
    operator: "subtract",
    right: "deal_in_rate",
    unit: "number"
  }
];

export function computeCustomMetric(
  snapshot: Snapshot,
  definition: CustomMetricDefinition
): CustomMetricResult {
  const left = operandValue(snapshot, definition.left);
  const right = operandValue(snapshot, definition.right);

  return {
    definition,
    value:
      left == null || right == null
        ? null
        : applyCustomMetricOperator(left, right, definition.operator)
  };
}

export function buildCustomMetricResults(
  snapshot: Snapshot | undefined,
  definitions: CustomMetricDefinition[]
): CustomMetricResult[] {
  if (!snapshot) {
    return definitions.map((definition) => ({
      definition,
      value: null
    }));
  }

  return definitions.map((definition) => computeCustomMetric(snapshot, definition));
}

export function sanitizeCustomMetricDefinitions(
  definitions: CustomMetricDefinition[]
): CustomMetricDefinition[] {
  return definitions
    .filter((definition) => definition.label.trim() !== "")
    .filter((definition) => definition.left !== definition.right)
    .map((definition) => ({
      ...definition,
      label: definition.label.trim()
    }));
}

function operandValue(snapshot: Snapshot, operand: CustomMetricOperand): number | null {
  if (operand === "attack_defense_gap") {
    return round2(snapshot.win_rate - snapshot.deal_in_rate);
  }
  if (operand === "top_two_rate") {
    return round2(snapshot.first_rate + snapshot.second_rate);
  }
  if (operand === "bottom_two_rate") {
    return round2(snapshot.third_rate + snapshot.fourth_rate);
  }
  return snapshot[operand] ?? null;
}

function applyCustomMetricOperator(
  left: number,
  right: number,
  operator: CustomMetricOperator
): number | null {
  if (operator === "add") return round2(left + right);
  if (operator === "subtract") return round2(left - right);
  if (operator === "multiply") return round2(left * right);
  if (right === 0) return null;
  return round2(left / right);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
