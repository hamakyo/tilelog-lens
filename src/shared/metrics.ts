import type { DerivedMetric, EstimatedDelta, Snapshot } from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function estimatedCount(matches: number, rate: number | null): number | undefined {
  if (rate == null) return undefined;
  return Math.round((matches * rate) / 100);
}

function periodRate(count: number | undefined, matchesDelta: number): number | undefined {
  if (count == null || matchesDelta <= 0) return undefined;
  return round2((count / matchesDelta) * 100);
}

function byObservedAsc(a: Snapshot, b: Snapshot): number {
  return a.observed_at_utc.localeCompare(b.observed_at_utc);
}

export function calculatedAvgPlace(snapshot: Pick<Snapshot, "first_rate" | "second_rate" | "third_rate" | "fourth_rate">): number {
  return round2(
    (snapshot.first_rate * 1 +
      snapshot.second_rate * 2 +
      snapshot.third_rate * 3 +
      snapshot.fourth_rate * 4) /
      100
  );
}

export function buildDerivedMetrics(snapshots: Snapshot[]): DerivedMetric[] {
  return [...snapshots].sort(byObservedAsc).map((snapshot) => ({
    snapshot_id: snapshot.id,
    observed_at_utc: snapshot.observed_at_utc,
    attack_defense_gap: round2(snapshot.win_rate - snapshot.deal_in_rate),
    top_two_rate: round2(snapshot.first_rate + snapshot.second_rate),
    bottom_two_rate: round2(snapshot.third_rate + snapshot.fourth_rate),
    rank_point_progress:
      snapshot.rank_points != null && snapshot.rank_points_max != null
        ? round2((snapshot.rank_points / snapshot.rank_points_max) * 100)
        : null,
    calculated_avg_place: calculatedAvgPlace(snapshot)
  }));
}

export function buildEstimatedDeltas(snapshots: Snapshot[]): EstimatedDelta[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const deltas: EstimatedDelta[] = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const matchesDelta = current.matches - previous.matches;
    const delta: EstimatedDelta = {
      from_snapshot_id: previous.id,
      to_snapshot_id: current.id,
      from_observed_at_utc: previous.observed_at_utc,
      to_observed_at_utc: current.observed_at_utc,
      matches_delta: matchesDelta,
      quality:
        matchesDelta > 0
          ? "ok"
          : matchesDelta === 0
            ? "same_matches"
            : "negative_matches"
    };

    if (matchesDelta > 0) {
      const firstDelta =
        estimatedCount(current.matches, current.first_rate)! -
        estimatedCount(previous.matches, previous.first_rate)!;
      const secondDelta =
        estimatedCount(current.matches, current.second_rate)! -
        estimatedCount(previous.matches, previous.second_rate)!;
      const thirdDelta =
        estimatedCount(current.matches, current.third_rate)! -
        estimatedCount(previous.matches, previous.third_rate)!;
      const fourthDelta =
        estimatedCount(current.matches, current.fourth_rate)! -
        estimatedCount(previous.matches, previous.fourth_rate)!;
      const winDelta =
        estimatedCount(current.matches, current.win_rate)! -
        estimatedCount(previous.matches, previous.win_rate)!;
      const dealInDelta =
        estimatedCount(current.matches, current.deal_in_rate)! -
        estimatedCount(previous.matches, previous.deal_in_rate)!;
      const callDelta =
        estimatedCount(current.matches, current.call_rate)! -
        estimatedCount(previous.matches, previous.call_rate)!;
      const riichiDelta =
        estimatedCount(current.matches, current.riichi_rate)! -
        estimatedCount(previous.matches, previous.riichi_rate)!;
      const currentTsumoCount = estimatedCount(current.matches, current.tsumo_rate);
      const previousTsumoCount = estimatedCount(previous.matches, previous.tsumo_rate);
      const tsumoDelta =
        currentTsumoCount != null && previousTsumoCount != null
          ? currentTsumoCount - previousTsumoCount
          : undefined;

      Object.assign(delta, {
        estimated_first_delta: firstDelta,
        estimated_second_delta: secondDelta,
        estimated_third_delta: thirdDelta,
        estimated_fourth_delta: fourthDelta,
        estimated_win_delta: winDelta,
        estimated_deal_in_delta: dealInDelta,
        estimated_call_delta: callDelta,
        estimated_riichi_delta: riichiDelta,
        estimated_tsumo_delta: tsumoDelta,
        period_first_rate: periodRate(firstDelta, matchesDelta),
        period_second_rate: periodRate(secondDelta, matchesDelta),
        period_third_rate: periodRate(thirdDelta, matchesDelta),
        period_fourth_rate: periodRate(fourthDelta, matchesDelta),
        period_win_rate: periodRate(winDelta, matchesDelta),
        period_deal_in_rate: periodRate(dealInDelta, matchesDelta),
        period_call_rate: periodRate(callDelta, matchesDelta),
        period_riichi_rate: periodRate(riichiDelta, matchesDelta),
        period_tsumo_rate: periodRate(tsumoDelta, matchesDelta)
      });
    }

    deltas.push(delta);
  }

  return deltas;
}
