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

  it("extracts Mahjong Soul profile detail screenshots", () => {
    const fields = parseMahjongStatsOcr(`
      585/800
      東風戦
      一位率 19.09% 対戦数 241 和了率 19.80%
      二位率 26.97% 平均和了 6536 ツモ率 29.34%
      三位率 30.29% 平均順位 2.59 放銃率 17.66%
      四位率 23.65% 最大連荘 4 副露率 27.83%
      飛び率 2.90% 和了巡数 12.66 立直率 26.07%
    `);

    expect(fields.game_mode).toBe("east");
    expect(fields.rank_points).toBe(585);
    expect(fields.rank_points_max).toBe(800);
    expect(fields.matches).toBe(241);
    expect(fields.avg_win_score).toBe(6536);
    expect(fields.avg_place).toBe(2.59);
    expect(fields.max_renchan).toBe(4);
    expect(fields.avg_win_turn).toBe(12.66);
    expect(fields.first_rate).toBe(19.09);
    expect(fields.second_rate).toBe(26.97);
    expect(fields.third_rate).toBe(30.29);
    expect(fields.fourth_rate).toBe(23.65);
    expect(fields.bust_rate).toBe(2.9);
    expect(fields.win_rate).toBe(19.8);
    expect(fields.tsumo_rate).toBe(29.34);
    expect(fields.deal_in_rate).toBe(17.66);
    expect(fields.call_rate).toBe(27.83);
    expect(fields.riichi_rate).toBe(26.07);
  });
});
