export type DashboardCardId =
  | "avg_place"
  | "rank_points"
  | "matches_delta"
  | "win_deal_rate"
  | "fourth_rate"
  | "riichi_rate";

export type DashboardCardPresetId =
  | "balanced"
  | "rank_point_focus"
  | "avoid_fourth_focus"
  | "riichi_focus";

export type DashboardCardDefinition = {
  id: DashboardCardId;
  label: string;
  description: string;
};

export type DashboardCardPreference = {
  id: DashboardCardId;
  enabled: boolean;
};

const storageKey = "tilelog-lens:dashboard-cards";

export const dashboardCardDefinitions: DashboardCardDefinition[] = [
  {
    id: "avg_place",
    label: "平均順位",
    description: "最新の平均順位を表示します。"
  },
  {
    id: "rank_points",
    label: "段位 / 昇格まで",
    description: "段位と昇格までのポイントを表示します。"
  },
  {
    id: "matches_delta",
    label: "対戦数差分",
    description: "前回記録から増えた対戦数を表示します。"
  },
  {
    id: "win_deal_rate",
    label: "和了率 / 放銃率",
    description: "攻守バランスを見るための主要率を表示します。"
  },
  {
    id: "fourth_rate",
    label: "ラス率",
    description: "ラス回避重視の確認に使います。"
  },
  {
    id: "riichi_rate",
    label: "立直率",
    description: "立直判断の傾向確認に使います。"
  }
];

export const dashboardCardPresetLabels: Record<DashboardCardPresetId, string> = {
  balanced: "標準",
  rank_point_focus: "段位pt重視",
  avoid_fourth_focus: "ラス回避重視",
  riichi_focus: "立直重視"
};

export const dashboardCardPresets: Record<DashboardCardPresetId, DashboardCardId[]> = {
  balanced: ["avg_place", "win_deal_rate", "matches_delta", "rank_points"],
  rank_point_focus: ["rank_points", "matches_delta", "avg_place", "win_deal_rate"],
  avoid_fourth_focus: ["fourth_rate", "avg_place", "win_deal_rate", "matches_delta"],
  riichi_focus: ["riichi_rate", "win_deal_rate", "avg_place", "matches_delta"]
};

export function defaultDashboardCardPreferences(): DashboardCardPreference[] {
  return buildPreferencesFromIds(dashboardCardPresets.balanced);
}

export function buildPreferencesFromIds(ids: DashboardCardId[]): DashboardCardPreference[] {
  const enabled = new Set(ids);
  const ordered = [
    ...ids,
    ...dashboardCardDefinitions
      .map((definition) => definition.id)
      .filter((id) => !enabled.has(id))
  ];

  return ordered.map((id) => ({ id, enabled: enabled.has(id) }));
}

export function loadDashboardCardPreferences(): DashboardCardPreference[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null"
    ) as DashboardCardPreference[] | null;
    if (!Array.isArray(parsed)) return defaultDashboardCardPreferences();

    const validIds = new Set(dashboardCardDefinitions.map((definition) => definition.id));
    const seen = new Set<DashboardCardId>();
    const sanitized = parsed
      .filter((item): item is DashboardCardPreference => {
        if (!item || !validIds.has(item.id) || seen.has(item.id)) return false;
        seen.add(item.id);
        return typeof item.enabled === "boolean";
      })
      .map((item) => ({ id: item.id, enabled: item.enabled }));

    for (const definition of dashboardCardDefinitions) {
      if (!seen.has(definition.id)) {
        sanitized.push({ id: definition.id, enabled: false });
      }
    }

    return sanitized.length > 0 ? sanitized : defaultDashboardCardPreferences();
  } catch {
    return defaultDashboardCardPreferences();
  }
}

export function saveDashboardCardPreferences(
  preferences: DashboardCardPreference[]
): void {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

export function resetDashboardCardPreferences(): DashboardCardPreference[] {
  const preferences = defaultDashboardCardPreferences();
  saveDashboardCardPreferences(preferences);
  return preferences;
}
