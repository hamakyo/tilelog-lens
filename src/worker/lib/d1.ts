import type { GameMode, Snapshot, SnapshotCreateInput } from "../../shared/types";

export type SnapshotOrder = "asc" | "desc";

type SnapshotRow = Record<string, string | number | null>;

const selectColumns = `
  id,
  observed_date,
  observed_time,
  timezone,
  observed_at_utc,
  game_mode,
  player_name,
  player_id,
  rank_name,
  rank_level,
  rank_points,
  rank_points_max,
  matches,
  avg_win_score,
  avg_place,
  max_renchan,
  avg_win_turn,
  first_rate,
  second_rate,
  third_rate,
  fourth_rate,
  bust_rate,
  win_rate,
  tsumo_rate,
  deal_in_rate,
  call_rate,
  riichi_rate,
  note,
  source_image_sha256,
  file_name,
  file_last_modified,
  exif_taken_at,
  image_width,
  image_height,
  parser_version,
  source_image_stored,
  created_at,
  updated_at
`;

const mutableColumns = [
  "observed_date",
  "observed_time",
  "timezone",
  "observed_at_utc",
  "game_mode",
  "player_name",
  "player_id",
  "rank_name",
  "rank_level",
  "rank_points",
  "rank_points_max",
  "matches",
  "avg_win_score",
  "avg_place",
  "max_renchan",
  "avg_win_turn",
  "first_rate",
  "second_rate",
  "third_rate",
  "fourth_rate",
  "bust_rate",
  "win_rate",
  "tsumo_rate",
  "deal_in_rate",
  "call_rate",
  "riichi_rate",
  "note",
  "source_image_sha256",
  "file_name",
  "file_last_modified",
  "exif_taken_at",
  "image_width",
  "image_height",
  "parser_version"
] as const;

type MutableColumn = (typeof mutableColumns)[number];

function stringValue(row: SnapshotRow, key: string): string {
  return String(row[key]);
}

function nullableString(row: SnapshotRow, key: string): string | null {
  const value = row[key];
  return value == null ? null : String(value);
}

function numberValue(row: SnapshotRow, key: string): number {
  return Number(row[key]);
}

function nullableNumber(row: SnapshotRow, key: string): number | null {
  const value = row[key];
  return value == null ? null : Number(value);
}

export function rowToSnapshot(row: SnapshotRow): Snapshot {
  return {
    id: numberValue(row, "id"),
    observed_date: stringValue(row, "observed_date"),
    observed_time: stringValue(row, "observed_time"),
    timezone: stringValue(row, "timezone"),
    observed_at_utc: stringValue(row, "observed_at_utc"),
    game_mode: stringValue(row, "game_mode") as GameMode,
    player_name: nullableString(row, "player_name"),
    player_id: nullableString(row, "player_id"),
    rank_name: nullableString(row, "rank_name"),
    rank_level: nullableNumber(row, "rank_level"),
    rank_points: nullableNumber(row, "rank_points"),
    rank_points_max: nullableNumber(row, "rank_points_max"),
    matches: numberValue(row, "matches"),
    avg_win_score: nullableNumber(row, "avg_win_score"),
    avg_place: numberValue(row, "avg_place"),
    max_renchan: nullableNumber(row, "max_renchan"),
    avg_win_turn: nullableNumber(row, "avg_win_turn"),
    first_rate: numberValue(row, "first_rate"),
    second_rate: numberValue(row, "second_rate"),
    third_rate: numberValue(row, "third_rate"),
    fourth_rate: numberValue(row, "fourth_rate"),
    bust_rate: nullableNumber(row, "bust_rate"),
    win_rate: numberValue(row, "win_rate"),
    tsumo_rate: nullableNumber(row, "tsumo_rate"),
    deal_in_rate: numberValue(row, "deal_in_rate"),
    call_rate: numberValue(row, "call_rate"),
    riichi_rate: numberValue(row, "riichi_rate"),
    note: nullableString(row, "note"),
    source_image_sha256: nullableString(row, "source_image_sha256"),
    file_name: nullableString(row, "file_name"),
    file_last_modified: nullableString(row, "file_last_modified"),
    exif_taken_at: nullableString(row, "exif_taken_at"),
    image_width: nullableNumber(row, "image_width"),
    image_height: nullableNumber(row, "image_height"),
    parser_version: nullableString(row, "parser_version"),
    source_image_stored: 0,
    created_at: stringValue(row, "created_at"),
    updated_at: stringValue(row, "updated_at")
  };
}

function valueForColumn(
  input: SnapshotCreateInput,
  column: MutableColumn,
  observedAtUtc: string
): string | number | null {
  if (column === "observed_at_utc") return observedAtUtc;
  return input[column] ?? null;
}

export async function listSnapshots(
  db: D1Database,
  options: {
    gameMode?: GameMode;
    limit?: number;
    offset?: number;
    order?: SnapshotOrder;
  } = {}
): Promise<{ items: Snapshot[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const order = options.order === "asc" ? "ASC" : "DESC";
  const params: Array<string | number> = [];
  const where = options.gameMode ? "WHERE game_mode = ?" : "";

  if (options.gameMode) {
    params.push(options.gameMode);
  }

  const rowsResult = await db
    .prepare(
      `SELECT ${selectColumns} FROM stat_snapshots ${where} ORDER BY observed_at_utc ${order} LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<SnapshotRow>();

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM stat_snapshots ${where}`)
    .bind(...params)
    .first<{ total: number }>();

  return {
    items: (rowsResult.results ?? []).map(rowToSnapshot),
    total: Number(totalRow?.total ?? 0)
  };
}

export async function listAllSnapshots(
  db: D1Database,
  gameMode?: GameMode
): Promise<Snapshot[]> {
  return (
    await listSnapshots(db, {
      gameMode,
      order: "asc",
      limit: 500,
      offset: 0
    })
  ).items;
}

export async function getSnapshotById(
  db: D1Database,
  id: number
): Promise<Snapshot | null> {
  const row = await db
    .prepare(`SELECT ${selectColumns} FROM stat_snapshots WHERE id = ?`)
    .bind(id)
    .first<SnapshotRow>();

  return row ? rowToSnapshot(row) : null;
}

export async function insertSnapshot(
  db: D1Database,
  input: SnapshotCreateInput,
  observedAt: string,
  timestamp: string
): Promise<Snapshot> {
  const insertColumns = [...mutableColumns, "created_at", "updated_at"];
  const placeholders = insertColumns.map(() => "?").join(", ");
  const values = [
    ...mutableColumns.map((column) => valueForColumn(input, column, observedAt)),
    timestamp,
    timestamp
  ];

  const result = await db
    .prepare(
      `INSERT INTO stat_snapshots (${insertColumns.join(", ")}) VALUES (${placeholders})`
    )
    .bind(...values)
    .run();

  const id = Number(result.meta.last_row_id);
  const snapshot = await getSnapshotById(db, id);
  if (!snapshot) {
    throw new Error("Inserted snapshot could not be loaded.");
  }
  return snapshot;
}

export async function updateSnapshot(
  db: D1Database,
  id: number,
  input: SnapshotCreateInput,
  observedAt: string,
  timestamp: string
): Promise<Snapshot | null> {
  const setClause = [...mutableColumns, "updated_at"]
    .map((column) => `${column} = ?`)
    .join(", ");
  const values = [
    ...mutableColumns.map((column) => valueForColumn(input, column, observedAt)),
    timestamp,
    id
  ];

  const result = await db
    .prepare(`UPDATE stat_snapshots SET ${setClause} WHERE id = ?`)
    .bind(...values)
    .run();

  if (result.meta.changes === 0) return null;
  return getSnapshotById(db, id);
}

export async function deleteSnapshot(db: D1Database, id: number): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM stat_snapshots WHERE id = ?")
    .bind(id)
    .run();
  return result.meta.changes > 0;
}

export async function hasDuplicateObservedAt(
  db: D1Database,
  gameMode: GameMode,
  observedAt: string,
  excludeId?: number
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM stat_snapshots WHERE game_mode = ? AND observed_at_utc = ? ${
        excludeId == null ? "" : "AND id != ?"
      } LIMIT 1`
    )
    .bind(...(excludeId == null ? [gameMode, observedAt] : [gameMode, observedAt, excludeId]))
    .first<{ id: number }>();

  return row != null;
}

export async function hasDuplicateImageHash(
  db: D1Database,
  sourceImageSha256: string | null,
  excludeId?: number
): Promise<boolean> {
  if (!sourceImageSha256) return false;

  const row = await db
    .prepare(
      `SELECT id FROM stat_snapshots WHERE source_image_sha256 = ? ${
        excludeId == null ? "" : "AND id != ?"
      } LIMIT 1`
    )
    .bind(...(excludeId == null ? [sourceImageSha256] : [sourceImageSha256, excludeId]))
    .first<{ id: number }>();

  return row != null;
}

export async function latestSnapshotBefore(
  db: D1Database,
  gameMode: GameMode,
  observedAt: string,
  excludeId?: number
): Promise<Snapshot | null> {
  const row = await db
    .prepare(
      `SELECT ${selectColumns} FROM stat_snapshots
       WHERE game_mode = ? AND observed_at_utc < ? ${excludeId == null ? "" : "AND id != ?"}
       ORDER BY observed_at_utc DESC
       LIMIT 1`
    )
    .bind(...(excludeId == null ? [gameMode, observedAt] : [gameMode, observedAt, excludeId]))
    .first<SnapshotRow>();

  return row ? rowToSnapshot(row) : null;
}
