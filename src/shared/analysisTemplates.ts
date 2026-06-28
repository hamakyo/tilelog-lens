import type { Snapshot } from "./types";

export type AnalysisTemplateReport = {
  id: string;
  title: string;
  status: "good" | "watch" | "risk" | "insufficient_data";
  summary: string;
  focus: string[];
};

export function buildAnalysisTemplateReports(snapshots: Snapshot[]): AnalysisTemplateReport[] {
  const latest = [...snapshots].sort((a, b) =>
    b.observed_at_utc.localeCompare(a.observed_at_utc)
  )[0];

  if (!latest) {
    return [
      {
        id: "no-data",
        title: "分析テンプレート",
        status: "insufficient_data",
        summary: "テンプレート分析には記録が必要です。",
        focus: ["新規記録を追加"]
      }
    ];
  }

  return [
    buildAvoidFourthReport(latest),
    buildAttackDefenseReport(latest),
    buildRiichiReport(latest),
    buildRankPointReport(latest)
  ];
}

function buildAvoidFourthReport(snapshot: Snapshot): AnalysisTemplateReport {
  const status =
    snapshot.fourth_rate <= 20 ? "good" : snapshot.fourth_rate <= 25 ? "watch" : "risk";
  return {
    id: "avoid-fourth",
    title: "ラス回避",
    status,
    summary:
      status === "good"
        ? "四位率は抑えられています。現状の守備判断を維持できます。"
        : status === "watch"
          ? "四位率がやや高めです。親番・終盤の放銃を重点確認してください。"
          : "四位率が高い状態です。放銃率と押し引き基準を優先的に見直してください。",
    focus: ["四位率", "放銃率", "終盤の押し引き"]
  };
}

function buildAttackDefenseReport(snapshot: Snapshot): AnalysisTemplateReport {
  const gap = snapshot.win_rate - snapshot.deal_in_rate;
  const status = gap >= 12 ? "good" : gap >= 8 ? "watch" : "risk";
  return {
    id: "attack-defense",
    title: "攻守バランス",
    status,
    summary:
      status === "good"
        ? "和了率と放銃率の差は良好です。攻撃効率を保てています。"
        : status === "watch"
          ? "攻守差がやや小さめです。副露・立直後の放銃を確認してください。"
          : "攻守差が小さい状態です。無理な押しと和了率低下のどちらが原因か切り分けてください。",
    focus: ["和了率", "放銃率", "攻守差"]
  };
}

function buildRiichiReport(snapshot: Snapshot): AnalysisTemplateReport {
  const lateWinTurn = snapshot.avg_win_turn != null && snapshot.avg_win_turn >= 12.5;
  const lowWinScore = snapshot.avg_win_score != null && snapshot.avg_win_score < 6500;
  const lowWinRate = snapshot.win_rate < 20;
  const highDealInRate = snapshot.deal_in_rate >= 13;
  const highRiichiRate = snapshot.riichi_rate >= 24;
  const lowRiichiRate = snapshot.riichi_rate < 16;
  const riskSignals = [
    highRiichiRate && lowWinRate,
    highRiichiRate && highDealInRate,
    lateWinTurn && lowWinRate,
    lowWinScore && lowWinRate
  ].filter(Boolean).length;
  const watchSignals = [
    lowRiichiRate && snapshot.win_rate < 22,
    lateWinTurn,
    lowWinScore,
    highDealInRate
  ].filter(Boolean).length;
  const status =
    riskSignals >= 2 ? "risk" : riskSignals >= 1 || watchSignals >= 2 ? "watch" : "good";

  return {
    id: "riichi",
    title: "立直分析",
    status,
    summary:
      status === "good"
        ? "立直率、和了率、放銃率のバランスは大きく崩れていません。立直判断は現状維持で確認できます。"
        : status === "watch"
          ? "立直まわりに確認余地があります。立直率だけでなく、和了率・放銃率・和了巡目を合わせて見てください。"
          : "立直判断が失点または和了率低下につながっている可能性があります。高リスク局面の立直と待ちの質を重点確認してください。",
    focus: ["立直率", "和了率", "放銃率", "平均和了巡", "平均和了点"]
  };
}

function buildRankPointReport(snapshot: Snapshot): AnalysisTemplateReport {
  if (snapshot.rank_points == null || snapshot.rank_points_max == null) {
    return {
      id: "rank-points",
      title: "段位pt効率",
      status: "insufficient_data",
      summary: "段位ポイントと上限を入力すると、pt効率の確認に使えます。",
      focus: ["段位ポイント", "ポイント上限"]
    };
  }

  const progress = (snapshot.rank_points / snapshot.rank_points_max) * 100;
  const status = progress >= 70 ? "good" : progress >= 35 ? "watch" : "risk";
  return {
    id: "rank-points",
    title: "段位pt効率",
    status,
    summary:
      status === "good"
        ? "昇格圏に近い状態です。大きなラスを避ける運用を優先できます。"
        : status === "watch"
          ? "中間帯です。攻守差と四位率の両方を見ながらpt効率を確認してください。"
          : "ポイント余裕が小さい状態です。ラス回避と放銃率の改善を優先してください。",
    focus: ["段位ポイント", "四位率", "放銃率"]
  };
}
