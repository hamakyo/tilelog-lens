import { GAME_MODE_LABELS } from "./constants";
import { buildEstimatedDeltas } from "./metrics";
import type { EstimatedDelta, GameMode, Snapshot } from "./types";

export type ReportPeriod = "week" | "month";

export type PeriodReport = {
  id: string;
  period: ReportPeriod;
  period_key: string;
  label: string;
  game_mode: GameMode;
  snapshot_count: number;
  from_observed_at_utc: string;
  to_observed_at_utc: string;
  matches_delta: number | null;
  latest_metrics: {
    matches: number;
    avg_place: number;
    win_rate: number;
    deal_in_rate: number;
    call_rate: number;
    riichi_rate: number;
    fourth_rate: number;
  };
  period_metrics: Pick<
    EstimatedDelta,
    "period_win_rate" | "period_deal_in_rate" | "period_call_rate" | "period_riichi_rate"
  > | null;
  quality: "ok" | "limited_data" | "insufficient_data";
  findings: string[];
  recommended_actions: string[];
};

function byObservedAsc(a: Snapshot, b: Snapshot): number {
  return a.observed_at_utc.localeCompare(b.observed_at_utc);
}

function dateFromObservedDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekKey(observedDate: string): string {
  const date = dateFromObservedDate(observedDate);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return toIsoDate(date);
}

function monthKey(observedDate: string): string {
  return observedDate.slice(0, 7);
}

function periodKey(snapshot: Snapshot, period: ReportPeriod): string {
  return period === "week" ? weekKey(snapshot.observed_date) : monthKey(snapshot.observed_date);
}

function reportLabel(period: ReportPeriod, key: string, mode: GameMode): string {
  const suffix = period === "week" ? "週" : "";
  return `${key}${suffix} / ${GAME_MODE_LABELS[mode]}`;
}

function formatRate(value: number | undefined): string {
  return value == null ? "-" : `${value.toFixed(2)}%`;
}

function buildFindings(
  latest: Snapshot,
  delta: EstimatedDelta | undefined,
  snapshotCount: number
): string[] {
  const findings = [
    `${GAME_MODE_LABELS[latest.game_mode]}の記録${snapshotCount}件、最新${latest.matches}戦です。`,
    `最新値は平均順位${latest.avg_place.toFixed(2)}、和了率${latest.win_rate.toFixed(2)}%、放銃率${latest.deal_in_rate.toFixed(2)}%です。`
  ];

  if (delta?.quality === "ok") {
    findings.push(
      `${delta.matches_delta}戦の推定値は、和了率${formatRate(delta.period_win_rate)}、放銃率${formatRate(delta.period_deal_in_rate)}です。`
    );
  } else {
    findings.push("期間内の差分推定には、同じモードで対戦数が増えた記録が2件以上必要です。");
  }

  return findings;
}

function buildRecommendedActions(latest: Snapshot, delta: EstimatedDelta | undefined): string[] {
  const actions: string[] = [];
  const periodDealInRate = delta?.period_deal_in_rate;
  const periodWinRate = delta?.period_win_rate;

  if (latest.fourth_rate >= 25) {
    actions.push("四位率が高めです。ラス回避の局面と終盤の押し引きを確認してください。");
  }
  if (latest.deal_in_rate >= 13 || (periodDealInRate != null && periodDealInRate >= 13)) {
    actions.push("放銃率が高めです。副露後・立直後の危険牌押しを見直してください。");
  }
  if (latest.win_rate < 20 || (periodWinRate != null && periodWinRate < 20)) {
    actions.push("和了率が低めです。速度不足、鳴き判断、立直判断を確認してください。");
  }
  if (latest.riichi_rate >= 24 && latest.deal_in_rate >= 12) {
    actions.push("立直率と放銃率が同時に高めです。追っかけや終盤立直の質を確認してください。");
  }

  return actions.length > 0 ? actions.slice(0, 3) : ["大きな警戒項目はありません。現状の良い指標を維持してください。"];
}

export function buildPeriodReports(
  snapshots: Snapshot[],
  period: ReportPeriod
): PeriodReport[] {
  const groups = new Map<string, Snapshot[]>();

  for (const snapshot of snapshots) {
    const key = `${periodKey(snapshot, period)}:${snapshot.game_mode}`;
    groups.set(key, [...(groups.get(key) ?? []), snapshot]);
  }

  return [...groups.entries()]
    .map(([id, groupSnapshots]) => {
      const ordered = [...groupSnapshots].sort(byObservedAsc);
      const first = ordered[0];
      const latest = ordered.at(-1)!;
      const delta = ordered.length >= 2 ? buildEstimatedDeltas([first, latest])[0] : undefined;
      const key = periodKey(latest, period);
      const matchesDelta = delta?.quality === "ok" ? delta.matches_delta : null;
      const quality: PeriodReport["quality"] =
        delta?.quality === "ok"
          ? "ok"
          : ordered.length >= 2
            ? "limited_data"
            : "insufficient_data";

      return {
        id,
        period,
        period_key: key,
        label: reportLabel(period, key, latest.game_mode),
        game_mode: latest.game_mode,
        snapshot_count: ordered.length,
        from_observed_at_utc: first.observed_at_utc,
        to_observed_at_utc: latest.observed_at_utc,
        matches_delta: matchesDelta,
        latest_metrics: {
          matches: latest.matches,
          avg_place: latest.avg_place,
          win_rate: latest.win_rate,
          deal_in_rate: latest.deal_in_rate,
          call_rate: latest.call_rate,
          riichi_rate: latest.riichi_rate,
          fourth_rate: latest.fourth_rate
        },
        period_metrics:
          delta?.quality === "ok"
            ? {
                period_win_rate: delta.period_win_rate,
                period_deal_in_rate: delta.period_deal_in_rate,
                period_call_rate: delta.period_call_rate,
                period_riichi_rate: delta.period_riichi_rate
              }
            : null,
        quality,
        findings: buildFindings(latest, delta, ordered.length),
        recommended_actions: buildRecommendedActions(latest, delta)
      };
    })
    .sort((a, b) => b.to_observed_at_utc.localeCompare(a.to_observed_at_utc));
}
