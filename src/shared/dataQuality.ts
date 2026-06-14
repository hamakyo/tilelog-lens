import type { DataQualityIssue, ValidationWarning } from "./types";

export type DataQualityCodeSummary = {
  code: ValidationWarning["code"];
  label: string;
  count: number;
  action: string;
};

const dataQualityCodeLabels: Record<ValidationWarning["code"], { label: string; action: string }> = {
  RANK_RATE_SUM_NOT_100: {
    label: "順位率合計",
    action: "一位率から四位率の合計が100%付近か確認してください。"
  },
  AVG_PLACE_MISMATCH: {
    label: "平均順位",
    action: "順位率から計算した平均順位と入力値のズレを確認してください。"
  },
  RANK_POINTS_EXCEED_CAP: {
    label: "段位pt上限",
    action: "段位ポイントと上限値の入力を確認してください。"
  },
  RATE_DELTA_NEGATIVE: {
    label: "推定回数減少",
    action: "累積率または対戦数の入力ミスがないか確認してください。"
  },
  PERIOD_DELTA_INCONSISTENT: {
    label: "期間差分不整合",
    action: "前後のスナップショット順序と累積値を確認してください。"
  },
  MATCHES_DECREASED: {
    label: "対戦数減少",
    action: "同じゲームモード内で時系列順に対戦数が増えているか確認してください。"
  },
  DUPLICATE_IMAGE_HASH: {
    label: "画像重複",
    action: "同じスクリーンショット由来の重複記録ではないか確認してください。"
  },
  DUPLICATE_OBSERVED_AT: {
    label: "日時重複",
    action: "同じ観測日時の記録を二重登録していないか確認してください。"
  }
};

export function summarizeDataQualityIssues(
  issues: DataQualityIssue[]
): DataQualityCodeSummary[] {
  const counts = new Map<ValidationWarning["code"], number>();
  for (const issue of issues) {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      count,
      label: dataQualityCodeLabels[code].label,
      action: dataQualityCodeLabels[code].action
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}
