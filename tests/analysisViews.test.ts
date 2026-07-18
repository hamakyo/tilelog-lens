import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAnalysisView,
  loadAnalysisViews,
  upsertAnalysisView,
  type AnalysisViewDraft
} from "../src/web/lib/analysisViews";

const values = new Map<string, string>();

const draft: AnalysisViewDraft = {
  name: "ラス回避",
  game_mode: "east",
  filters: {
    observedDateFrom: "2026-01-01",
    observedDateTo: "2026-01-31",
    minMatches: "",
    maxMatches: "",
    minWinRate: "",
    maxDealInRate: "12",
    maxAvgPlace: ""
  },
  tab: "improvement",
  chart_metrics: ["avg_place", "deal_in_rate"]
};

beforeEach(() => {
  values.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }
  });
});

describe("analysis views", () => {
  it("saves and restores a view", () => {
    const saved = upsertAnalysisView([], draft);
    expect(saved.item.name).toBe("ラス回避");
    expect(loadAnalysisViews()).toEqual(saved.items);
  });

  it("updates and deletes an existing view", () => {
    const first = upsertAnalysisView([], draft);
    const updated = upsertAnalysisView(
      first.items,
      { ...draft, name: "更新後", tab: "detail" },
      first.item.id
    );
    expect(updated.items).toHaveLength(1);
    expect(updated.item.name).toBe("更新後");
    expect(deleteAnalysisView(updated.items, updated.item.id)).toEqual([]);
  });

  it("ignores malformed stored values", () => {
    window.localStorage.setItem(
      "tilelog-lens:analysis-views",
      JSON.stringify([{ id: "bad", name: "bad" }])
    );
    expect(loadAnalysisViews()).toEqual([]);
  });
});
