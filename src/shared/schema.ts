import { z } from "zod";
import { DEFAULT_TIMEZONE, GAME_MODES } from "./constants";
import type { SnapshotCreateInput, ValidationWarning } from "./types";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const sha256Regex = /^[a-f0-9]{64}$/;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalString = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const optionalInt = (schema: z.ZodNumber) =>
  z.preprocess(emptyToNull, schema.int().nullable().optional());

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(emptyToNull, schema.nullable().optional());

const rate = z.number().min(0).max(100);

export function isValidDateString(value: string): boolean {
  if (!dateRegex.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTimeString(value: string): boolean {
  return timeRegex.test(value);
}

export const snapshotCreateSchema = z
  .object({
    observed_date: z
      .string()
      .regex(dateRegex, "observed_date must be YYYY-MM-DD")
      .refine(isValidDateString, "observed_date must be a valid calendar date"),
    observed_time: z
      .string()
      .regex(timeRegex, "observed_time must be HH:mm"),
    timezone: z.literal(DEFAULT_TIMEZONE).default(DEFAULT_TIMEZONE),
    game_mode: z.enum(GAME_MODES).default("east"),
    player_name: optionalString(80),
    player_id: optionalString(80),
    rank_name: optionalString(40),
    rank_level: optionalInt(z.number().min(0).max(20)),
    rank_points: optionalInt(z.number().min(0)),
    rank_points_max: optionalInt(z.number().positive()),
    matches: z.number().int().min(0),
    avg_win_score: optionalInt(z.number().min(0)),
    avg_place: z.number().min(1).max(4),
    max_renchan: optionalInt(z.number().min(0)),
    avg_win_turn: optionalNumber(z.number().min(0)),
    first_rate: rate,
    second_rate: rate,
    third_rate: rate,
    fourth_rate: rate,
    bust_rate: optionalNumber(rate),
    win_rate: rate,
    tsumo_rate: optionalNumber(rate),
    deal_in_rate: rate,
    call_rate: rate,
    riichi_rate: rate,
    note: optionalString(5000),
    source_image_sha256: z.preprocess(
      emptyToNull,
      z.string().regex(sha256Regex).nullable().optional()
    ),
    file_name: optionalString(255),
    file_last_modified: optionalString(80),
    exif_taken_at: optionalString(80),
    image_width: optionalInt(z.number().positive()),
    image_height: optionalInt(z.number().positive()),
    parser_version: optionalString(40)
  })
  .refine(
    (value) =>
      value.rank_points == null ||
      value.rank_points_max == null ||
      value.rank_points <= value.rank_points_max,
    {
      message: "rank_points must be less than or equal to rank_points_max",
      path: ["rank_points"]
    }
  );

export const snapshotUpdateSchema = snapshotCreateSchema;

export function getConsistencyWarnings(
  snapshot: SnapshotCreateInput
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const rankRateSum =
    snapshot.first_rate +
    snapshot.second_rate +
    snapshot.third_rate +
    snapshot.fourth_rate;

  if (Math.abs(rankRateSum - 100) > 0.2) {
    warnings.push({
      code: "RANK_RATE_SUM_NOT_100",
      message: "Placement rates do not sum to approximately 100%.",
      severity: "warning"
    });
  }

  const calculatedAvgPlace =
    (snapshot.first_rate * 1 +
      snapshot.second_rate * 2 +
      snapshot.third_rate * 3 +
      snapshot.fourth_rate * 4) /
    100;

  if (Math.abs(calculatedAvgPlace - snapshot.avg_place) > 0.03) {
    warnings.push({
      code: "AVG_PLACE_MISMATCH",
      message:
        "Average place does not match the submitted placement rates closely.",
      severity: "warning"
    });
  }

  return warnings;
}
