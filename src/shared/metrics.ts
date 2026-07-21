import type {
  AnalysisComment,
  AttackStyleClassification,
  DataQualityIssue,
  DerivedMetric,
  DuplicateSnapshotCandidate,
  EstimatedDelta,
  FocusRecommendation,
  ImprovementPriority,
  MetricDistribution,
  PeriodComparison,
  PeriodAnalysis,
  RankPointAnalysis,
  RegressionFactor,
  RiichiRiskSignal,
  RiichiTrendAnalysis,
  Snapshot,
  SnapshotComparison,
  SnapshotComparisonMetric,
  SnapshotCreateInput,
  StabilityScore,
  ValidationWarning
} from "./types";
import { RANK_LEVELS, RANK_POINT_MAX_BY_RANK_AND_LEVEL } from "./constants";

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
  return (
    a.observed_at_utc.localeCompare(b.observed_at_utc) ||
    a.id - b.id
  );
}

const estimatedCalculationMethod =
  "difference_of_rounded_cumulative_rates" as const;

function sampleStrength(actualMatches: number): PeriodAnalysis["sample_strength"] {
  if (actualMatches >= 100) return "assessment";
  if (actualMatches >= 25) return "trend";
  return "reference";
}

function periodConfidence(
  windowErrorRate: number,
  actualMatches: number
): PeriodAnalysis["confidence"] {
  const windowConfidence = windowErrorRate <= 0.1 ? 2 : windowErrorRate <= 0.25 ? 1 : 0;
  const sampleConfidence = actualMatches >= 100 ? 2 : actualMatches >= 25 ? 1 : 0;
  return (["low", "medium", "high"] as const)[
    Math.min(windowConfidence, sampleConfidence)
  ];
}

function inputObservedKey(input: Pick<SnapshotCreateInput, "observed_date" | "observed_time">): string {
  return `${input.observed_date}T${input.observed_time}`;
}

function snapshotObservedKey(snapshot: Pick<Snapshot, "observed_date" | "observed_time">): string {
  return `${snapshot.observed_date}T${snapshot.observed_time}`;
}

function severityForScore(score: number): ImprovementPriority["severity"] {
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function comparisonMetric(
  key: string,
  label: string,
  fromValue: number | null,
  toValue: number | null,
  unit: SnapshotComparisonMetric["unit"],
  betterDirection: SnapshotComparisonMetric["better_direction"]
): SnapshotComparisonMetric {
  return {
    key,
    label,
    from_value: fromValue,
    to_value: toValue,
    delta:
      fromValue == null || toValue == null
        ? null
        : round2(toValue - fromValue),
    unit,
    better_direction: betterDirection
  };
}

function average(values: Array<number | null | undefined>): number | null {
  const usableValues = values.filter((value): value is number => value != null);
  if (usableValues.length === 0) return null;
  return round2(
    usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return round2(ordered[midpoint]);
  return round2((ordered[midpoint - 1] + ordered[midpoint]) / 2);
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = average(values);
  if (avg == null) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return round2(Math.sqrt(variance));
}

function distributionStability(
  standardDeviationValue: number | null,
  unit: MetricDistribution["unit"]
): MetricDistribution["stability"] {
  if (standardDeviationValue == null) return "insufficient_data";
  const watchThreshold = unit === "place" ? 0.08 : unit === "rate" ? 1.5 : 30;
  const volatileThreshold = unit === "place" ? 0.16 : unit === "rate" ? 3 : 80;
  if (standardDeviationValue >= volatileThreshold) return "volatile";
  if (standardDeviationValue >= watchThreshold) return "watch";
  return "stable";
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

function rankPointMaxFor(snapshot: Snapshot): number | null {
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

export function calculatedAvgPlace(snapshot: Pick<Snapshot, "first_rate" | "second_rate" | "third_rate" | "fourth_rate">): number {
  return round2(
    (snapshot.first_rate * 1 +
      snapshot.second_rate * 2 +
      snapshot.third_rate * 3 +
      snapshot.fourth_rate * 4) /
      100
  );
}

function buildConsistencyWarnings(
  snapshot: Pick<SnapshotCreateInput, "first_rate" | "second_rate" | "third_rate" | "fourth_rate" | "avg_place">
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const rankRateSum =
    snapshot.first_rate +
    snapshot.second_rate +
    snapshot.third_rate +
    snapshot.fourth_rate;

  if (Math.abs(rankRateSum - 100) > 0.2) {
    warnings.push({
      code: "RANK_RATE_SUM_NOT_100",
      message: "順位率の合計が約100%になっていません。",
      severity: "warning"
    });
  }

  if (Math.abs(calculatedAvgPlace(snapshot) - snapshot.avg_place) > 0.03) {
    warnings.push({
      code: "AVG_PLACE_MISMATCH",
      message: "平均順位と順位率から計算した値が大きくずれています。",
      severity: "warning"
    });
  }

  return warnings;
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
      calculation_method: estimatedCalculationMethod,
      is_estimated: true,
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

  const candidates = ordered.filter(
    (snapshot) =>
      snapshot.id !== latest.id &&
      snapshot.matches < latest.matches &&
      snapshot.observed_at_utc < latest.observed_at_utc
  );
  const analyses: PeriodAnalysis[] = [];

  for (const targetMatches of windows) {
    const baseline = [...candidates].sort((a, b) => {
      const aDistance = Math.abs(latest.matches - a.matches - targetMatches);
      const bDistance = Math.abs(latest.matches - b.matches - targetMatches);
      return (
        aDistance - bDistance ||
        b.observed_at_utc.localeCompare(a.observed_at_utc) ||
        b.id - a.id
      );
    })[0];

    if (!baseline) {
      analyses.push({
        label: `直近${targetMatches}戦`,
        target_matches: targetMatches,
        actual_matches: 0,
        from_snapshot_id: null,
        to_snapshot_id: latest.id,
        from_observed_at_utc: null,
        to_observed_at_utc: latest.observed_at_utc,
        calculation_method: estimatedCalculationMethod,
        is_estimated: true,
        window_error_rate: null,
        confidence: "low",
        sample_strength: "reference",
        quality: "insufficient_data"
      });
      continue;
    }

    const matchesDelta = latest.matches - baseline.matches;
    const windowErrorRate = round2(
      Math.abs(matchesDelta - targetMatches) / targetMatches
    );
    const strength = sampleStrength(matchesDelta);
    const confidence = periodConfidence(windowErrorRate, matchesDelta);
    const quality: PeriodAnalysis["quality"] =
      matchesDelta < 10 || windowErrorRate > 0.25
        ? "insufficient_data"
        : windowErrorRate <= 0.1
          ? "ok"
          : "limited_data";
    const label =
      quality === "ok"
        ? `直近${targetMatches}戦`
        : `直近約${targetMatches}戦（実測${matchesDelta}戦）`;

    if (quality === "insufficient_data") {
      analyses.push({
        label,
        target_matches: targetMatches,
        actual_matches: matchesDelta,
        from_snapshot_id: baseline.id,
        to_snapshot_id: latest.id,
        from_observed_at_utc: baseline.observed_at_utc,
        to_observed_at_utc: latest.observed_at_utc,
        calculation_method: estimatedCalculationMethod,
        is_estimated: true,
        window_error_rate: windowErrorRate,
        confidence,
        sample_strength: strength,
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
      label,
      target_matches: targetMatches,
      actual_matches: matchesDelta,
      from_snapshot_id: baseline.id,
      to_snapshot_id: latest.id,
      from_observed_at_utc: baseline.observed_at_utc,
      to_observed_at_utc: latest.observed_at_utc,
      calculation_method: estimatedCalculationMethod,
      is_estimated: true,
      window_error_rate: windowErrorRate,
      confidence,
      sample_strength: strength,
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
      quality
    });
  }

  return analyses.filter((analysis, index) => {
    if (analysis.from_snapshot_id == null) return true;
    const duplicates = analyses.filter(
      (candidate) => candidate.from_snapshot_id === analysis.from_snapshot_id
    );
    const preferred = duplicates.sort((a, b) => {
      const aError = a.window_error_rate ?? Number.POSITIVE_INFINITY;
      const bError = b.window_error_rate ?? Number.POSITIVE_INFINITY;
      return aError - bError || a.target_matches - b.target_matches;
    })[0];
    return analyses.indexOf(preferred) === index;
  });
}

export function buildRiichiTrendAnalyses(snapshots: Snapshot[]): RiichiTrendAnalysis[] {
  return buildPeriodAnalyses(snapshots, [10, 50, 100]).map((period) => {
    const riichiRate = period.period_riichi_rate ?? null;
    const winRate = period.period_win_rate ?? null;
    const dealInRate = period.period_deal_in_rate ?? null;
    const balanceGap =
      riichiRate == null || winRate == null || dealInRate == null
        ? null
        : round2(winRate - dealInRate - Math.max(0, riichiRate - 20) * 0.2);
    const status: RiichiTrendAnalysis["status"] =
      period.quality === "insufficient_data" || riichiRate == null || winRate == null || dealInRate == null
        ? "insufficient_data"
        : (riichiRate >= 24 && (winRate < 20 || dealInRate >= 13)) ||
            (balanceGap != null && balanceGap < 3)
          ? "risk"
          : riichiRate >= 22 && (winRate < 21 || dealInRate >= 12)
            ? "watch"
            : "good";

    return {
      label: period.label,
      actual_matches: period.actual_matches,
      riichi_rate: riichiRate,
      win_rate: winRate,
      deal_in_rate: dealInRate,
      balance_gap: balanceGap,
      status,
      message:
        status === "good"
          ? "直近期の立直率と攻守のバランスは大きく崩れていません。"
          : status === "watch"
            ? "立直率と和了率・放銃率の組み合わせに注意が必要です。"
            : status === "risk"
              ? "立直が和了率低下または放銃増加と同時に出ている可能性があります。"
              : "立直トレンドの判定には、同じモードの追加記録が必要です。"
    };
  });
}

export function buildRiichiRiskSignals(snapshots: Snapshot[]): RiichiRiskSignal[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const latest = ordered.at(-1);
  if (!latest) return [];

  const recent = buildRiichiTrendAnalyses(ordered).find(
    (trend) => trend.status !== "insufficient_data"
  );
  const recentRiichiRate = recent?.riichi_rate ?? latest.riichi_rate;
  const recentWinRate = recent?.win_rate ?? latest.win_rate;
  const recentDealInRate = recent?.deal_in_rate ?? latest.deal_in_rate;
  const signals: RiichiRiskSignal[] = [];

  if (recentRiichiRate >= 24 && recentWinRate < 20) {
    signals.push({
      id: "high-riichi-low-win",
      title: "高立直率 + 低和了率",
      severity: "risk",
      message: `直近期の立直率は${recentRiichiRate.toFixed(2)}%、和了率は${recentWinRate.toFixed(2)}%です。待ちの質や先制でない立直を確認してください。`,
      focus: ["立直率", "和了率", "待ちの質"]
    });
  }

  if (recentRiichiRate >= 24 && recentDealInRate >= 13) {
    signals.push({
      id: "high-riichi-high-deal-in",
      title: "高立直率 + 高放銃率",
      severity: "risk",
      message: `直近期の立直率は${recentRiichiRate.toFixed(2)}%、放銃率は${recentDealInRate.toFixed(2)}%です。危険局面の立直判断を確認してください。`,
      focus: ["立直率", "放銃率", "終盤立直"]
    });
  }

  if (recentRiichiRate < 16 && recentWinRate < 22) {
    signals.push({
      id: "low-riichi-low-win",
      title: "低立直率 + 低和了率",
      severity: "watch",
      message: `直近期の立直率は${recentRiichiRate.toFixed(2)}%、和了率は${recentWinRate.toFixed(2)}%です。門前手の打点化やリーチ判断が消極的になっていないか確認してください。`,
      focus: ["立直率", "和了率", "門前手"]
    });
  }

  if (latest.avg_win_turn != null && latest.avg_win_turn >= 12.5 && latest.win_rate < 20) {
    signals.push({
      id: "late-win-turn-low-win",
      title: "和了巡目遅め + 低和了率",
      severity: "watch",
      message: `平均和了巡は${latest.avg_win_turn.toFixed(2)}巡、和了率は${latest.win_rate.toFixed(2)}%です。手組み速度と立直までの巡目を確認してください。`,
      focus: ["平均和了巡", "和了率", "手組み速度"]
    });
  }

  if (latest.avg_win_score != null && latest.avg_win_score < 6500 && latest.win_rate < 20) {
    signals.push({
      id: "low-score-low-win",
      title: "低打点 + 低和了率",
      severity: "watch",
      message: `平均和了点は${latest.avg_win_score}点、和了率は${latest.win_rate.toFixed(2)}%です。立直で打点を作る局面と速度を両方確認してください。`,
      focus: ["平均和了点", "和了率", "打点作り"]
    });
  }

  return signals.slice(0, 4);
}

export function buildAttackStyleClassification(
  snapshots: Snapshot[]
): AttackStyleClassification | null {
  const latest = [...snapshots].sort(byObservedAsc).at(-1);
  if (!latest) return null;

  const attackDefenseGap = latest.win_rate - latest.deal_in_rate;

  if (latest.deal_in_rate >= 13 && (latest.riichi_rate >= 23 || latest.call_rate >= 35)) {
    return {
      type: "over_push",
      label: "押しすぎ",
      status: "risk",
      summary: "攻撃参加が放銃率の高さと同時に出ています。立直・副露後の撤退基準を確認してください。",
      focus: ["放銃率", "立直率", "副露率"]
    };
  }

  if (latest.win_rate < 20 && latest.riichi_rate < 17 && latest.call_rate < 30) {
    return {
      type: "under_attack",
      label: "攻撃不足",
      status: "watch",
      summary: "和了率が低く、立直率・副露率も控えめです。速度不足や打点化の機会損失を確認してください。",
      focus: ["和了率", "立直率", "副露率"]
    };
  }

  if (latest.riichi_rate >= 23 && latest.call_rate < 32) {
    return {
      type: "riichi_focused",
      label: "立直寄り",
      status: attackDefenseGap >= 8 ? "good" : "watch",
      summary:
        attackDefenseGap >= 8
          ? "門前立直寄りで、攻守差も確保できています。"
          : "立直寄りですが攻守差が小さめです。立直後の放銃と和了率を確認してください。",
      focus: ["立直率", "攻守差", "放銃率"]
    };
  }

  if (latest.call_rate >= 35 && latest.riichi_rate < 22) {
    return {
      type: "call_focused",
      label: "副露寄り",
      status: latest.deal_in_rate <= 12 ? "good" : "watch",
      summary:
        latest.deal_in_rate <= 12
          ? "副露寄りですが放銃率は抑えられています。仕掛けの守備移行は大きく崩れていません。"
          : "副露寄りで放銃率がやや高めです。仕掛け後の押し引きを確認してください。",
      focus: ["副露率", "放銃率", "和了率"]
    };
  }

  if (latest.deal_in_rate <= 10.5 && latest.win_rate < 21) {
    return {
      type: "defensive",
      label: "守備寄り",
      status: "watch",
      summary: "放銃率は低い一方で和了率も控えめです。守備過多で速度を落としていないか確認してください。",
      focus: ["放銃率", "和了率", "平均順位"]
    };
  }

  return {
    type: "balanced",
    label: "バランス型",
    status: "good",
    summary: "立直率・副露率・攻守差のバランスは大きく偏っていません。",
    focus: ["立直率", "副露率", "攻守差"]
  };
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

export function buildAnalysisComments(snapshots: Snapshot[]): AnalysisComment[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const latest = ordered.at(-1);
  if (!latest) return [];

  const comments: AnalysisComment[] = [];
  const recent = buildPeriodAnalyses(ordered, [10, 50]).find(
    (period) => period.quality !== "insufficient_data"
  );
  const attackDefenseGap = round2(latest.win_rate - latest.deal_in_rate);

  if (recent?.period_win_rate != null && recent.period_deal_in_rate != null) {
    const recentGap = round2(recent.period_win_rate - recent.period_deal_in_rate);
    comments.push({
      id: "recent-attack-defense",
      severity: recentGap >= 8 ? "good" : recentGap >= 4 ? "watch" : "risk",
      title: `${recent.label}の攻守差`,
      message: `和了率${recent.period_win_rate.toFixed(2)}%、放銃率${recent.period_deal_in_rate.toFixed(2)}%、攻守差${recentGap.toFixed(2)}ptです。`
    });
  }

  if (latest.deal_in_rate > 13) {
    comments.push({
      id: "deal-in-risk",
      severity: "risk",
      title: "放銃率が高め",
      message: `最新の放銃率は${latest.deal_in_rate.toFixed(2)}%です。終盤の押し返しと副露後の守備を優先して確認してください。`
    });
  } else if (latest.deal_in_rate <= 11.5) {
    comments.push({
      id: "deal-in-good",
      severity: "good",
      title: "放銃率は良好",
      message: `最新の放銃率は${latest.deal_in_rate.toFixed(2)}%で、守備面は安定しています。`
    });
  }

  if (latest.win_rate < 20) {
    comments.push({
      id: "win-rate-watch",
      severity: "watch",
      title: "和了率の低下に注意",
      message: `最新の和了率は${latest.win_rate.toFixed(2)}%です。配牌降り気味の局面と鳴き判断を見直す余地があります。`
    });
  }

  comments.push({
    id: "latest-summary",
    severity: attackDefenseGap >= 8 ? "good" : "watch",
    title: "最新累積の概要",
    message: `平均順位${latest.avg_place.toFixed(2)}、和了率${latest.win_rate.toFixed(2)}%、放銃率${latest.deal_in_rate.toFixed(2)}%、攻守差${attackDefenseGap.toFixed(2)}ptです。`
  });

  return comments.slice(0, 4);
}

export function buildRankPointAnalysis(snapshots: Snapshot[]): RankPointAnalysis | null {
  const ordered = [...snapshots].sort(byObservedAsc);
  const latest = ordered.at(-1);
  if (!latest) return null;

  const pointMax = rankPointMaxFor(latest);
  const currentPoints = latest.rank_points;
  const previous = [...ordered]
    .slice(0, -1)
    .reverse()
    .find((snapshot) => snapshot.rank_points != null);
  const rankChangedSincePrevious =
    previous != null &&
    (previous.rank_name !== latest.rank_name || previous.rank_level !== latest.rank_level);
  const canComparePrevious =
    previous != null && !rankChangedSincePrevious && currentPoints != null;
  const pointDelta =
    canComparePrevious && previous.rank_points != null
      ? currentPoints - previous.rank_points
      : null;
  const matchesDelta =
    canComparePrevious && latest.matches > previous.matches
      ? latest.matches - previous.matches
      : null;
  const pointsPerMatch =
    pointDelta != null && matchesDelta != null && matchesDelta > 0
      ? round2(pointDelta / matchesDelta)
      : null;
  const remainingPoints =
    currentPoints != null && pointMax != null
      ? Math.max(0, pointMax - currentPoints)
      : null;
  const projectedMatchesToPromotion =
    remainingPoints != null && remainingPoints > 0 && pointsPerMatch != null && pointsPerMatch > 0
      ? Math.ceil(remainingPoints / pointsPerMatch)
      : null;

  return {
    rank_name: latest.rank_name,
    rank_level: latest.rank_level,
    current_points: currentPoints,
    point_max: pointMax,
    progress_rate:
      currentPoints != null && pointMax != null
        ? round2((currentPoints / pointMax) * 100)
        : null,
    remaining_points: remainingPoints,
    previous_points: previous?.rank_points ?? null,
    point_delta: pointDelta,
    matches_delta: matchesDelta,
    points_per_match: pointsPerMatch,
    projected_matches_to_promotion: projectedMatchesToPromotion,
    rank_changed_since_previous: rankChangedSincePrevious,
    status:
      currentPoints == null
        ? "missing_points"
        : pointMax == null
          ? "missing_cap"
          : "ready"
  };
}

export function buildMetricDistributions(snapshots: Snapshot[]): MetricDistribution[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const latest = ordered.at(-1);
  const definitions: Array<{
    key: string;
    label: string;
    unit: MetricDistribution["unit"];
    value: (snapshot: Snapshot) => number | null;
  }> = [
    { key: "avg_place", label: "平均順位", unit: "place", value: (snapshot) => snapshot.avg_place },
    { key: "win_rate", label: "和了率", unit: "rate", value: (snapshot) => snapshot.win_rate },
    { key: "deal_in_rate", label: "放銃率", unit: "rate", value: (snapshot) => snapshot.deal_in_rate },
    {
      key: "attack_defense_gap",
      label: "攻守差",
      unit: "number",
      value: (snapshot) => round2(snapshot.win_rate - snapshot.deal_in_rate)
    },
    { key: "fourth_rate", label: "四位率", unit: "rate", value: (snapshot) => snapshot.fourth_rate },
    { key: "call_rate", label: "副露率", unit: "rate", value: (snapshot) => snapshot.call_rate },
    { key: "riichi_rate", label: "立直率", unit: "rate", value: (snapshot) => snapshot.riichi_rate },
    {
      key: "rank_point_progress",
      label: "段位pt進捗",
      unit: "rate",
      value: (snapshot) => {
        const pointMax = rankPointMaxFor(snapshot);
        if (snapshot.rank_points == null || pointMax == null || pointMax <= 0) return null;
        return round2((snapshot.rank_points / pointMax) * 100);
      }
    }
  ];

  return definitions.map((definition) => {
    const values = ordered
      .map((snapshot) => definition.value(snapshot))
      .filter((value): value is number => value != null);
    const avg = average(values);
    const standardDeviationValue = standardDeviation(values);
    const latestValue = latest ? definition.value(latest) : null;

    return {
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      count: values.length,
      average: avg,
      median: median(values),
      min: values.length > 0 ? round2(Math.min(...values)) : null,
      max: values.length > 0 ? round2(Math.max(...values)) : null,
      standard_deviation: standardDeviationValue,
      latest_value: latestValue,
      latest_delta_from_average:
        latestValue == null || avg == null ? null : round2(latestValue - avg),
      stability: distributionStability(standardDeviationValue, definition.unit)
    };
  });
}

export function buildStabilityScore(snapshots: Snapshot[]): StabilityScore {
  const distributions = buildMetricDistributions(snapshots).filter(
    (distribution) => distribution.count >= 3
  );

  if (distributions.length === 0) {
    return {
      score: null,
      status: "insufficient_data",
      summary: "安定性スコアの判定には、同じ分析対象で3件以上の記録が必要です。",
      volatile_metrics: [],
      watch_metrics: []
    };
  }

  const pointByStatus: Record<MetricDistribution["stability"], number> = {
    stable: 100,
    watch: 65,
    volatile: 30,
    insufficient_data: 0
  };
  const score = Math.round(
    distributions.reduce(
      (sum, distribution) => sum + pointByStatus[distribution.stability],
      0
    ) / distributions.length
  );
  const volatileMetrics = distributions
    .filter((distribution) => distribution.stability === "volatile")
    .map((distribution) => distribution.label);
  const watchMetrics = distributions
    .filter((distribution) => distribution.stability === "watch")
    .map((distribution) => distribution.label);
  const status: StabilityScore["status"] =
    volatileMetrics.length >= 2
      ? "volatile"
      : score >= 85
        ? "stable"
        : score >= 60
          ? "watch"
          : "volatile";

  return {
    score,
    status,
    summary:
      status === "stable"
        ? "主要指標のブレは小さく、傾向を読み取りやすい状態です。"
        : status === "watch"
          ? "一部指標にブレがあります。直近期と長期傾向を分けて確認してください。"
          : "複数指標の変動が大きい状態です。短期の上振れ/下振れを切り分けてください。",
    volatile_metrics: volatileMetrics,
    watch_metrics: watchMetrics
  };
}

export function buildSnapshotComparison(
  fromSnapshot: Snapshot,
  toSnapshot: Snapshot
): SnapshotComparison {
  const matchesDelta = toSnapshot.matches - fromSnapshot.matches;
  const differentMode = fromSnapshot.game_mode !== toSnapshot.game_mode;

  return {
    from_snapshot_id: fromSnapshot.id,
    to_snapshot_id: toSnapshot.id,
    from_observed_at_utc: fromSnapshot.observed_at_utc,
    to_observed_at_utc: toSnapshot.observed_at_utc,
    matches_delta: matchesDelta,
    quality: differentMode
      ? "different_mode"
      : matchesDelta > 0
        ? "ok"
        : matchesDelta === 0
          ? "same_matches"
          : "negative_matches",
    metrics: [
      comparisonMetric("matches", "対戦数", fromSnapshot.matches, toSnapshot.matches, "number", "up"),
      comparisonMetric("avg_place", "平均順位", fromSnapshot.avg_place, toSnapshot.avg_place, "place", "down"),
      comparisonMetric("first_rate", "一位率", fromSnapshot.first_rate, toSnapshot.first_rate, "rate", "up"),
      comparisonMetric("second_rate", "二位率", fromSnapshot.second_rate, toSnapshot.second_rate, "rate", "neutral"),
      comparisonMetric("third_rate", "三位率", fromSnapshot.third_rate, toSnapshot.third_rate, "rate", "down"),
      comparisonMetric("fourth_rate", "四位率", fromSnapshot.fourth_rate, toSnapshot.fourth_rate, "rate", "down"),
      comparisonMetric("win_rate", "和了率", fromSnapshot.win_rate, toSnapshot.win_rate, "rate", "up"),
      comparisonMetric("deal_in_rate", "放銃率", fromSnapshot.deal_in_rate, toSnapshot.deal_in_rate, "rate", "down"),
      comparisonMetric("call_rate", "副露率", fromSnapshot.call_rate, toSnapshot.call_rate, "rate", "neutral"),
      comparisonMetric("riichi_rate", "立直率", fromSnapshot.riichi_rate, toSnapshot.riichi_rate, "rate", "neutral"),
      comparisonMetric(
        "attack_defense_gap",
        "攻守差",
        round2(fromSnapshot.win_rate - fromSnapshot.deal_in_rate),
        round2(toSnapshot.win_rate - toSnapshot.deal_in_rate),
        "number",
        "up"
      ),
      comparisonMetric("rank_points", "段位ポイント", fromSnapshot.rank_points, toSnapshot.rank_points, "rank_point", "up")
    ]
  };
}

function averageSnapshotMetrics(snapshots: Snapshot[]): SnapshotComparisonMetric[] {
  return [
    comparisonMetric("avg_place", "平均順位", null, average(snapshots.map((snapshot) => snapshot.avg_place)), "place", "down"),
    comparisonMetric("first_rate", "一位率", null, average(snapshots.map((snapshot) => snapshot.first_rate)), "rate", "up"),
    comparisonMetric("fourth_rate", "四位率", null, average(snapshots.map((snapshot) => snapshot.fourth_rate)), "rate", "down"),
    comparisonMetric("win_rate", "和了率", null, average(snapshots.map((snapshot) => snapshot.win_rate)), "rate", "up"),
    comparisonMetric("deal_in_rate", "放銃率", null, average(snapshots.map((snapshot) => snapshot.deal_in_rate)), "rate", "down"),
    comparisonMetric(
      "attack_defense_gap",
      "攻守差",
      null,
      average(snapshots.map((snapshot) => snapshot.win_rate - snapshot.deal_in_rate)),
      "number",
      "up"
    ),
    comparisonMetric("rank_points", "段位ポイント", null, average(snapshots.map((snapshot) => snapshot.rank_points)), "rank_point", "up")
  ];
}

function buildSnapshotGroupComparison(
  id: string,
  label: string,
  fromLabel: string,
  toLabel: string,
  fromSnapshots: Snapshot[],
  toSnapshots: Snapshot[],
  expectedCount?: number
): PeriodComparison {
  const fromMetrics = averageSnapshotMetrics(fromSnapshots);
  const toMetrics = averageSnapshotMetrics(toSnapshots);

  return {
    id,
    label,
    from_label: fromLabel,
    to_label: toLabel,
    from_count: fromSnapshots.length,
    to_count: toSnapshots.length,
    metrics: toMetrics.map((toMetric, index) => ({
      ...toMetric,
      from_value: fromMetrics[index].to_value,
      delta:
        fromMetrics[index].to_value == null || toMetric.to_value == null
          ? null
          : round2(toMetric.to_value - fromMetrics[index].to_value)
    })),
    quality:
      fromSnapshots.length === 0 || toSnapshots.length === 0
        ? "insufficient_data"
        : expectedCount != null &&
            (fromSnapshots.length < expectedCount || toSnapshots.length < expectedCount)
          ? "limited_data"
          : "ok"
  };
}

function monthKey(snapshot: Pick<Snapshot, "observed_date">): string {
  return snapshot.observed_date.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
}

export function buildCustomPeriodComparison(
  snapshots: Snapshot[],
  options: {
    id?: string;
    label?: string;
    from_label?: string;
    to_label?: string;
    from_date_from?: string;
    from_date_to?: string;
    to_date_from?: string;
    to_date_to?: string;
    game_mode?: Snapshot["game_mode"] | "all";
  }
): PeriodComparison {
  const ordered = [...snapshots].sort(byObservedAsc);
  const scopedSnapshots =
    options.game_mode && options.game_mode !== "all"
      ? ordered.filter((snapshot) => snapshot.game_mode === options.game_mode)
      : ordered;

  const fromSnapshots = scopedSnapshots.filter((snapshot) =>
    snapshotWithinDateRange(
      snapshot,
      options.from_date_from,
      options.from_date_to
    )
  );
  const toSnapshots = scopedSnapshots.filter((snapshot) =>
    snapshotWithinDateRange(snapshot, options.to_date_from, options.to_date_to)
  );

  return buildSnapshotGroupComparison(
    options.id ?? "custom-period",
    options.label ?? "期間A vs 期間B",
    options.from_label ?? "期間A",
    options.to_label ?? "期間B",
    fromSnapshots,
    toSnapshots
  );
}

function snapshotWithinDateRange(
  snapshot: Pick<Snapshot, "observed_date">,
  dateFrom?: string,
  dateTo?: string
): boolean {
  if (dateFrom && snapshot.observed_date < dateFrom) return false;
  if (dateTo && snapshot.observed_date > dateTo) return false;
  return true;
}

export function buildRecentWindowComparison(
  snapshots: Snapshot[],
  windowSize = 10
): PeriodComparison {
  const ordered = [...snapshots].sort(byObservedAsc);
  const toSnapshots = ordered.slice(-windowSize);
  const fromSnapshots = ordered.slice(
    Math.max(0, ordered.length - windowSize * 2),
    Math.max(0, ordered.length - windowSize)
  );

  return buildSnapshotGroupComparison(
    `recent-${windowSize}`,
    `直近${windowSize}件 vs 前${windowSize}件`,
    `前${windowSize}件`,
    `直近${windowSize}件`,
    fromSnapshots,
    toSnapshots,
    windowSize
  );
}

export function buildCalendarMonthComparison(snapshots: Snapshot[]): PeriodComparison {
  const ordered = [...snapshots].sort(byObservedAsc);
  const keys = Array.from(new Set(ordered.map(monthKey))).sort();
  const latestKey = keys.at(-1);
  const previousKey = keys.at(-2);

  const toSnapshots = latestKey
    ? ordered.filter((snapshot) => monthKey(snapshot) === latestKey)
    : [];
  const fromSnapshots = previousKey
    ? ordered.filter((snapshot) => monthKey(snapshot) === previousKey)
    : [];

  return buildSnapshotGroupComparison(
    "month",
    "今月 vs 前月",
    previousKey ? monthLabel(previousKey) : "前月",
    latestKey ? monthLabel(latestKey) : "今月",
    fromSnapshots,
    toSnapshots
  );
}

export function buildPeriodComparisons(snapshots: Snapshot[]): PeriodComparison[] {
  return [
    buildRecentWindowComparison(snapshots, 10),
    buildCalendarMonthComparison(snapshots)
  ];
}

function regressionScore(
  metric: SnapshotComparisonMetric
): number {
  if (metric.delta == null) return 0;
  if (metric.better_direction === "neutral") return 0;
  const worsened =
    metric.better_direction === "up" ? metric.delta < 0 : metric.delta > 0;
  if (!worsened) return 0;
  const unitWeight =
    metric.unit === "place" ? 40 : metric.unit === "rank_point" ? 0.2 : 10;
  return Math.round(Math.abs(metric.delta) * unitWeight);
}

export function buildRecentRegressionFactors(
  snapshots: Snapshot[],
  windowSize = 10
): RegressionFactor[] {
  const comparison = buildRecentWindowComparison(snapshots, windowSize);
  if (comparison.quality === "insufficient_data") return [];

  return comparison.metrics
    .map((metric) => {
      const score = Math.min(100, regressionScore(metric));
      return {
        key: metric.key,
        label: metric.label,
        score,
        severity: severityForScore(score),
        previous_value: metric.from_value,
        current_value: metric.to_value,
        delta: metric.delta,
        unit: metric.unit,
        message:
          score > 0
            ? `${comparison.to_label}で${metric.label}が悪化しています。`
            : `${comparison.to_label}で${metric.label}の悪化は大きくありません。`
      };
    })
    .filter((factor) => factor.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function buildFocusRecommendations(snapshots: Snapshot[]): FocusRecommendation[] {
  const latest = [...snapshots].sort(byObservedAsc).at(-1);
  if (!latest) return [];

  const recommendations: FocusRecommendation[] = [];

  if (latest.riichi_rate >= 23 && latest.deal_in_rate >= 12.5) {
    recommendations.push({
      id: "riichi-danger-spots",
      title: "立直する局面の危険度",
      priority: "high",
      reason: `立直率${latest.riichi_rate.toFixed(2)}%、放銃率${latest.deal_in_rate.toFixed(2)}%です。`,
      check_items: ["先制ではない立直", "終盤立直", "ドラ周辺の押し"]
    });
  }

  if (latest.win_rate < 20 && latest.call_rate < 30) {
    recommendations.push({
      id: "speed-shortage",
      title: "速度不足の原因",
      priority: "high",
      reason: `和了率${latest.win_rate.toFixed(2)}%、副露率${latest.call_rate.toFixed(2)}%です。`,
      check_items: ["鳴き判断", "孤立牌選択", "役牌・タンヤオ移行"]
    });
  }

  if (latest.call_rate >= 35 && latest.deal_in_rate >= 12) {
    recommendations.push({
      id: "call-defense",
      title: "仕掛け後の守備移行",
      priority: "medium",
      reason: `副露率${latest.call_rate.toFixed(2)}%、放銃率${latest.deal_in_rate.toFixed(2)}%です。`,
      check_items: ["安手副露", "遠い仕掛け", "押し返し基準"]
    });
  }

  if (latest.fourth_rate >= 24) {
    recommendations.push({
      id: "avoid-last-endgame",
      title: "ラス回避局面",
      priority: "medium",
      reason: `四位率${latest.fourth_rate.toFixed(2)}%です。`,
      check_items: ["南場の着順判断", "オーラス条件", "親番の失点管理"]
    });
  }

  if (latest.win_rate - latest.deal_in_rate < 8) {
    recommendations.push({
      id: "attack-defense-gap",
      title: "攻守差の内訳",
      priority: "medium",
      reason: `攻守差は${round2(latest.win_rate - latest.deal_in_rate).toFixed(2)}ptです。`,
      check_items: ["和了率低下", "放銃率上昇", "副露・立直後の失点"]
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "maintain-balance",
      title: "現状維持の確認",
      priority: "low",
      reason: "主要指標に大きな警戒条件はありません。",
      check_items: ["直近期の変化", "段位ポイント推移", "メモのタグ別傾向"]
    });
  }

  return recommendations.slice(0, 4);
}

export function buildDuplicateSnapshotCandidates(
  input: SnapshotCreateInput,
  snapshots: Snapshot[],
  options: { excludeId?: number } = {}
): DuplicateSnapshotCandidate[] {
  const candidates: DuplicateSnapshotCandidate[] = [];
  const currentKey = inputObservedKey(input);
  const seen = new Set<string>();

  const addCandidate = (
    snapshot: Snapshot,
    reason: DuplicateSnapshotCandidate["reason"],
    message: string
  ) => {
    const key = `${snapshot.id}:${reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      snapshot_id: snapshot.id,
      observed_at_utc: snapshot.observed_at_utc,
      observed_date: snapshot.observed_date,
      observed_time: snapshot.observed_time,
      game_mode: snapshot.game_mode,
      matches: snapshot.matches,
      reason,
      message
    });
  };

  for (const snapshot of snapshots) {
    if (snapshot.id === options.excludeId) continue;

    if (
      input.source_image_sha256 != null &&
      input.source_image_sha256 !== "" &&
      snapshot.source_image_sha256 === input.source_image_sha256
    ) {
      addCandidate(snapshot, "same_image_hash", "画像ハッシュが一致しています。");
    }

    if (
      snapshot.game_mode === input.game_mode &&
      snapshotObservedKey(snapshot) === currentKey
    ) {
      addCandidate(snapshot, "same_observed_at", "同じモードと観測日時の記録があります。");
    }

    if (
      snapshot.game_mode === input.game_mode &&
      snapshot.observed_date === input.observed_date &&
      snapshot.matches === input.matches
    ) {
      addCandidate(snapshot, "same_date_and_matches", "同じ日付・モード・対戦数の記録があります。");
    }
  }

  return candidates.sort((a, b) => b.observed_at_utc.localeCompare(a.observed_at_utc));
}

export function buildDataQualityWarnings(
  input: SnapshotCreateInput,
  snapshots: Snapshot[],
  options: { excludeId?: number } = {}
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const currentKey = inputObservedKey(input);
  const sameModeSnapshots = snapshots
    .filter((snapshot) => snapshot.id !== options.excludeId)
    .filter((snapshot) => snapshot.game_mode === input.game_mode)
    .sort(byObservedAsc);
  const previous = [...sameModeSnapshots]
    .reverse()
    .find((snapshot) => snapshotObservedKey(snapshot) < currentKey);

  if (input.rank_points != null && input.rank_points_max != null && input.rank_points > input.rank_points_max) {
    warnings.push({
      code: "RANK_POINTS_EXCEED_CAP",
      message: "段位ポイントがポイント上限を超えています。",
      severity: "warning"
    });
  }

  if (!previous) return warnings;

  const matchesDelta = input.matches - previous.matches;
  if (matchesDelta < 0) {
    warnings.push({
      code: "MATCHES_DECREASED",
      message: "同じモードの前回記録より対戦数が減っています。",
      severity: "warning"
    });
    return warnings;
  }

  if (matchesDelta === 0) return warnings;

  const rankDeltas = [
    estimatedCount(input.matches, input.first_rate)! - estimatedCount(previous.matches, previous.first_rate)!,
    estimatedCount(input.matches, input.second_rate)! - estimatedCount(previous.matches, previous.second_rate)!,
    estimatedCount(input.matches, input.third_rate)! - estimatedCount(previous.matches, previous.third_rate)!,
    estimatedCount(input.matches, input.fourth_rate)! - estimatedCount(previous.matches, previous.fourth_rate)!
  ];
  const rateDeltas = [
    ...rankDeltas,
    estimatedCount(input.matches, input.win_rate)! - estimatedCount(previous.matches, previous.win_rate)!,
    estimatedCount(input.matches, input.deal_in_rate)! - estimatedCount(previous.matches, previous.deal_in_rate)!,
    estimatedCount(input.matches, input.call_rate)! - estimatedCount(previous.matches, previous.call_rate)!,
    estimatedCount(input.matches, input.riichi_rate)! - estimatedCount(previous.matches, previous.riichi_rate)!
  ];

  if (rateDeltas.some((delta) => delta < 0)) {
    warnings.push({
      code: "RATE_DELTA_NEGATIVE",
      message: "累積率から推定した期間内回数にマイナス値があります。前回記録または今回の入力を確認してください。",
      severity: "warning"
    });
  }

  const rankDeltaTotal = rankDeltas.reduce((sum, delta) => sum + delta, 0);
  if (Math.abs(rankDeltaTotal - matchesDelta) > Math.max(2, matchesDelta * 0.08)) {
    warnings.push({
      code: "PERIOD_DELTA_INCONSISTENT",
      message: "順位率から推定した期間対戦数が、対戦数差分と大きくずれています。",
      severity: "warning"
    });
  }

  return warnings;
}

function duplicateIssueMaps(snapshots: Snapshot[]): {
  observedKeys: Map<string, Snapshot[]>;
  imageHashes: Map<string, Snapshot[]>;
} {
  const observedKeys = new Map<string, Snapshot[]>();
  const imageHashes = new Map<string, Snapshot[]>();

  for (const snapshot of snapshots) {
    const observedKey = `${snapshot.game_mode}:${snapshot.observed_at_utc}`;
    observedKeys.set(observedKey, [...(observedKeys.get(observedKey) ?? []), snapshot]);

    if (snapshot.source_image_sha256) {
      imageHashes.set(
        snapshot.source_image_sha256,
        [...(imageHashes.get(snapshot.source_image_sha256) ?? []), snapshot]
      );
    }
  }

  return { observedKeys, imageHashes };
}

export function buildDataQualityReport(snapshots: Snapshot[]): DataQualityIssue[] {
  const ordered = [...snapshots].sort(byObservedAsc);
  const duplicates = duplicateIssueMaps(ordered);
  const issues: DataQualityIssue[] = [];

  for (const snapshot of ordered) {
    const warnings = [
      ...buildConsistencyWarnings(snapshot),
      ...buildDataQualityWarnings(snapshot, ordered, { excludeId: snapshot.id })
    ];
    const observedKey = `${snapshot.game_mode}:${snapshot.observed_at_utc}`;

    if ((duplicates.observedKeys.get(observedKey)?.length ?? 0) > 1) {
      warnings.push({
        code: "DUPLICATE_OBSERVED_AT",
        message: "同じモードと観測日時の記録が複数あります。",
        severity: "warning"
      });
    }

    if (
      snapshot.source_image_sha256 &&
      (duplicates.imageHashes.get(snapshot.source_image_sha256)?.length ?? 0) > 1
    ) {
      warnings.push({
        code: "DUPLICATE_IMAGE_HASH",
        message: "同じ画像ハッシュの記録が複数あります。",
        severity: "warning"
      });
    }

    const uniqueWarnings = new Map(
      warnings.map((warning) => [`${warning.code}:${warning.message}`, warning])
    );

    for (const warning of uniqueWarnings.values()) {
      issues.push({
        snapshot_id: snapshot.id,
        observed_at_utc: snapshot.observed_at_utc,
        game_mode: snapshot.game_mode,
        code: warning.code,
        message: warning.message,
        severity: warning.severity
      });
    }
  }

  return issues.sort((a, b) => b.observed_at_utc.localeCompare(a.observed_at_utc));
}
