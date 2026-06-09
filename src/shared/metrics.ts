import type {
  DerivedMetric,
  EstimatedDelta,
  ImprovementPriority,
  PeriodAnalysis,
  Snapshot
} from "./types";

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

function severityForScore(score: number): ImprovementPriority["severity"] {
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function priority(
  id: string,
  title: string,
  score: number,
  reason: string,
  action: string,
  metric: string,
  currentValue: number,
  targetValue: number
): ImprovementPriority {
  const roundedScore = Math.min(100, Math.max(1, Math.round(score)));
  return {
    id,
    title,
    severity: severityForScore(roundedScore),
    score: roundedScore,
    reason,
    action,
    metric,
    current_value: round2(currentValue),
    target_value: targetValue
  };
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

export function buildPeriodAnalyses(
  snapshots: Snapshot[],
  windows: number[] = [10, 50, 100]
): PeriodAnalysis[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const latest = ordered.at(-1);
  if (!latest) return [];

  const analyses: PeriodAnalysis[] = [];

  for (const targetMatches of windows) {
    const targetBaselineMatches = latest.matches - targetMatches;
    const candidates = ordered.filter(
      (snapshot) =>
        snapshot.id !== latest.id &&
        snapshot.matches < latest.matches &&
        snapshot.observed_at_utc < latest.observed_at_utc
    );
    const baseline =
      candidates
        .filter((snapshot) => snapshot.matches <= targetBaselineMatches)
        .at(-1) ?? candidates[0];

    if (!baseline) {
      analyses.push({
        label: `直近${targetMatches}戦`,
        target_matches: targetMatches,
        actual_matches: 0,
        from_snapshot_id: latest.id,
        to_snapshot_id: latest.id,
        from_observed_at_utc: latest.observed_at_utc,
        to_observed_at_utc: latest.observed_at_utc,
        quality: "insufficient_data"
      });
      continue;
    }

    const matchesDelta = latest.matches - baseline.matches;
    if (matchesDelta <= 0) {
      analyses.push({
        label: `直近${targetMatches}戦`,
        target_matches: targetMatches,
        actual_matches: matchesDelta,
        from_snapshot_id: baseline.id,
        to_snapshot_id: latest.id,
        from_observed_at_utc: baseline.observed_at_utc,
        to_observed_at_utc: latest.observed_at_utc,
        quality: "insufficient_data"
      });
      continue;
    }

    const firstDelta =
      estimatedCount(latest.matches, latest.first_rate)! -
      estimatedCount(baseline.matches, baseline.first_rate)!;
    const secondDelta =
      estimatedCount(latest.matches, latest.second_rate)! -
      estimatedCount(baseline.matches, baseline.second_rate)!;
    const thirdDelta =
      estimatedCount(latest.matches, latest.third_rate)! -
      estimatedCount(baseline.matches, baseline.third_rate)!;
    const fourthDelta =
      estimatedCount(latest.matches, latest.fourth_rate)! -
      estimatedCount(baseline.matches, baseline.fourth_rate)!;
    const winDelta =
      estimatedCount(latest.matches, latest.win_rate)! -
      estimatedCount(baseline.matches, baseline.win_rate)!;
    const dealInDelta =
      estimatedCount(latest.matches, latest.deal_in_rate)! -
      estimatedCount(baseline.matches, baseline.deal_in_rate)!;
    const callDelta =
      estimatedCount(latest.matches, latest.call_rate)! -
      estimatedCount(baseline.matches, baseline.call_rate)!;
    const riichiDelta =
      estimatedCount(latest.matches, latest.riichi_rate)! -
      estimatedCount(baseline.matches, baseline.riichi_rate)!;
    const periodWinRate = periodRate(winDelta, matchesDelta);
    const periodDealInRate = periodRate(dealInDelta, matchesDelta);

    analyses.push({
      label: `直近${targetMatches}戦`,
      target_matches: targetMatches,
      actual_matches: matchesDelta,
      from_snapshot_id: baseline.id,
      to_snapshot_id: latest.id,
      from_observed_at_utc: baseline.observed_at_utc,
      to_observed_at_utc: latest.observed_at_utc,
      period_avg_place: round2(
        (firstDelta + secondDelta * 2 + thirdDelta * 3 + fourthDelta * 4) /
          matchesDelta
      ),
      period_first_rate: periodRate(firstDelta, matchesDelta),
      period_second_rate: periodRate(secondDelta, matchesDelta),
      period_third_rate: periodRate(thirdDelta, matchesDelta),
      period_fourth_rate: periodRate(fourthDelta, matchesDelta),
      period_win_rate: periodWinRate,
      period_deal_in_rate: periodDealInRate,
      period_call_rate: periodRate(callDelta, matchesDelta),
      period_riichi_rate: periodRate(riichiDelta, matchesDelta),
      attack_defense_gap:
        periodWinRate != null && periodDealInRate != null
          ? round2(periodWinRate - periodDealInRate)
          : undefined,
      quality:
        matchesDelta >= targetMatches && matchesDelta <= targetMatches * 1.5
          ? "ok"
          : "limited_data"
    });
  }

  return analyses;
}

export function buildImprovementPriorities(
  snapshots: Snapshot[]
): ImprovementPriority[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const latest = ordered.at(-1);
  if (!latest) return [];

  const recent = buildPeriodAnalyses(ordered, [50, 10]).find(
    (period) => period.quality !== "insufficient_data"
  );
  const recentDealInRate = recent?.period_deal_in_rate ?? latest.deal_in_rate;
  const recentWinRate = recent?.period_win_rate ?? latest.win_rate;
  const recentFourthRate = recent?.period_fourth_rate ?? latest.fourth_rate;
  const attackDefenseGap = latest.win_rate - latest.deal_in_rate;
  const priorities: ImprovementPriority[] = [];

  if (latest.deal_in_rate > 12 || recentDealInRate > 12) {
    priorities.push(
      priority(
        "deal-in-rate",
        "放銃率を下げる",
        (Math.max(latest.deal_in_rate, recentDealInRate) - 11.5) * 12,
        `最新${round2(latest.deal_in_rate)}%、直近期${round2(recentDealInRate)}%です。`,
        "押し返す局面を絞り、親番・ドラ周辺・終盤の無筋押しを重点的に見直します。",
        "放銃率",
        Math.max(latest.deal_in_rate, recentDealInRate),
        12
      )
    );
  }

  if (latest.win_rate < 20 || recentWinRate < 20) {
    priorities.push(
      priority(
        "win-rate",
        "和了率を戻す",
        (20.5 - Math.min(latest.win_rate, recentWinRate)) * 12,
        `最新${round2(latest.win_rate)}%、直近期${round2(recentWinRate)}%です。`,
        "序盤の孤立牌選択と鳴き判断を確認し、速度を落としている打牌を洗い出します。",
        "和了率",
        Math.min(latest.win_rate, recentWinRate),
        20
      )
    );
  }

  if (latest.fourth_rate > 24 || recentFourthRate > 24) {
    priorities.push(
      priority(
        "fourth-rate",
        "ラス率を抑える",
        (Math.max(latest.fourth_rate, recentFourthRate) - 23.5) * 10,
        `最新${round2(latest.fourth_rate)}%、直近期${round2(recentFourthRate)}%です。`,
        "南場の着順判断とオーラス条件をメモし、無理なトップ狙いでラスに落ちる局面を減らします。",
        "四位率",
        Math.max(latest.fourth_rate, recentFourthRate),
        24
      )
    );
  }

  if (latest.avg_place > 2.5) {
    priorities.push(
      priority(
        "avg-place",
        "平均順位を改善する",
        (latest.avg_place - 2.45) * 85,
        `最新平均順位は${round2(latest.avg_place)}です。`,
        "1位率だけでなく3位率と4位率の圧縮を優先し、失点を抑える局面を増やします。",
        "平均順位",
        latest.avg_place,
        2.5
      )
    );
  }

  if (attackDefenseGap < 8) {
    priorities.push(
      priority(
        "attack-defense-gap",
        "攻守差を広げる",
        (8 - attackDefenseGap) * 8,
        `和了率から放銃率を引いた攻守差は${round2(attackDefenseGap)}ptです。`,
        "和了率を上げる施策と放銃率を下げる施策を同時に追い、攻撃参加の質を確認します。",
        "攻守差",
        attackDefenseGap,
        8
      )
    );
  }

  if (latest.call_rate > 35 && latest.deal_in_rate > 12) {
    priorities.push(
      priority(
        "call-risk",
        "副露後の守備を見直す",
        (latest.call_rate - 34) * 3 + (latest.deal_in_rate - 11.5) * 8,
        `副露率${round2(latest.call_rate)}%、放銃率${round2(latest.deal_in_rate)}%です。`,
        "鳴いた後に降り切れない局を抽出し、安手・遠い仕掛けの開始基準を厳しくします。",
        "副露率",
        latest.call_rate,
        35
      )
    );
  }

  return priorities
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
