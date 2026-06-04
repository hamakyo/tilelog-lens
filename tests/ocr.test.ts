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

  it("does not infer a game mode from numeric-only OCR text", () => {
    const fields = parseMahjongStatsOcr(`
      585/800
      一位率 19.09% 対戦数 241 和了率 19.80%
      二位率 26.97% 平均和了 6536 ツモ率 29.34%
      三位率 30.29% 平均順位 2.59 放銃率 17.66%
      四位率 23.65% 最大連荘 4 副露率 27.83%
      飛び率 2.90% 和了巡数 12.66 立直率 26.07%
    `);

    expect(fields.game_mode).toBeUndefined();
    expect(fields.rank_points).toBe(585);
    expect(fields.matches).toBe(241);
  });

  it("extracts shifted Mahjong Soul profile detail screenshots", () => {
    const samples = [
      {
        text: `
          438/800
          東風戦
          一位率 18.06% 対戦数 227 和了率 19.30%
          二位率 26.87% 平均和了 6623 ツモ率 30.38%
          三位率 31.28% 平均順位 2.61 放銃率 17.92%
          四位率 23.79% 最大連荘 4 副露率 26.55%
          飛び率 3.08% 和了巡数 12.62 立直率 26.30%
        `,
        expected: {
          rank_points: 438,
          first_rate: 18.06,
          matches: 227,
          avg_win_turn: 12.62,
          riichi_rate: 26.3
        }
      },
      {
        text: `
          491/800
          東風戦
          一位率 18.41% 対戦数 239 和了率 19.61%
          二位率 27.20% 平均和了 6555 ツモ率 29.53%
          三位率 30.54% 平均順位 2.60 放銃率 17.76%
          四位率 23.85% 最大連荘 4 副露率 27.57%
          飛び率 2.93% 和了巡数 12.69 立直率 26.18%
        `,
        expected: {
          rank_points: 491,
          first_rate: 18.41,
          matches: 239,
          avg_win_turn: 12.69,
          riichi_rate: 26.18
        }
      },
      {
        text: `
          441/800
          東風戦
          一位率 18.14% 対戦数 226 和了率 19.22%
          二位率 26.99% 平均和了 6634 ツモ率 30.21%
          三位率 30.97% 平均順位 2.61 放銃率 17.91%
          四位率 23.89% 最大連荘 4 副露率 26.41%
          飛び率 3.10% 和了巡数 12.60 立直率 26.33%
        `,
        expected: {
          rank_points: 441,
          first_rate: 18.14,
          matches: 226,
          avg_win_turn: 12.6,
          riichi_rate: 26.33
        }
      }
    ];

    for (const sample of samples) {
      const fields = parseMahjongStatsOcr(sample.text);
      expect(fields.game_mode).toBe("east");
      expect(fields.rank_points_max).toBe(800);
      expect(fields.rank_points).toBe(sample.expected.rank_points);
      expect(fields.first_rate).toBe(sample.expected.first_rate);
      expect(fields.matches).toBe(sample.expected.matches);
      expect(fields.avg_win_turn).toBe(sample.expected.avg_win_turn);
      expect(fields.riichi_rate).toBe(sample.expected.riichi_rate);
      expect(countExtractedFields(fields)).toBe(18);
    }
  });
});
