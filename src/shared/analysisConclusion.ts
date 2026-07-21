import type {
  AnalysisAssessment,
  FocusRecommendation,
  ImprovementPriority,
  RegressionFactor
} from "./types";

export type AnalysisConclusion = {
  status: "good" | "watch" | "risk" | "insufficient_data";
  title: string;
  summary: string;
  evidence: string[];
  target_tab: "improvement" | "detail";
};

export type AnalysisConclusionInput = {
  snapshot_count: number;
  latest_matches_delta: number | null;
  improvement_priorities: ImprovementPriority[];
  regression_factors: RegressionFactor[];
  focus_recommendations: FocusRecommendation[];
  assessment?: AnalysisAssessment | null;
};

function fixed(value: number | null): string {
  return value == null ? "-" : Number(value.toFixed(2)).toString();
}

export function buildAnalysisConclusion(
  input: AnalysisConclusionInput
): AnalysisConclusion {
  if (input.snapshot_count === 0) {
    return {
      status: "insufficient_data",
      title: "分析対象の記録がありません",
      summary: "条件を変更するか、新しい記録を追加してください。",
      evidence: [],
      target_tab: "detail"
    };
  }

  if (input.snapshot_count < 2) {
    return {
      status: "insufficient_data",
      title: "比較用の記録がもう1件必要です",
      summary: "同じゲームモードの記録が2件以上になると、変化と改善要因を判定できます。",
      evidence: [`現在の分析対象は${input.snapshot_count}件です。`],
      target_tab: "detail"
    };
  }

  if (input.assessment) {
    const assessment = input.assessment;
    const recent = assessment.recent_style;
    const longTerm = assessment.long_term_style;
    const recentPeriod = assessment.recent_period;

    if (!recent || assessment.current_alert === "insufficient_data") {
      return {
        status: "insufficient_data",
        title: "適切な基準記録がありません",
        summary: "直近状態を判定できる間隔の記録を追加してください。",
        evidence: [`${input.snapshot_count}件の記録を対象にしています。`],
        target_tab: "detail"
      };
    }

    if (assessment.current_alert === "risk") {
      const priority = input.improvement_priorities.find(
        (item) => item.category === "current_alert"
      );
      return {
        status: "risk",
        title: priority?.title ?? "長期・直近ともに警戒が必要です",
        summary: priority?.action ?? recent.summary,
        evidence: [
          `長期スタイル: ${longTerm?.label ?? "未判定"}`,
          `${recentPeriod?.label ?? "直近"}: ${recent.label}`,
          `判定基準: ${assessment.profile.status === "provisional" ? "暫定" : "確定"}`
        ],
        target_tab: "improvement"
      };
    }

    if (recent.status === "good") {
      return {
        status: "good",
        title:
          assessment.trend_status === "improving"
            ? "直近は改善しています"
            : "直近の攻守は良好です",
        summary: recent.summary,
        evidence: [
          `長期スタイル: ${longTerm?.label ?? "未判定"}`,
          `${recentPeriod?.label ?? "直近"}: ${recent.label}`,
          `${recentPeriod?.actual_matches ?? 0}戦を${recentPeriod?.confidence ?? "low"} confidenceで評価しました。`
        ],
        target_tab: "detail"
      };
    }

    const priority = input.improvement_priorities.find(
      (item) => item.category === "current_alert"
    );
    return {
      status: "watch",
      title: priority?.title ?? "直近の状態を確認してください",
      summary: priority?.action ?? recent.summary,
      evidence: [
        `長期スタイル: ${longTerm?.label ?? "未判定"}`,
        `${recentPeriod?.label ?? "直近"}: ${recent.label}`
      ],
      target_tab: "improvement"
    };
  }

  const priority = input.improvement_priorities.find(
    (item) => item.severity !== "low"
  );
  if (priority) {
    return {
      status: priority.severity === "high" ? "risk" : "watch",
      title: priority.title,
      summary: priority.action,
      evidence: [
        priority.reason,
        `現在 ${fixed(priority.current_value)} / 目安 ${fixed(priority.target_value)}`,
        input.latest_matches_delta == null
          ? `${input.snapshot_count}件の記録を対象にしています。`
          : `最新区間は${input.latest_matches_delta}戦です。`
      ],
      target_tab: "improvement"
    };
  }

  const regression = input.regression_factors[0];
  if (regression) {
    return {
      status: regression.severity === "high" ? "risk" : "watch",
      title: `${regression.label}の悪化を確認`,
      summary: regression.message,
      evidence: [
        `前回 ${fixed(regression.previous_value)} / 直近 ${fixed(regression.current_value)}`,
        `悪化スコア ${regression.score}`
      ],
      target_tab: "improvement"
    };
  }

  const recommendation = input.focus_recommendations[0];
  if (recommendation) {
    return {
      status: recommendation.priority === "high" ? "risk" : "watch",
      title: recommendation.title,
      summary: recommendation.reason,
      evidence: recommendation.check_items.slice(0, 3),
      target_tab: "improvement"
    };
  }

  return {
    status: "good",
    title: "大きな悪化は検出されていません",
    summary: "現在の条件では、優先度の高い警戒項目はありません。",
    evidence: [
      `${input.snapshot_count}件の記録を対象に確認しました。`,
      input.latest_matches_delta == null
        ? "最新区間の対戦数は未推定です。"
        : `最新区間は${input.latest_matches_delta}戦です。`
    ],
    target_tab: "detail"
  };
}
