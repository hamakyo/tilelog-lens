import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPreferencesFromIds,
  dashboardCardPresets,
  loadDashboardCardPreferences,
  saveDashboardCardPreferences
} from "../src/web/lib/dashboardCards";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value)
    }
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboard card preferences", () => {
  it("builds ordered preferences from a preset", () => {
    const preferences = buildPreferencesFromIds(dashboardCardPresets.rank_point_focus);

    expect(preferences.slice(0, 4)).toEqual([
      { id: "rank_points", enabled: true },
      { id: "matches_delta", enabled: true },
      { id: "avg_place", enabled: true },
      { id: "win_deal_rate", enabled: true }
    ]);
    expect(preferences.find((item) => item.id === "riichi_rate")?.enabled).toBe(false);
  });

  it("loads saved preferences and appends missing known cards disabled", () => {
    stubLocalStorage();
    saveDashboardCardPreferences([
      { id: "riichi_rate", enabled: true },
      { id: "avg_place", enabled: false }
    ]);

    const preferences = loadDashboardCardPreferences();

    expect(preferences[0]).toEqual({ id: "riichi_rate", enabled: true });
    expect(preferences[1]).toEqual({ id: "avg_place", enabled: false });
    expect(preferences.find((item) => item.id === "rank_points")?.enabled).toBe(false);
  });

  it("ignores unknown or duplicated stored cards", () => {
    stubLocalStorage({
      "tilelog-lens:dashboard-cards": JSON.stringify([
        { id: "unknown", enabled: true },
        { id: "fourth_rate", enabled: true },
        { id: "fourth_rate", enabled: false }
      ])
    });

    const preferences = loadDashboardCardPreferences();

    expect(preferences.filter((item) => item.id === "fourth_rate")).toEqual([
      { id: "fourth_rate", enabled: true }
    ]);
    expect(preferences.some((item) => String(item.id) === "unknown")).toBe(false);
  });
});
