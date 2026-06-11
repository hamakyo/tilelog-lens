import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImagePlus, LoaderCircle, Save, ScanText } from "lucide-react";
import {
  DEFAULT_TIMEZONE,
  GAME_MODE_LABELS,
  GAME_MODES,
  RANK_LEVEL_LABELS,
  RANK_LEVELS,
  RANK_NAMES,
  RANK_NAME_LABELS,
  RANK_POINT_MAX_BY_RANK_AND_LEVEL
} from "../../shared/constants";
import type { Snapshot, SnapshotCreateInput, ValidationWarning } from "../../shared/types";
import { getConsistencyWarnings } from "../../shared/schema";
import {
  buildDataQualityWarnings,
  buildDuplicateSnapshotCandidates
} from "../../shared/metrics";
import {
  fileLastModifiedIso,
  getImageDimensions,
  sha256File
} from "../lib/imageLocal";
import {
  DEFAULT_OCR_CALIBRATION,
  countExtractedFields,
  parseMahjongStatsOcr,
  recognizeSnapshotText,
  type OcrCalibration,
  type OcrExtractedFields
} from "../lib/ocr";
import { listSnapshots } from "../lib/api";

type SnapshotFormValues = {
  observed_date: string;
  observed_time: string;
  timezone: string;
  game_mode: SnapshotCreateInput["game_mode"];
  player_name: string;
  player_id: string;
  rank_name: string;
  rank_level: string;
  rank_points: string;
  rank_points_max: string;
  matches: string;
  avg_win_score: string;
  avg_place: string;
  max_renchan: string;
  avg_win_turn: string;
  first_rate: string;
  second_rate: string;
  third_rate: string;
  fourth_rate: string;
  bust_rate: string;
  win_rate: string;
  tsumo_rate: string;
  deal_in_rate: string;
  call_rate: string;
  riichi_rate: string;
  note: string;
  source_image_sha256: string;
  file_name: string;
  file_last_modified: string;
  exif_taken_at: string;
  image_width: string;
  image_height: string;
  parser_version: string;
};

type SnapshotFormProps = {
  initialSnapshot?: Snapshot;
  submitLabel: string;
  onSubmit: (input: SnapshotCreateInput) => Promise<ValidationWarning[]>;
};

const today = new Date().toISOString().slice(0, 10);
const ocrCalibrationStorageKey = "tilelog-lens:ocr-calibration";
const ocrCalibrationPresetsStorageKey = "tilelog-lens:ocr-calibration-presets";

type OcrConfidenceLevel = "高" | "中" | "要確認";

type OcrConfidenceItem = {
  field: keyof SnapshotFormValues;
  label: string;
  value: string;
  confidence: OcrConfidenceLevel;
  reason: string;
};

type OcrCalibrationPreset = {
  id: string;
  name: string;
  calibration: OcrCalibration;
};

type OcrDiffItem = {
  field: keyof SnapshotFormValues;
  label: string;
  beforeValue: string;
  ocrValue: string;
  currentValue: string;
  changedByOcr: boolean;
  changedAfterOcr: boolean;
};

const fieldLabels: Record<keyof SnapshotFormValues, string> = {
  observed_date: "日付",
  observed_time: "時刻",
  timezone: "タイムゾーン",
  game_mode: "モード",
  player_name: "プレイヤー名",
  player_id: "プレイヤーID",
  rank_name: "段位名",
  rank_level: "段位レベル",
  rank_points: "段位ポイント",
  rank_points_max: "ポイント上限",
  matches: "対戦数",
  avg_win_score: "平均和了点",
  avg_place: "平均順位",
  max_renchan: "最大連荘",
  avg_win_turn: "平均和了巡数",
  first_rate: "一位率",
  second_rate: "二位率",
  third_rate: "三位率",
  fourth_rate: "四位率",
  bust_rate: "飛び率",
  win_rate: "和了率",
  tsumo_rate: "ツモ率",
  deal_in_rate: "放銃率",
  call_rate: "副露率",
  riichi_rate: "立直率",
  note: "メモ",
  source_image_sha256: "SHA-256",
  file_name: "ファイル名",
  file_last_modified: "最終更新",
  exif_taken_at: "EXIF撮影日時",
  image_width: "幅",
  image_height: "高さ",
  parser_version: "パーサーバージョン"
};

const requiredFormFields: Array<keyof SnapshotFormValues> = [
  "observed_date",
  "observed_time",
  "matches",
  "avg_place",
  "first_rate",
  "second_rate",
  "third_rate",
  "fourth_rate",
  "win_rate",
  "deal_in_rate",
  "call_rate",
  "riichi_rate"
];

const rateFormFields: Array<keyof SnapshotFormValues> = [
  "first_rate",
  "second_rate",
  "third_rate",
  "fourth_rate",
  "bust_rate",
  "win_rate",
  "tsumo_rate",
  "deal_in_rate",
  "call_rate",
  "riichi_rate"
];

function toValues(snapshot?: Snapshot): SnapshotFormValues {
  return {
    observed_date: snapshot?.observed_date ?? today,
    observed_time: snapshot?.observed_time ?? "",
    timezone: snapshot?.timezone ?? DEFAULT_TIMEZONE,
    game_mode: snapshot?.game_mode ?? "east",
    player_name: snapshot?.player_name ?? "",
    player_id: snapshot?.player_id ?? "",
    rank_name: snapshot?.rank_name ?? "",
    rank_level: snapshot?.rank_level?.toString() ?? "",
    rank_points: snapshot?.rank_points?.toString() ?? "",
    rank_points_max: snapshot?.rank_points_max?.toString() ?? "",
    matches: snapshot?.matches?.toString() ?? "",
    avg_win_score: snapshot?.avg_win_score?.toString() ?? "",
    avg_place: snapshot?.avg_place?.toString() ?? "",
    max_renchan: snapshot?.max_renchan?.toString() ?? "",
    avg_win_turn: snapshot?.avg_win_turn?.toString() ?? "",
    first_rate: snapshot?.first_rate?.toString() ?? "",
    second_rate: snapshot?.second_rate?.toString() ?? "",
    third_rate: snapshot?.third_rate?.toString() ?? "",
    fourth_rate: snapshot?.fourth_rate?.toString() ?? "",
    bust_rate: snapshot?.bust_rate?.toString() ?? "",
    win_rate: snapshot?.win_rate?.toString() ?? "",
    tsumo_rate: snapshot?.tsumo_rate?.toString() ?? "",
    deal_in_rate: snapshot?.deal_in_rate?.toString() ?? "",
    call_rate: snapshot?.call_rate?.toString() ?? "",
    riichi_rate: snapshot?.riichi_rate?.toString() ?? "",
    note: snapshot?.note ?? "",
    source_image_sha256: snapshot?.source_image_sha256 ?? "",
    file_name: snapshot?.file_name ?? "",
    file_last_modified: snapshot?.file_last_modified ?? "",
    exif_taken_at: snapshot?.exif_taken_at ?? "",
    image_width: snapshot?.image_width?.toString() ?? "",
    image_height: snapshot?.image_height?.toString() ?? "",
    parser_version: snapshot?.parser_version ?? ""
  };
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nullableNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function requiredNumber(value: string): number {
  return Number(value);
}

function getRankPointsMax(rankName: string, rankLevel: string): string | null {
  const level = Number(rankLevel);
  if (!RANK_LEVELS.includes(level as (typeof RANK_LEVELS)[number])) return null;

  const pointMax =
    RANK_POINT_MAX_BY_RANK_AND_LEVEL[
      rankName as keyof typeof RANK_POINT_MAX_BY_RANK_AND_LEVEL
    ]?.[level as (typeof RANK_LEVELS)[number]];

  return pointMax == null ? null : String(pointMax);
}

function hasRequiredStats(values: SnapshotFormValues): boolean {
  return [
    values.observed_date,
    values.observed_time,
    values.matches,
    values.avg_place,
    values.first_rate,
    values.second_rate,
    values.third_rate,
    values.fourth_rate,
    values.win_rate,
    values.deal_in_rate,
    values.call_rate,
    values.riichi_rate
  ].every((value) => value.trim() !== "");
}

function buildInput(values: SnapshotFormValues): SnapshotCreateInput {
  return {
    observed_date: values.observed_date,
    observed_time: values.observed_time,
    timezone: DEFAULT_TIMEZONE,
    game_mode: values.game_mode,
    player_name: nullableText(values.player_name),
    player_id: nullableText(values.player_id),
    rank_name: nullableText(values.rank_name),
    rank_level: nullableNumber(values.rank_level),
    rank_points: nullableNumber(values.rank_points),
    rank_points_max: nullableNumber(values.rank_points_max),
    matches: requiredNumber(values.matches),
    avg_win_score: nullableNumber(values.avg_win_score),
    avg_place: requiredNumber(values.avg_place),
    max_renchan: nullableNumber(values.max_renchan),
    avg_win_turn: nullableNumber(values.avg_win_turn),
    first_rate: requiredNumber(values.first_rate),
    second_rate: requiredNumber(values.second_rate),
    third_rate: requiredNumber(values.third_rate),
    fourth_rate: requiredNumber(values.fourth_rate),
    bust_rate: nullableNumber(values.bust_rate),
    win_rate: requiredNumber(values.win_rate),
    tsumo_rate: nullableNumber(values.tsumo_rate),
    deal_in_rate: requiredNumber(values.deal_in_rate),
    call_rate: requiredNumber(values.call_rate),
    riichi_rate: requiredNumber(values.riichi_rate),
    note: nullableText(values.note),
    source_image_sha256: nullableText(values.source_image_sha256),
    file_name: nullableText(values.file_name),
    file_last_modified: nullableText(values.file_last_modified),
    exif_taken_at: nullableText(values.exif_taken_at),
    image_width: nullableNumber(values.image_width),
    image_height: nullableNumber(values.image_height),
    parser_version: nullableText(values.parser_version)
  };
}

function withOcrFields(
  values: SnapshotFormValues,
  fields: OcrExtractedFields
): SnapshotFormValues {
  const next = { ...values };
  const nextRecord = next as unknown as Record<string, string>;
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (key === "game_mode") continue;
    nextRecord[key] = String(value);
  }
  next.parser_version = "ocr-tesseract-v1";
  return next;
}

function ocrFilledLabels(fields: OcrExtractedFields): string[] {
  return Object.entries(fields)
    .filter(([key, value]) => value != null && key !== "game_mode")
    .map(([key]) => fieldLabels[key as keyof SnapshotFormValues] ?? key);
}

function formatOcrDiffValue(value: string | undefined): string {
  return value == null || value.trim() === "" ? "-" : value;
}

function buildOcrDiffItems(
  beforeValues: SnapshotFormValues | null,
  fields: OcrExtractedFields,
  currentValues: SnapshotFormValues
): OcrDiffItem[] {
  if (!beforeValues) return [];

  return Object.entries(fields)
    .filter(([key, value]) => value != null && key !== "game_mode")
    .map(([key, value]) => {
      const field = key as keyof SnapshotFormValues;
      const beforeValue = beforeValues[field];
      const ocrValue = String(value);
      const currentValue = currentValues[field];

      return {
        field,
        label: fieldLabels[field] ?? key,
        beforeValue: formatOcrDiffValue(beforeValue),
        ocrValue: formatOcrDiffValue(ocrValue),
        currentValue: formatOcrDiffValue(currentValue),
        changedByOcr: beforeValue !== ocrValue,
        changedAfterOcr: currentValue !== ocrValue
      };
    });
}

function missingRequiredLabels(values: SnapshotFormValues): string[] {
  return requiredFormFields
    .filter((field) => values[field].trim() === "")
    .map((field) => fieldLabels[field]);
}

function loadOcrCalibration(): OcrCalibration {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(ocrCalibrationStorageKey) ?? "null"
    ) as Partial<OcrCalibration> | null;
    return {
      offsetX: Number(parsed?.offsetX ?? DEFAULT_OCR_CALIBRATION.offsetX),
      offsetY: Number(parsed?.offsetY ?? DEFAULT_OCR_CALIBRATION.offsetY),
      scale: Number(parsed?.scale ?? DEFAULT_OCR_CALIBRATION.scale)
    };
  } catch {
    return DEFAULT_OCR_CALIBRATION;
  }
}

function saveOcrCalibration(calibration: OcrCalibration): void {
  window.localStorage.setItem(ocrCalibrationStorageKey, JSON.stringify(calibration));
}

function loadOcrCalibrationPresets(): OcrCalibrationPreset[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(ocrCalibrationPresetsStorageKey) ?? "[]"
    ) as OcrCalibrationPreset[];
    return parsed.filter(
      (preset) =>
        typeof preset.id === "string" &&
        typeof preset.name === "string" &&
        typeof preset.calibration?.offsetX === "number" &&
        typeof preset.calibration?.offsetY === "number" &&
        typeof preset.calibration?.scale === "number"
    );
  } catch {
    return [];
  }
}

function saveOcrCalibrationPresets(presets: OcrCalibrationPreset[]): void {
  window.localStorage.setItem(
    ocrCalibrationPresetsStorageKey,
    JSON.stringify(presets)
  );
}

function snapshotObservedKey(
  snapshot: Pick<Snapshot, "observed_date" | "observed_time">
): string {
  return `${snapshot.observed_date}T${snapshot.observed_time}`;
}

function currentObservedKey(values: SnapshotFormValues): string {
  return `${values.observed_date}T${values.observed_time}`;
}

function numericValue(values: SnapshotFormValues, field: keyof SnapshotFormValues): number | null {
  const value = values[field];
  if (value.trim() === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function confidenceClass(confidence: OcrConfidenceLevel): string {
  if (confidence === "高") return "high";
  if (confidence === "中") return "medium";
  return "low";
}

function buildOcrConfidenceItems(
  fields: OcrExtractedFields,
  values: SnapshotFormValues
): OcrConfidenceItem[] {
  const extractedFields = new Set(Object.keys(fields) as Array<keyof SnapshotFormValues>);
  const targetFields = Array.from(
    new Set<keyof SnapshotFormValues>([
      ...requiredFormFields,
      ...Array.from(extractedFields).filter((field) => field !== "game_mode")
    ])
  );
  const rankRates = [
    numericValue(values, "first_rate"),
    numericValue(values, "second_rate"),
    numericValue(values, "third_rate"),
    numericValue(values, "fourth_rate")
  ];
  const rankRateSum =
    rankRates.every((value) => value != null)
      ? rankRates.reduce((sum, value) => sum + (value ?? 0), 0)
      : null;
  const calculatedPlace =
    rankRateSum != null && rankRateSum > 0
      ? (rankRates[0]! * 1 + rankRates[1]! * 2 + rankRates[2]! * 3 + rankRates[3]! * 4) / 100
      : null;
  const avgPlace = numericValue(values, "avg_place");
  const rankPoints = numericValue(values, "rank_points");
  const rankPointsMax = numericValue(values, "rank_points_max");

  return targetFields.map((field) => {
    const value = values[field];
    let confidence: OcrConfidenceLevel = extractedFields.has(field) ? "高" : "要確認";
    let reason = extractedFields.has(field) ? "OCRで検出しました。" : "OCRで検出できませんでした。";
    const numberValue = numericValue(values, field);

    if (value.trim() === "") {
      confidence = "要確認";
      reason = "未入力です。";
    } else if (rateFormFields.includes(field) && (numberValue == null || numberValue < 0 || numberValue > 100)) {
      confidence = "要確認";
      reason = "率の範囲外です。";
    } else if (
      ["first_rate", "second_rate", "third_rate", "fourth_rate"].includes(field) &&
      rankRateSum != null &&
      Math.abs(rankRateSum - 100) > 0.2
    ) {
      confidence = Math.abs(rankRateSum - 100) > 1 ? "要確認" : "中";
      reason = `順位率の合計が${rankRateSum.toFixed(2)}%です。`;
    } else if (
      field === "avg_place" &&
      calculatedPlace != null &&
      avgPlace != null &&
      Math.abs(calculatedPlace - avgPlace) > 0.03
    ) {
      confidence = Math.abs(calculatedPlace - avgPlace) > 0.15 ? "要確認" : "中";
      reason = `順位率からの計算値は${calculatedPlace.toFixed(2)}です。`;
    } else if (
      (field === "rank_points" || field === "rank_points_max") &&
      rankPoints != null &&
      rankPointsMax != null &&
      rankPoints > rankPointsMax
    ) {
      confidence = "要確認";
      reason = "段位ポイントが上限を超えています。";
    }

    return {
      field,
      label: fieldLabels[field],
      value: value.trim() === "" ? "-" : value,
      confidence,
      reason
    };
  });
}

function warningFieldsFor(warnings: ValidationWarning[]): Set<keyof SnapshotFormValues> {
  const fields = new Set<keyof SnapshotFormValues>();

  for (const warning of warnings) {
    if (warning.code === "RANK_RATE_SUM_NOT_100") {
      fields.add("first_rate");
      fields.add("second_rate");
      fields.add("third_rate");
      fields.add("fourth_rate");
    }
    if (warning.code === "AVG_PLACE_MISMATCH") {
      fields.add("avg_place");
      fields.add("first_rate");
      fields.add("second_rate");
      fields.add("third_rate");
      fields.add("fourth_rate");
    }
    if (warning.code === "RANK_POINTS_EXCEED_CAP") {
      fields.add("rank_points");
      fields.add("rank_points_max");
    }
    if (warning.code === "MATCHES_DECREASED") {
      fields.add("matches");
    }
    if (warning.code === "RATE_DELTA_NEGATIVE" || warning.code === "PERIOD_DELTA_INCONSISTENT") {
      fields.add("matches");
      for (const field of rateFormFields) fields.add(field);
    }
  }

  return fields;
}

export function SnapshotForm({
  initialSnapshot,
  submitLabel,
  onSubmit
}: SnapshotFormProps) {
  const [values, setValues] = useState<SnapshotFormValues>(() =>
    toValues(initialSnapshot)
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrFilledFields, setOcrFilledFields] = useState<string[]>([]);
  const [ocrConfidenceItems, setOcrConfidenceItems] = useState<OcrConfidenceItem[]>([]);
  const [ocrBaselineValues, setOcrBaselineValues] = useState<SnapshotFormValues | null>(null);
  const [lastOcrFields, setLastOcrFields] = useState<OcrExtractedFields>({});
  const [ocrMissingRequired, setOcrMissingRequired] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<ValidationWarning[]>([]);
  const [existingSnapshots, setExistingSnapshots] = useState<Snapshot[]>([]);
  const [ocrCalibration, setOcrCalibration] = useState<OcrCalibration>(() =>
    loadOcrCalibration()
  );
  const [ocrPresets, setOcrPresets] = useState<OcrCalibrationPreset[]>(() =>
    loadOcrCalibrationPresets()
  );
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    setValues(toValues(initialSnapshot));
  }, [initialSnapshot]);

  useEffect(() => {
    listSnapshots()
      .then((result) => setExistingSnapshots(result.items))
      .catch(() => setExistingSnapshots([]));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const localWarnings = useMemo(() => {
    if (!hasRequiredStats(values)) return [];
    try {
      const input = buildInput(values);
      return [
        ...getConsistencyWarnings(input),
        ...buildDataQualityWarnings(input, existingSnapshots, {
          excludeId: initialSnapshot?.id
        })
      ];
    } catch {
      return [];
    }
  }, [existingSnapshots, initialSnapshot?.id, values]);

  const warnings = [...localWarnings, ...serverWarnings];
  const warningFields = useMemo(() => warningFieldsFor(warnings), [warnings]);

  const duplicateCandidates = useMemo(() => {
    if (!hasRequiredStats(values)) return [];
    try {
      return buildDuplicateSnapshotCandidates(buildInput(values), existingSnapshots, {
        excludeId: initialSnapshot?.id
      });
    } catch {
      return [];
    }
  }, [existingSnapshots, initialSnapshot?.id, values]);

  const previousSnapshot = useMemo(() => {
    const key = currentObservedKey(values);
    return existingSnapshots
      .filter((snapshot) => snapshot.id !== initialSnapshot?.id)
      .filter((snapshot) => snapshot.game_mode === values.game_mode)
      .filter((snapshot) => snapshotObservedKey(snapshot) < key)
      .sort((a, b) => b.observed_at_utc.localeCompare(a.observed_at_utc))[0];
  }, [existingSnapshots, initialSnapshot?.id, values.game_mode, values.observed_date, values.observed_time]);

  const matchesDelta = useMemo(() => {
    const matches = numericValue(values, "matches");
    if (!previousSnapshot || matches == null) return null;
    return matches - previousSnapshot.matches;
  }, [previousSnapshot, values]);
  const ocrDiffItems = useMemo(
    () => buildOcrDiffItems(ocrBaselineValues, lastOcrFields, values),
    [lastOcrFields, ocrBaselineValues, values]
  );

  const setField =
    (field: keyof SnapshotFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };

  const setRankField =
    (field: "rank_name" | "rank_level") =>
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = event.target.value;
      setValues((current) => {
        const next = { ...current, [field]: selectedValue };
        const pointMax = getRankPointsMax(next.rank_name, next.rank_level);
        return pointMax == null ? next : { ...next, rank_points_max: pointMax };
      });
    };

  const setOcrCalibrationField =
    (field: keyof OcrCalibration) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(event.target.value);
      const value = field === "scale" ? Math.max(0.85, Math.min(1.2, raw)) : raw;
      setOcrCalibration((current) => {
        const next = { ...current, [field]: value };
        saveOcrCalibration(next);
        return next;
      });
    };

  function applyOcrPreset(presetId: string) {
    setSelectedPresetId(presetId);
    const preset = ocrPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setOcrCalibration(preset.calibration);
    saveOcrCalibration(preset.calibration);
  }

  function saveCurrentOcrPreset() {
    const name = presetName.trim();
    if (name === "") {
      setMessage("プリセット名を入力してください。");
      return;
    }

    const preset: OcrCalibrationPreset = {
      id: `preset-${Date.now().toString(36)}`,
      name,
      calibration: ocrCalibration
    };
    const next = [...ocrPresets, preset];
    setOcrPresets(next);
    saveOcrCalibrationPresets(next);
    setSelectedPresetId(preset.id);
    setPresetName("");
    setMessage("OCRプリセットを保存しました。");
  }

  function deleteSelectedOcrPreset() {
    if (selectedPresetId === "") return;
    const next = ocrPresets.filter((preset) => preset.id !== selectedPresetId);
    setOcrPresets(next);
    saveOcrCalibrationPresets(next);
    setSelectedPresetId("");
    setMessage("OCRプリセットを削除しました。");
  }

  function resetOcrCalibration() {
    setOcrCalibration(DEFAULT_OCR_CALIBRATION);
    saveOcrCalibration(DEFAULT_OCR_CALIBRATION);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setOcrText(null);
    setOcrProgress(null);
    setOcrFilledFields([]);
    setOcrConfidenceItems([]);
    setOcrBaselineValues(null);
    setLastOcrFields({});
    setOcrMissingRequired([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage("ローカル画像のメタデータを読み取っています...");

    try {
      const [hash, dimensions] = await Promise.all([
        sha256File(file),
        getImageDimensions(file)
      ]);

      setValues((current) => ({
        ...current,
        source_image_sha256: hash,
        file_name: file.name,
        file_last_modified: fileLastModifiedIso(file),
        image_width: String(dimensions.width),
        image_height: String(dimensions.height),
        parser_version: current.parser_version || "manual-v1"
      }));
      setMessage("画像メタデータを取得しました。画像本体はブラウザ内に留まります。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像メタデータの取得に失敗しました。");
    }
  }

  async function handleRunOcr() {
    if (!selectedFile) return;

    setOcrBusy(true);
    setOcrProgress("OCRを開始しています...");
    setMessage(null);
    const beforeOcrValues = values;

    try {
      const text = await recognizeSnapshotText(
        selectedFile,
        (progress) => {
          setOcrProgress(`${progress.status} ${progress.progress}%`);
        },
        ocrCalibration
      );
      const extracted = parseMahjongStatsOcr(text);
      const count = countExtractedFields(extracted);
      setOcrText(text);
      setOcrFilledFields(ocrFilledLabels(extracted));
      setOcrBaselineValues(beforeOcrValues);
      setLastOcrFields(extracted);
      setValues((current) => {
        const next = withOcrFields(current, extracted);
        setOcrConfidenceItems(buildOcrConfidenceItems(extracted, next));
        setOcrMissingRequired(missingRequiredLabels(next));
        return next;
      });
      setMessage(
        count === 0
          ? "OCRは完了しましたが、対応している成績ラベルを検出できませんでした。"
          : `OCRで${count}項目を入力しました。未入力の必須項目を確認してください。`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OCRに失敗しました。");
    } finally {
      setOcrBusy(false);
      setOcrProgress(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setServerWarnings([]);

    try {
      const warnings = await onSubmit(buildInput(values));
      setServerWarnings(warnings);
      setMessage("記録を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "記録の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="snapshot-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h2>観測情報</h2>
        <div className="form-grid">
          <label>
            <span>日付</span>
            <input
              required
              type="date"
              value={values.observed_date}
              onChange={setField("observed_date")}
            />
          </label>
          <label>
            <span>時刻</span>
            <input
              required
              type="time"
              step={60}
              value={values.observed_time}
              onChange={setField("observed_time")}
            />
          </label>
          <label>
            <span>タイムゾーン</span>
            <input value={DEFAULT_TIMEZONE} readOnly />
          </label>
          <label>
            <span>モード</span>
            <select value={values.game_mode} onChange={setField("game_mode")}>
              {GAME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {GAME_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {previousSnapshot || duplicateCandidates.length > 0 ? (
        <section className="assist-panel">
          {previousSnapshot ? (
            <div>
              <h2>手入力補助</h2>
              <dl className="assist-grid">
                <div>
                  <dt>前回同モード</dt>
                  <dd>
                    {previousSnapshot.observed_date} {previousSnapshot.observed_time}
                  </dd>
                </div>
                <div>
                  <dt>前回対戦数</dt>
                  <dd>{previousSnapshot.matches}戦</dd>
                </div>
                <div>
                  <dt>今回差分</dt>
                  <dd>
                    {matchesDelta == null
                      ? "-"
                      : matchesDelta >= 0
                        ? `+${matchesDelta}戦`
                        : `${matchesDelta}戦`}
                  </dd>
                </div>
                <div>
                  <dt>前回平均順位</dt>
                  <dd>{previousSnapshot.avg_place.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>前回和了率 / 放銃率</dt>
                  <dd>
                    {previousSnapshot.win_rate.toFixed(2)}% / {previousSnapshot.deal_in_rate.toFixed(2)}%
                  </dd>
                </div>
              </dl>
              <p>黄色の入力欄は、前回記録や累積率との整合性確認が必要です。</p>
            </div>
          ) : null}
          {duplicateCandidates.length > 0 ? (
            <div>
              <h2>重複候補</h2>
              <ul className="candidate-list">
                {duplicateCandidates.slice(0, 5).map((candidate) => (
                  <li key={`${candidate.snapshot_id}-${candidate.reason}`}>
                    <strong>
                      #{candidate.snapshot_id} {candidate.observed_date} {candidate.observed_time}
                    </strong>
                    <span>{candidate.message} 対戦数: {candidate.matches}戦</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="form-section">
        <h2>プレイヤー・段位</h2>
        <div className="form-grid">
          <label>
            <span>プレイヤー名</span>
            <input value={values.player_name} maxLength={80} onChange={setField("player_name")} />
          </label>
          <label>
            <span>段位名</span>
            <select value={values.rank_name} onChange={setRankField("rank_name")}>
              <option value="">選択してください</option>
              {RANK_NAMES.map((rank) => (
                <option key={rank} value={rank}>
                  {RANK_NAME_LABELS[rank]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>段位レベル</span>
            <select value={values.rank_level} onChange={setRankField("rank_level")}>
              <option value="">選択してください</option>
              {RANK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {RANK_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
          <label className={warningFields.has("rank_points") ? "field-warning" : undefined}>
            <span>段位ポイント</span>
            <input type="number" min={0} value={values.rank_points} onChange={setField("rank_points")} />
          </label>
          <label className={warningFields.has("rank_points_max") ? "field-warning" : undefined}>
            <span>ポイント上限</span>
            <input type="number" min={1} value={values.rank_points_max} onChange={setField("rank_points_max")} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>対戦サマリー</h2>
        <div className="form-grid">
          <label className={warningFields.has("matches") ? "field-warning" : undefined}>
            <span>対戦数</span>
            <input required type="number" min={0} value={values.matches} onChange={setField("matches")} />
          </label>
          <label className={warningFields.has("avg_place") ? "field-warning" : undefined}>
            <span>平均順位</span>
            <input required type="number" min={1} max={4} step="0.01" value={values.avg_place} onChange={setField("avg_place")} />
          </label>
          <label>
            <span>平均和了点</span>
            <input type="number" min={0} value={values.avg_win_score} onChange={setField("avg_win_score")} />
          </label>
          <label>
            <span>最大連荘</span>
            <input type="number" min={0} value={values.max_renchan} onChange={setField("max_renchan")} />
          </label>
          <label>
            <span>平均和了巡数</span>
            <input type="number" min={0} step="0.01" value={values.avg_win_turn} onChange={setField("avg_win_turn")} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>順位率</h2>
        <div className="form-grid">
          {[
            ["first_rate", "一位率"],
            ["second_rate", "二位率"],
            ["third_rate", "三位率"],
            ["fourth_rate", "四位率"],
            ["bust_rate", "飛び率"]
          ].map(([field, label]) => (
            <label
              key={field}
              className={warningFields.has(field as keyof SnapshotFormValues) ? "field-warning" : undefined}
            >
              <span>{label}</span>
              <input
                required={field !== "bust_rate"}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values[field as keyof SnapshotFormValues]}
                onChange={setField(field as keyof SnapshotFormValues)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>行動率</h2>
        <div className="form-grid">
          {[
            ["win_rate", "和了率"],
            ["tsumo_rate", "ツモ率"],
            ["deal_in_rate", "放銃率"],
            ["call_rate", "副露率"],
            ["riichi_rate", "立直率"]
          ].map(([field, label]) => (
            <label
              key={field}
              className={warningFields.has(field as keyof SnapshotFormValues) ? "field-warning" : undefined}
            >
              <span>{label}</span>
              <input
                required={field !== "tsumo_rate"}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values[field as keyof SnapshotFormValues]}
                onChange={setField(field as keyof SnapshotFormValues)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>メモとローカル画像</h2>
        <label className="wide-label">
          <span>メモ</span>
          <textarea
            value={values.note}
            maxLength={5000}
            rows={4}
            onChange={setField("note")}
          />
        </label>
        <div className="image-row">
          <label className="file-button">
            <ImagePlus size={18} aria-hidden="true" />
            <span>画像を選択</span>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!selectedFile || ocrBusy}
            onClick={() => void handleRunOcr()}
          >
            {ocrBusy ? (
              <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
            ) : (
              <ScanText size={18} aria-hidden="true" />
            )}
            <span>{ocrBusy ? "OCR実行中" : "OCRを実行"}</span>
          </button>
          {previewUrl ? <img className="local-preview" src={previewUrl} alt="" /> : null}
        </div>
        <details className="ocr-calibration">
          <summary>OCR読み取り位置を調整</summary>
          <div className="calibration-grid">
            <label>
              <span>横位置</span>
              <input
                type="range"
                min={-80}
                max={80}
                step={2}
                value={ocrCalibration.offsetX}
                onChange={setOcrCalibrationField("offsetX")}
              />
              <output>{ocrCalibration.offsetX}px</output>
            </label>
            <label>
              <span>縦位置</span>
              <input
                type="range"
                min={-80}
                max={80}
                step={2}
                value={ocrCalibration.offsetY}
                onChange={setOcrCalibrationField("offsetY")}
              />
              <output>{ocrCalibration.offsetY}px</output>
            </label>
            <label>
              <span>領域サイズ</span>
              <input
                type="range"
                min={0.85}
                max={1.2}
                step={0.01}
                value={ocrCalibration.scale}
                onChange={setOcrCalibrationField("scale")}
              />
              <output>{Math.round(ocrCalibration.scale * 100)}%</output>
            </label>
            <button type="button" className="secondary-button" onClick={resetOcrCalibration}>
              初期値に戻す
            </button>
          </div>
          <div className="preset-row">
            <label>
              <span>プリセット</span>
              <select
                value={selectedPresetId}
                onChange={(event) => applyOcrPreset(event.target.value)}
              >
                <option value="">選択してください</option>
                {ocrPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>保存名</span>
              <input
                value={presetName}
                maxLength={40}
                onChange={(event) => setPresetName(event.target.value)}
              />
            </label>
            <button type="button" className="secondary-button" onClick={saveCurrentOcrPreset}>
              現在値を保存
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={selectedPresetId === ""}
              onClick={deleteSelectedOcrPreset}
            >
              削除
            </button>
          </div>
        </details>
        {ocrProgress ? <p className="ocr-progress">{ocrProgress}</p> : null}
        {ocrFilledFields.length > 0 || ocrMissingRequired.length > 0 ? (
          <div className="ocr-summary" role="status">
            {ocrFilledFields.length > 0 ? (
              <p>
                <strong>OCR入力済み:</strong> {ocrFilledFields.join("、")}
              </p>
            ) : null}
            {ocrMissingRequired.length > 0 ? (
              <p>
                <strong>未入力の必須項目:</strong> {ocrMissingRequired.join("、")}
              </p>
            ) : (
              <p>
                <strong>未入力の必須項目:</strong> なし
              </p>
            )}
          </div>
        ) : null}
        {ocrConfidenceItems.length > 0 ? (
          <div className="ocr-confidence">
            <h3>OCR信頼度</h3>
            <div className="confidence-grid">
              {ocrConfidenceItems.map((item) => (
                <div key={item.field} className={`confidence-item ${confidenceClass(item.confidence)}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.confidence}</em>
                  <small>{item.reason}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {ocrDiffItems.length > 0 ? (
          <div className="ocr-diff">
            <div className="section-heading inline-heading">
              <h3>OCR差分確認</h3>
              <p>OCR実行前、OCR値、現在値を比較します。</p>
            </div>
            <div className="table-scroll compact-table">
              <table>
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>OCR前</th>
                    <th>OCR値</th>
                    <th>現在値</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrDiffItems.map((item) => (
                    <tr key={item.field}>
                      <td>{item.label}</td>
                      <td>{item.beforeValue}</td>
                      <td>{item.ocrValue}</td>
                      <td>{item.currentValue}</td>
                      <td>
                        <span
                          className={`code-pill ${
                            item.changedAfterOcr
                              ? "pill-warning"
                              : item.changedByOcr
                                ? "pill-ok"
                                : ""
                          }`}
                        >
                          {item.changedAfterOcr
                            ? "手修正あり"
                            : item.changedByOcr
                              ? "OCR適用"
                              : "変更なし"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ocrText ? (
          <details className="ocr-result">
            <summary>OCR結果テキスト</summary>
            <textarea value={ocrText} readOnly rows={5} />
          </details>
        ) : null}
        <div className="form-grid metadata-grid">
          <label>
            <span>SHA-256</span>
            <input value={values.source_image_sha256} onChange={setField("source_image_sha256")} />
          </label>
          <label>
            <span>ファイル名</span>
            <input value={values.file_name} maxLength={255} onChange={setField("file_name")} />
          </label>
          <label>
            <span>最終更新</span>
            <input value={values.file_last_modified} onChange={setField("file_last_modified")} />
          </label>
          <label>
            <span>幅</span>
            <input type="number" min={1} value={values.image_width} onChange={setField("image_width")} />
          </label>
          <label>
            <span>高さ</span>
            <input type="number" min={1} value={values.image_height} onChange={setField("image_height")} />
          </label>
        </div>
      </section>

      {warnings.length > 0 ? (
        <div className="warning-list" role="status">
          {warnings.map((warning, index) => (
            <div key={`${warning.code}-${index}`}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={busy}>
          <Save size={18} aria-hidden="true" />
          <span>{busy ? "保存中" : submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
