import { describe, expect, it } from "vitest";
import { buildTagAnalyses, extractNoteTags } from "../src/shared/tags";
import { makeSnapshot } from "./fixtures";

describe("tags", () => {
  it("extracts unique note tags", () => {
    expect(extractNoteTags("今日は #守備練習 と #push_test。#守備練習")).toEqual([
      "守備練習",
      "push_test"
    ]);
  });

  it("builds tag analyses from snapshot notes", () => {
    const analyses = buildTagAnalyses([
      makeSnapshot({
        id: 1,
        note: "#守備練習",
        avg_place: 2.4,
        win_rate: 24,
        deal_in_rate: 10,
        fourth_rate: 18
      }),
      makeSnapshot({
        id: 2,
        note: "#守備練習 #副露",
        avg_place: 2.6,
        win_rate: 22,
        deal_in_rate: 12,
        fourth_rate: 22
      })
    ]);

    expect(analyses[0]).toMatchObject({
      tag: "守備練習",
      snapshot_count: 2,
      avg_place: 2.5,
      win_rate: 23,
      deal_in_rate: 11,
      fourth_rate: 20
    });
  });
});
