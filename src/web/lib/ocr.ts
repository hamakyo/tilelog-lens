import type { SnapshotCreateInput } from "../../shared/types";

export type OcrExtractedFields = Partial<
  Pick<
    SnapshotCreateInput,
    | "matches"
    | "avg_place"
    | "avg_win_score"
    | "max_renchan"
    | "avg_win_turn"
    | "first_rate"
    | "second_rate"
    | "third_rate"
    | "fourth_rate"
    | "bust_rate"
    | "win_rate"
    | "tsumo_rate"
    | "deal_in_rate"
    | "call_rate"
    | "riichi_rate"
    | "rank_points"
    | "rank_points_max"
  >
>;

type OcrProgress = {
  status: string;
  progress: number;
};

type FieldPattern = {
  field: keyof OcrExtractedFields;
  labels: string[];
  integer?: boolean;
};

const fieldPatterns: FieldPattern[] = [
  { field: "matches", labels: ["対戦数", "試合数", "matches", "games"], integer: true },
  { field: "avg_place", labels: ["平均順位", "average place", "avg place"] },
  { field: "avg_win_score", labels: ["平均和了点", "平均和了", "avg win score"], integer: true },
  { field: "max_renchan", labels: ["最大連荘", "最大連莊", "max renchan"], integer: true },
  { field: "avg_win_turn", labels: ["平均和了巡目", "平均和了巡", "avg win turn"] },
  { field: "first_rate", labels: ["1位率", "一位率", "1st", "first"] },
  { field: "second_rate", labels: ["2位率", "二位率", "2nd", "second"] },
  { field: "third_rate", labels: ["3位率", "三位率", "3rd", "third"] },
  { field: "fourth_rate", labels: ["4位率", "四位率", "4th", "fourth"] },
  { field: "bust_rate", labels: ["飛び率", "飛率", "bust"] },
  { field: "win_rate", labels: ["和了率", "あがり率", "win rate", "win"] },
  { field: "tsumo_rate", labels: ["自摸率", "ツモ率", "tsumo"] },
  { field: "deal_in_rate", labels: ["放銃率", "放铳率", "deal-in", "deal in"] },
  { field: "call_rate", labels: ["副露率", "鳴き率", "call rate", "call"] },
  { field: "riichi_rate", labels: ["立直率", "リーチ率", "riichi"] }
];

function normalizeFullWidth(input: string): string {
  return input
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[Ａ-Ｚａ-ｚ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[％]/g, "%")
    .replace(/[．。]/g, ".")
    .replace(/[，、]/g, ",")
    .replace(/[：]/g, ":");
}

function normalizeOcrText(input: string): string {
  return normalizeFullWidth(input)
    .replace(/\r/g, "\n")
    .replace(/[|｜]/g, " ")
    .replace(/[　\t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function normalizeNumber(input: string): string {
  const text = input.trim();
  if (text.includes(".") && text.includes(",")) return text.replace(/,/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(text)) return text.replace(/,/g, "");
  return text.replace(",", ".");
}

function parseNumber(raw: string, integer = false): number | undefined {
  const normalized = normalizeNumber(raw);
  const value = Number(normalized);
  if (!Number.isFinite(value)) return undefined;
  return integer ? Math.round(value) : Math.round(value * 100) / 100;
}

function numbersFromText(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

function findValueAfterLabel(line: string, labels: string[], integer = false): number | undefined {
  const lowerLine = line.toLowerCase();
  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    const index = lowerLine.indexOf(lowerLabel);
    if (index === -1) continue;

    const afterLabel = line.slice(index + label.length);
    const candidates = numbersFromText(afterLabel);
    if (candidates.length === 0) continue;

    return parseNumber(candidates[0], integer);
  }

  return undefined;
}

function clampRate(value: number | undefined): number | undefined {
  if (value == null) return undefined;
  if (value < 0 || value > 100) return undefined;
  return value;
}

function extractRankPoints(line: string): Pick<OcrExtractedFields, "rank_points" | "rank_points_max"> {
  const normalized = line.toLowerCase();
  if (!/(pt|point|ポイント|段位点|rank)/.test(normalized)) return {};

  const slashMatch = normalized.match(/(\d{1,6})\s*\/\s*(\d{1,6})/);
  if (slashMatch) {
    return {
      rank_points: Number(slashMatch[1]),
      rank_points_max: Number(slashMatch[2])
    };
  }

  const numbers = numbersFromText(normalized).map((value) => Number(normalizeNumber(value)));
  const point = numbers.find((value) => Number.isInteger(value) && value >= 0);
  return point == null ? {} : { rank_points: point };
}

export function parseMahjongStatsOcr(text: string): OcrExtractedFields {
  const normalized = normalizeOcrText(text);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fields: OcrExtractedFields = {};

  for (const line of lines) {
    Object.assign(fields, extractRankPoints(line));

    for (const pattern of fieldPatterns) {
      if (fields[pattern.field] != null) continue;
      const value = findValueAfterLabel(line, pattern.labels, pattern.integer);
      if (value == null) continue;
      fields[pattern.field] = pattern.integer ? value : clampRate(value);
    }
  }

  return fields;
}

export function countExtractedFields(fields: OcrExtractedFields): number {
  return Object.values(fields).filter((value) => value != null).length;
}

export async function recognizeSnapshotText(
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  const tesseract = await import("tesseract.js");
  const result = await tesseract.recognize(file, "jpn+eng", {
    logger: (message) => {
      if (
        typeof message.status === "string" &&
        typeof message.progress === "number"
      ) {
        onProgress?.({
          status: message.status,
          progress: Math.round(message.progress * 100)
        });
      }
    }
  });

  return result.data.text;
}
