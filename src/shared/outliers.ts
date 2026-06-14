import type { Snapshot } from "./types";

export type OutlierSignal = {
  id: string;
  label: string;
  severity: "watch" | "risk";
  current_value: number;
  baseline_value: number;
  delta: number;
  message: string;
};

type OutlierMetric = {
  id: string;
  label: string;
  value: (snapshot: Snapshot) => number;
  risk_delta: number;
  watch_delta: number;
  direction: "up_is_bad" | "down_is_bad";
};

const outlierMetrics: OutlierMetric[] = [
  {
    id: "avg_place",
    label: "平均順位",
    value: (snapshot) => snapshot.avg_place,
    risk_delta: 0.2,
    watch_delta: 0.1,
    direction: "up_is_bad"
  },
  {
    id: "fourth_rate",
    label: "四位率",
    value: (snapshot) => snapshot.fourth_rate,
    risk_delta: 4,
    watch_delta: 2,
    direction: "up_is_bad"
  },
  {
    id: "win_rate",
    label: "和了率",
    value: (snapshot) => snapshot.win_rate,
    risk_delta: 4,
    watch_delta: 2,
    direction: "down_is_bad"
  },
  {
    id: "deal_in_rate",
    label: "放銃率",
    value: (snapshot) => snapshot.deal_in_rate,
    risk_delta: 3,
    watch_delta: 1.5,
    direction: "up_is_bad"
  }
];

export function detectOutlierSignals(snapshots: Snapshot[]): OutlierSignal[] {
  const ordered = [...snapshots].sort((a, b) =>
    a.observed_at_utc.localeCompare(b.observed_at_utc)
  );
  const latest = ordered.at(-1);
  const baseline = ordered.slice(0, -1);
  if (!latest || baseline.length < 2) return [];

  return outlierMetrics.flatMap((metric) => {
    const current = round2(metric.value(latest));
    const baselineValue = average(baseline.map(metric.value));
    const delta = round2(current - baselineValue);
    const directionalDelta =
      metric.direction === "up_is_bad" ? delta : round2(delta * -1);

    if (directionalDelta >= metric.risk_delta) {
      return [
        signal(metric, "risk", current, baselineValue, delta)
      ];
    }
    if (directionalDelta >= metric.watch_delta) {
      return [
        signal(metric, "watch", current, baselineValue, delta)
      ];
    }
    return [];
  });
}

function signal(
  metric: OutlierMetric,
  severity: OutlierSignal["severity"],
  currentValue: number,
  baselineValue: number,
  delta: number
): OutlierSignal {
  return {
    id: metric.id,
    label: metric.label,
    severity,
    current_value: currentValue,
    baseline_value: baselineValue,
    delta,
    message: `${metric.label}が過去平均から${delta > 0 ? "+" : ""}${delta}変化しています。`
  };
}

function average(values: number[]): number {
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
