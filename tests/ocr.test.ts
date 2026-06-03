import { describe, expect, it } from "vitest";
import {
  countExtractedFields,
  parseMahjongStatsOcr
} from "../src/web/lib/ocr";

describe("OCR parser", () => {
  it("extracts Japanese Mahjong statistics labels", () => {
    const fields = parseMahjongStatsOcr(`
      対戦数 123
      平均順位 2.43
      1位率 28.45%
      2位率 24.39%
      3位率 25.20%
      4位率 21.96%
      和了率 23.58%
      放銃率 11.38%
      副露率 34.21%
      立直率 18.70%
      ツモ率 31.4%
      飛び率 4.2%
      段位ポイント 1450/2000
    `);

    expect(fields.matches).toBe(123);
    expect(fields.avg_place).toBe(2.43);
    expect(fields.first_rate).toBe(28.45);
    expect(fields.second_rate).toBe(24.39);
    expect(fields.third_rate).toBe(25.2);
    expect(fields.fourth_rate).toBe(21.96);
    expect(fields.win_rate).toBe(23.58);
    expect(fields.deal_in_rate).toBe(11.38);
    expect(fields.call_rate).toBe(34.21);
    expect(fields.riichi_rate).toBe(18.7);
    expect(fields.tsumo_rate).toBe(31.4);
    expect(fields.bust_rate).toBe(4.2);
    expect(fields.rank_points).toBe(1450);
    expect(fields.rank_points_max).toBe(2000);
    expect(countExtractedFields(fields)).toBe(14);
  });

  it("normalizes full-width numbers and English labels", () => {
    const fields = parseMahjongStatsOcr(`
      Matches １００
      Avg Place ２．５０
      Win Rate ２５％
      Deal-in １２．５％
      Call Rate ３３％
      Riichi １８％
    `);

    expect(fields.matches).toBe(100);
    expect(fields.avg_place).toBe(2.5);
    expect(fields.win_rate).toBe(25);
    expect(fields.deal_in_rate).toBe(12.5);
    expect(fields.call_rate).toBe(33);
    expect(fields.riichi_rate).toBe(18);
  });
});
