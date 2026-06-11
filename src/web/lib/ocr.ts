import type { SnapshotCreateInput } from "../../shared/types";

export type OcrExtractedFields = Partial<
  Pick<
    SnapshotCreateInput,
    | "matches"
    | "game_mode"
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

export type OcrCalibration = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type NumericOcrField = Exclude<keyof OcrExtractedFields, "game_mode">;

type NumericCropDefinition = {
  field: NumericOcrField;
  x: number;
  y: number;
  width: number;
  height: number;
  integer?: boolean;
  rate?: boolean;
  column?: "left" | "middle" | "right";
  row?: number;
};

type FieldPattern = {
  field: NumericOcrField;
  labels: string[];
  integer?: boolean;
  min?: number;
  max?: number;
};

const fieldPatterns: FieldPattern[] = [
  { field: "matches", labels: ["対戦数", "試合数", "matches", "games"], integer: true },
  { field: "avg_place", labels: ["平均順位", "average place", "avg place"] },
  {
    field: "avg_win_score",
    labels: ["平均和了点", "平均和了得点", "平均和了", "avg win score"],
    integer: true,
    min: 100,
    max: 100000
  },
  { field: "max_renchan", labels: ["最大連荘", "最大連莊", "max renchan"], integer: true },
  { field: "avg_win_turn", labels: ["平均和了巡目", "平均和了巡数", "平均和了巡", "和了巡数", "avg win turn"], max: 30 },
  { field: "first_rate", labels: ["1位率", "一位率", "ー位率", "1st", "first"] },
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

const mahjongSoulBaseSize = {
  width: 2556,
  height: 1179
};

const mahjongSoulNumericCrops: NumericCropDefinition[] = [
  { field: "rank_points", x: 1810, y: 138, width: 185, height: 48 },
  { field: "first_rate", x: 1148, y: 724, width: 170, height: 58, rate: true, column: "left", row: 0 },
  { field: "second_rate", x: 1148, y: 780, width: 170, height: 58, rate: true, column: "left", row: 1 },
  { field: "third_rate", x: 1148, y: 837, width: 170, height: 58, rate: true, column: "left", row: 2 },
  { field: "fourth_rate", x: 1148, y: 895, width: 170, height: 58, rate: true, column: "left", row: 3 },
  { field: "bust_rate", x: 1148, y: 952, width: 170, height: 58, rate: true, column: "left", row: 4 },
  { field: "matches", x: 1625, y: 724, width: 115, height: 58, integer: true, column: "middle", row: 0 },
  { field: "avg_win_score", x: 1580, y: 780, width: 170, height: 58, integer: true, column: "middle", row: 1 },
  { field: "avg_place", x: 1600, y: 837, width: 150, height: 58, column: "middle", row: 2 },
  { field: "max_renchan", x: 1660, y: 895, width: 90, height: 58, integer: true, column: "middle", row: 3 },
  { field: "avg_win_turn", x: 1580, y: 952, width: 170, height: 58, column: "middle", row: 4 },
  { field: "win_rate", x: 1950, y: 724, width: 180, height: 58, rate: true, column: "right", row: 0 },
  { field: "tsumo_rate", x: 1950, y: 780, width: 180, height: 58, rate: true, column: "right", row: 1 },
  { field: "deal_in_rate", x: 1950, y: 837, width: 180, height: 58, rate: true, column: "right", row: 2 },
  { field: "call_rate", x: 1950, y: 895, width: 180, height: 58, rate: true, column: "right", row: 3 },
  { field: "riichi_rate", x: 1950, y: 952, width: 180, height: 58, rate: true, column: "right", row: 4 }
];

export const DEFAULT_OCR_CALIBRATION: OcrCalibration = {
  offsetX: 0,
  offsetY: 0,
  scale: 1
};

type MahjongSoulStatColumn = NonNullable<NumericCropDefinition["column"]>;

type MahjongSoulDetectedRows = Partial<Record<MahjongSoulStatColumn, number[]>>;

const mahjongSoulStatScanBands: Record<
  MahjongSoulStatColumn,
  { x1: number; x2: number }
> = {
  left: { x1: 1100, x2: 1325 },
  middle: { x1: 1550, x2: 1750 },
  right: { x1: 1900, x2: 2140 }
};

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
    .replace(/[％]/g, "%")
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

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelToLooseRegex(label: string): string {
  return normalizeFullWidth(label)
    .toLowerCase()
    .replace(/\s+/g, "")
    .split("")
    .map(escapeRegex)
    .join("[\\s:：・.．、,]*");
}

function findValueAfterLabel(line: string, labels: string[], integer = false): number | undefined {
  const normalizedLine = normalizeFullWidth(line).toLowerCase();
  for (const label of labels) {
    const pattern = new RegExp(
      `${labelToLooseRegex(label)}[^0-9]{0,16}(\\d{1,6}(?:[.,]\\d{1,2})?)`,
      "i"
    );
    const match = normalizedLine.match(pattern);
    if (!match) continue;

    return parseNumber(match[1], integer);
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

  const slashMatch = normalized.match(/(\d{1,6})\s*\/\s*(\d{1,6})/);
  if (slashMatch) {
    const point = Number(slashMatch[1]);
    const pointMax = Number(slashMatch[2]);
    if (
      pointMax >= 100 &&
      pointMax <= 10000 &&
      point >= 0 &&
      point <= pointMax
    ) {
      return {
        rank_points: point,
        rank_points_max: pointMax
      };
    }
  }

  if (!/(pt|point|ポイント|段位点|rank)/.test(normalized)) return {};

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

function extractGameMode(text: string): Pick<OcrExtractedFields, "game_mode"> {
  const compact = normalizeOcrText(text).replace(/\s+/g, "");
  if (/(東風戦|東風|tonpu|east)/i.test(compact)) return { game_mode: "east" };
  if (/(半荘戦|半荘|半莊|hanchan|south)/i.test(compact)) return { game_mode: "south" };
  if (/(三人戦|三麻|3人|three)/i.test(compact)) return { game_mode: "three_player" };
  return {};
}

function isAcceptedValue(pattern: FieldPattern, value: number): boolean {
  if (pattern.min != null && value < pattern.min) return false;
  if (pattern.max != null && value > pattern.max) return false;
  return true;
}

export function parseMahjongStatsOcr(text: string): OcrExtractedFields {
  const normalized = normalizeOcrText(text);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fields: OcrExtractedFields = extractGameMode(normalized);

  for (const line of lines) {
    Object.assign(fields, extractRankPoints(line));

    for (const pattern of fieldPatterns) {
      if (fields[pattern.field] != null) continue;
      const value = findValueAfterLabel(line, pattern.labels, pattern.integer);
      if (value == null) continue;
      if (!isAcceptedValue(pattern, value)) continue;
      fields[pattern.field] = pattern.integer ? value : clampRate(value);
    }
  }

  return fields;
}

export function countExtractedFields(fields: OcrExtractedFields): number {
  return Object.values(fields).filter((value) => value != null).length;
}

type OcrCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const OCR_CROP_SCALE = 2;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    image.src = url;
  });
}

function cropFromRatio(image: HTMLImageElement, crop: OcrCrop): OcrCrop {
  const width = Math.max(1, Math.round(image.naturalWidth * crop.width));
  const height = Math.max(1, Math.round(image.naturalHeight * crop.height));
  const x = Math.min(
    Math.max(0, Math.round(image.naturalWidth * crop.x)),
    image.naturalWidth - width
  );
  const y = Math.min(
    Math.max(0, Math.round(image.naturalHeight * crop.y)),
    image.naturalHeight - height
  );
  return { x, y, width, height };
}

function applyHighContrast(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const likelyYellowText = red > 135 && green > 95 && blue < 150;
    const likelyLightText = luminance > 135;
    const textPixel = likelyYellowText || likelyLightText;
    data[index] = textPixel ? 0 : 255;
    data[index + 1] = textPixel ? 0 : 255;
    data[index + 2] = textPixel ? 0 : 255;
  }

  context.putImageData(imageData, 0, 0);
}

function applyNumericHighContrast(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const yellowText = red > 115 && green > 75 && blue < 190;
    const cyanText = green > 105 && blue > 105 && red < 165;
    const lightText = luminance > 135;
    const decimalDot = red > 80 && green > 65 && blue < 130;
    const textPixel = yellowText || cyanText || lightText || decimalDot;
    data[index] = textPixel ? 0 : 255;
    data[index + 1] = textPixel ? 0 : 255;
    data[index + 2] = textPixel ? 0 : 255;
  }

  context.putImageData(imageData, 0, 0);
}

function isMahjongSoulValuePixel(red: number, green: number, blue: number): boolean {
  return red > 150 && green > 100 && blue < 90;
}

export function selectMahjongSoulStatRowCenters(centers: number[]): number[] | undefined {
  if (centers.length < 5) return undefined;

  let bestWindow: number[] | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= centers.length - 5; index += 1) {
    const window = centers.slice(index, index + 5);
    const gaps = window.slice(1).map((center, gapIndex) => center - window[gapIndex]);
    if (gaps.some((gap) => gap < 42 || gap > 76)) continue;

    const score = gaps.reduce((sum, gap) => sum + Math.abs(gap - 57), 0);
    if (score < bestScore) {
      bestScore = score;
      bestWindow = window;
    }
  }

  return bestWindow;
}

function detectMahjongSoulStatRows(image: HTMLImageElement): MahjongSoulDetectedRows {
  const scaleX = image.naturalWidth / mahjongSoulBaseSize.width;
  const scaleY = image.naturalHeight / mahjongSoulBaseSize.height;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return {};

  context.drawImage(image, 0, 0);
  const rows: MahjongSoulDetectedRows = {};
  const scanY1 = Math.round(540 * scaleY);
  const scanY2 = Math.round(1090 * scaleY);
  const minRowPixelCount = Math.max(8, Math.round(8 * scaleX));

  for (const [column, band] of Object.entries(mahjongSoulStatScanBands) as Array<
    [MahjongSoulStatColumn, { x1: number; x2: number }]
  >) {
    const x1 = Math.round(band.x1 * scaleX);
    const x2 = Math.round(band.x2 * scaleX);
    const groups: Array<Array<{ y: number; count: number }>> = [];

    for (let y = scanY1; y <= scanY2; y += 1) {
      const imageData = context.getImageData(x1, y, x2 - x1, 1).data;
      let count = 0;

      for (let index = 0; index < imageData.length; index += 4) {
        if (
          isMahjongSoulValuePixel(
            imageData[index],
            imageData[index + 1],
            imageData[index + 2]
          )
        ) {
          count += 1;
        }
      }

      if (count <= minRowPixelCount) continue;

      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || y > lastGroup[lastGroup.length - 1].y + 1) {
        groups.push([]);
      }
      groups[groups.length - 1].push({ y, count });
    }

    const centers = groups
      .map((group) => {
        const total = group.reduce((sum, item) => sum + item.count, 0);
        if (group.length < 3 || total <= 0) return undefined;
        return (
          group.reduce((sum, item) => sum + item.y * item.count, 0) / total / scaleY
        );
      })
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b);

    const statCenters = selectMahjongSoulStatRowCenters(centers);
    if (statCenters) {
      rows[column] = statCenters;
    }
  }

  return rows;
}

function resolveNumericCrop(
  crop: NumericCropDefinition,
  detectedRows: MahjongSoulDetectedRows,
  calibration: OcrCalibration = DEFAULT_OCR_CALIBRATION
): NumericCropDefinition {
  const calibrated = {
    ...crop,
    x: Math.round(crop.x + calibration.offsetX),
    y: Math.round(crop.y + calibration.offsetY),
    width: Math.round(crop.width * calibration.scale),
    height: Math.round(crop.height * calibration.scale)
  };

  if (crop.column == null || crop.row == null) return calibrated;

  const rowCenter = detectedRows[crop.column]?.[crop.row];
  if (rowCenter == null) return calibrated;

  return {
    ...calibrated,
    y: Math.round(rowCenter - calibrated.height / 2 + calibration.offsetY)
  };
}

async function canvasToPngFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  lastModified: number
): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) return null;

  return new File([blob], fileName, {
    type: "image/png",
    lastModified
  });
}

function buildNumericCropCanvas(
  image: HTMLImageElement,
  crop: NumericCropDefinition,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement | null {
  const scaleX = image.naturalWidth / mahjongSoulBaseSize.width;
  const scaleY = image.naturalHeight / mahjongSoulBaseSize.height;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  applyNumericHighContrast(canvas);
  return canvas;
}

async function buildNumericCropFile(
  image: HTMLImageElement,
  sourceFile: File,
  crop: NumericCropDefinition,
  detectedRows: MahjongSoulDetectedRows,
  calibration: OcrCalibration
): Promise<File | null> {
  const resolvedCrop = resolveNumericCrop(crop, detectedRows, calibration);
  const cropScale = 5;
  const canvas = buildNumericCropCanvas(
    image,
    resolvedCrop,
    resolvedCrop.width * cropScale,
    resolvedCrop.height * cropScale
  );
  if (!canvas) return null;

  return canvasToPngFile(
    canvas,
    `${sourceFile.name.replace(/\.[^.]+$/, "")}-${crop.field}.png`,
    sourceFile.lastModified
  );
}

async function buildNumericColumnFile(
  image: HTMLImageElement,
  sourceFile: File,
  detectedRows: MahjongSoulDetectedRows,
  calibration: OcrCalibration
): Promise<File | null> {
  const rowWidth = 1000;
  const rowHeight = 330;
  const cropScale = 5;
  const canvas = document.createElement("canvas");
  canvas.width = rowWidth;
  canvas.height = rowHeight * mahjongSoulNumericCrops.length;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (const [index, crop] of mahjongSoulNumericCrops.entries()) {
    const resolvedCrop = resolveNumericCrop(crop, detectedRows, calibration);
    const cropCanvas = buildNumericCropCanvas(
      image,
      resolvedCrop,
      resolvedCrop.width * cropScale,
      resolvedCrop.height * cropScale
    );
    if (!cropCanvas) continue;
    context.drawImage(cropCanvas, 60, index * rowHeight + 20);
  }

  return canvasToPngFile(
    canvas,
    `${sourceFile.name.replace(/\.[^.]+$/, "")}-mahjong-soul-numbers.png`,
    sourceFile.lastModified
  );
}

function cleanNumericOcrText(text: string): string {
  return normalizeFullWidth(text)
    .replace(/[^\d./,%]/g, "")
    .replace(/,/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/%+/g, "%");
}

function parseNumericCropValue(
  text: string,
  crop: NumericCropDefinition
): Partial<Record<NumericOcrField | "rank_points_max", number>> {
  const clean = cleanNumericOcrText(text);

  if (crop.field === "rank_points") {
    const match = clean.match(/(\d{1,6})\s*\/\s*(\d{1,6})/);
    if (!match) return {};
    const rankPoints = Number(match[1]);
    const rankPointsMax = Number(match[2]);
    if (
      !Number.isInteger(rankPoints) ||
      !Number.isInteger(rankPointsMax) ||
      rankPointsMax <= 0 ||
      rankPoints > rankPointsMax
    ) {
      return {};
    }
    return { rank_points: rankPoints, rank_points_max: rankPointsMax };
  }

  const numberMatch = clean.match(/\d+(?:\.\d+)?/);
  if (!numberMatch) return {};

  let value = parseNumber(numberMatch[0], crop.integer);
  if (value == null) return {};
  if (crop.rate && value > 100 && value <= 10000) value = value / 100;
  if (crop.field === "avg_place" && value > 4 && value <= 400) value = value / 100;
  if (crop.field === "avg_win_turn" && value > 30 && value <= 3000) value = value / 100;
  if (crop.rate && clampRate(value) == null) return {};
  if (crop.field === "avg_place" && (value < 1 || value > 4)) return {};
  if (crop.field === "avg_win_turn" && (value < 1 || value > 30)) return {};

  return { [crop.field]: value };
}

function parseNumericColumnText(text: string): OcrExtractedFields {
  const lines = normalizeOcrText(text)
    .split(/\n+/)
    .map(cleanNumericOcrText)
    .filter(Boolean);
  const fields: OcrExtractedFields = {};

  for (const [index, crop] of mahjongSoulNumericCrops.entries()) {
    if (crop.field === "rank_points" || crop.field === "call_rate") continue;
    const line = lines[index];
    if (!line) continue;
    Object.assign(fields, parseNumericCropValue(line, crop));
  }

  return fields;
}

function syntheticOcrText(fields: OcrExtractedFields): string {
  const lines: string[] = [];
  if (fields.game_mode === "east") lines.push("東風戦");
  if (fields.game_mode === "south") lines.push("半荘戦");
  if (fields.game_mode === "three_player") lines.push("三人戦");
  if (fields.rank_points != null && fields.rank_points_max != null) {
    lines.push(`段位ポイント ${fields.rank_points}/${fields.rank_points_max}`);
  }

  const labels: Array<[keyof OcrExtractedFields, string]> = [
    ["first_rate", "一位率"],
    ["second_rate", "二位率"],
    ["third_rate", "三位率"],
    ["fourth_rate", "四位率"],
    ["bust_rate", "飛び率"],
    ["matches", "対戦数"],
    ["avg_win_score", "平均和了"],
    ["avg_place", "平均順位"],
    ["max_renchan", "最大連荘"],
    ["avg_win_turn", "和了巡数"],
    ["win_rate", "和了率"],
    ["tsumo_rate", "ツモ率"],
    ["deal_in_rate", "放銃率"],
    ["call_rate", "副露率"],
    ["riichi_rate", "立直率"]
  ];

  for (const [field, label] of labels) {
    const value = fields[field];
    if (value == null || typeof value !== "number") continue;
    lines.push(`${label} ${value}`);
  }

  return lines.join("\n");
}

async function recognizeMahjongSoulNumericLayout(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
  calibration: OcrCalibration = DEFAULT_OCR_CALIBRATION
): Promise<OcrExtractedFields> {
  const image = await loadImage(file);
  const aspect = image.naturalWidth / image.naturalHeight;
  if (aspect < 1.8 || aspect > 2.3) return {};

  const tesseract = await import("tesseract.js");
  const worker = await tesseract.default.createWorker("eng");
  const fields: OcrExtractedFields = {};
  const columnFields: OcrExtractedFields = {};
  const detectedRows = detectMahjongSoulStatRows(image);

  try {
    const columnFile = await buildNumericColumnFile(image, file, detectedRows, calibration);
    if (columnFile) {
      onProgress?.({
        status: "雀魂スクショの数値欄をまとめて読み取っています",
        progress: 15
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789./%",
        tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK
      });
      const columnResult = await worker.recognize(columnFile);
      Object.assign(columnFields, parseNumericColumnText(columnResult.data.text));
    }

    const focusedCrops = mahjongSoulNumericCrops;

    for (const [index, crop] of focusedCrops.entries()) {
      onProgress?.({
        status: "誤読しやすい数値欄を確認しています",
        progress: 55 + Math.round((index / focusedCrops.length) * 20)
      });

      const cropFile = await buildNumericCropFile(image, file, crop, detectedRows, calibration);
      if (!cropFile) continue;

      await worker.setParameters({
        tessedit_char_whitelist: "0123456789./%",
        tessedit_pageseg_mode: tesseract.PSM.SINGLE_WORD
      });
      const result = await worker.recognize(cropFile);
      const parsed = parseNumericCropValue(result.data.text, crop);
      if (Object.keys(parsed).length > 0) {
        Object.assign(fields, parsed);
        continue;
      }

      if (crop.integer || crop.field === "rank_points") continue;

      await worker.setParameters({
        tessedit_char_whitelist: "0123456789./%",
        tessedit_pageseg_mode: tesseract.PSM.SINGLE_LINE
      });
      const retryResult = await worker.recognize(cropFile);
      Object.assign(fields, parseNumericCropValue(retryResult.data.text, crop));
    }
  } finally {
    await worker.terminate();
  }

  const mutableFields = fields as Record<string, unknown>;
  for (const [field, value] of Object.entries(columnFields)) {
    if (mutableFields[field] == null) mutableFields[field] = value;
  }

  const count = countExtractedFields(fields);
  if (count >= 10) {
    return fields;
  }

  return fields;
}

async function prepareSnapshotForOcr(file: File): Promise<File> {
  const image = await loadImage(file);
  const isLandscapeGameScreenshot = image.naturalWidth / image.naturalHeight > 1.6;
  if (!isLandscapeGameScreenshot) return file;

  const ratioCrops: OcrCrop[] = [
    { x: 0.5, y: 0.04, width: 0.38, height: 0.18 },
    { x: 0.36, y: 0.2, width: 0.53, height: 0.74 },
    { x: 0.38, y: 0.54, width: 0.48, height: 0.36 }
  ];
  const crops = ratioCrops.map((crop) => cropFromRatio(image, crop));
  const gap = 24;
  const targetWidth = Math.max(...crops.map((crop) => crop.width)) * OCR_CROP_SCALE;
  const targetHeight =
    crops.reduce((sum, crop) => sum + crop.height * OCR_CROP_SCALE, 0) +
    gap * (crops.length - 1);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  let y = 0;
  for (const crop of crops) {
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      y,
      crop.width * OCR_CROP_SCALE,
      crop.height * OCR_CROP_SCALE
    );
    y += crop.height * OCR_CROP_SCALE + gap;
  }

  applyHighContrast(canvas);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) return file;

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-ocr.png`, {
    type: "image/png",
    lastModified: file.lastModified
  });
}

export async function recognizeSnapshotText(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
  calibration: OcrCalibration = DEFAULT_OCR_CALIBRATION
): Promise<string> {
  onProgress?.({ status: "画像をOCR向けに前処理しています", progress: 0 });
  const numericFields = await recognizeMahjongSoulNumericLayout(file, onProgress, calibration);
  if (countExtractedFields(numericFields) >= 10) {
    return syntheticOcrText(numericFields);
  }

  const ocrFile = await prepareSnapshotForOcr(file);
  const tesseract = await import("tesseract.js");
  const result = await tesseract.recognize(ocrFile, "jpn+eng", {
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
