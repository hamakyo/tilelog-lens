import type {
  GameMode,
  ImportEvent,
  Snapshot,
  SnapshotCreateInput,
  SnapshotRevision
} from "../../shared/types";

export type SnapshotOrder = "asc" | "desc";
export type SnapshotCursor = {
  observedAtUtc: string;
  id: number;
};

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
type RevisionValue = string | number | null;

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
    cursor?: SnapshotCursor;
  } = {}
): Promise<{ items: Snapshot[]; total: number; nextCursor: SnapshotCursor | null }> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const order = options.order === "asc" ? "ASC" : "DESC";
  const params: Array<string | number> = [];
  const conditions: string[] = [];

  if (options.gameMode) {
    conditions.push("game_mode = ?");
    params.push(options.gameMode);
  }

  if (options.cursor) {
    const operator = order === "ASC" ? ">" : "<";
    conditions.push(
      `(observed_at_utc ${operator} ? OR (observed_at_utc = ? AND id ${operator} ?))`
    );
    params.push(
      options.cursor.observedAtUtc,
      options.cursor.observedAtUtc,
      options.cursor.id
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const paginationClause = options.cursor ? "LIMIT ?" : "LIMIT ? OFFSET ?";
  const paginationParams = options.cursor ? [limit + 1] : [limit + 1, offset];

  const rowsResult = await db
    .prepare(
      `SELECT ${selectColumns} FROM stat_snapshots ${where} ORDER BY observed_at_utc ${order}, id ${order} ${paginationClause}`
    )
    .bind(...params, ...paginationParams)
    .all<SnapshotRow>();

  const countParams: Array<string | number> = [];
  const countWhere = options.gameMode ? "WHERE game_mode = ?" : "";
  if (options.gameMode) countParams.push(options.gameMode);
  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM stat_snapshots ${countWhere}`)
    .bind(...countParams)
    .first<{ total: number }>();

  const rows = rowsResult.results ?? [];
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1);

  return {
    items: pageRows.map(rowToSnapshot),
    total: Number(totalRow?.total ?? 0),
    nextCursor:
      rows.length > limit && lastRow
        ? {
            observedAtUtc: stringValue(lastRow, "observed_at_utc"),
            id: numberValue(lastRow, "id")
          }
        : null
  };
}

export async function listAllSnapshots(
  db: D1Database,
  gameMode?: GameMode
): Promise<Snapshot[]> {
  const params: Array<string | number> = [];
  const where = gameMode ? "WHERE game_mode = ?" : "";

  if (gameMode) {
    params.push(gameMode);
  }

  const rowsResult = await db
    .prepare(
      `SELECT ${selectColumns} FROM stat_snapshots ${where} ORDER BY observed_at_utc ASC`
    )
    .bind(...params)
    .all<SnapshotRow>();

  return (rowsResult.results ?? []).map(rowToSnapshot);
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

export async function insertSnapshotWithImportEvent(
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

  const snapshotStatement = db
    .prepare(
      `INSERT INTO stat_snapshots (${insertColumns.join(", ")}) VALUES (${placeholders})`
    )
    .bind(...values);
  const importEventStatement = db
    .prepare(
      `INSERT INTO import_events (
        snapshot_id,
        status,
        source_image_sha256,
        file_name,
        image_width,
        image_height,
        parser_version,
        extracted_field_count,
        message,
        created_at
      )
      SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM stat_snapshots
      WHERE game_mode = ? AND observed_at_utc = ?`
    )
    .bind(
      "saved",
      input.source_image_sha256 ?? null,
      input.file_name ?? null,
      input.image_width ?? null,
      input.image_height ?? null,
      input.parser_version ?? null,
      input.import_metadata?.extracted_field_count ?? null,
      input.import_metadata?.status_message ?? "snapshot_saved",
      timestamp,
      input.game_mode,
      observedAt
    );

  const [result] = await db.batch([snapshotStatement, importEventStatement]);

  const id = Number(result.meta.last_row_id);
  const snapshot = await getSnapshotById(db, id);
  if (!snapshot) {
    throw new Error("Inserted snapshot could not be loaded.");
  }
  return snapshot;
}

export async function updateSnapshotWithRevision(
  db: D1Database,
  id: number,
  input: SnapshotCreateInput,
  observedAt: string,
  timestamp: string,
  previous: Snapshot
): Promise<Snapshot | null> {
  const setClause = [...mutableColumns, "updated_at"]
    .map((column) => `${column} = ?`)
    .join(", ");
  const values = [
    ...mutableColumns.map((column) => valueForColumn(input, column, observedAt)),
    timestamp,
    id
  ];

  const updateStatement = db
    .prepare(`UPDATE stat_snapshots SET ${setClause} WHERE id = ?`)
    .bind(...values);
  const changedFields = mutableColumns
    .filter((column) => column !== "observed_at_utc")
    .map((column) => ({
      field: column as keyof Snapshot,
      before: previous[column] as RevisionValue,
      after: valueForColumn(input, column, observedAt) as RevisionValue
    }))
    .filter((change) => change.before !== change.after);
  const statements: D1PreparedStatement[] = [updateStatement];

  if (changedFields.length > 0) {
    statements.push(
      db
        .prepare(
          `INSERT INTO snapshot_revisions (snapshot_id, changed_fields, created_at)
           VALUES (?, ?, ?)`
        )
        .bind(id, JSON.stringify(changedFields), timestamp)
    );
  }

  const [result] = await db.batch(statements);

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

function nullableRowNumber(row: Record<string, string | number | null>, key: string): number | null {
  const value = row[key];
  return value == null ? null : Number(value);
}

function nullableRowString(row: Record<string, string | number | null>, key: string): string | null {
  const value = row[key];
  return value == null ? null : String(value);
}

export async function listSnapshotRevisions(
  db: D1Database,
  snapshotId: number
): Promise<SnapshotRevision[]> {
  const result = await db
    .prepare(
      `SELECT id, snapshot_id, changed_fields, created_at
       FROM snapshot_revisions
       WHERE snapshot_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .bind(snapshotId)
    .all<Record<string, string | number | null>>();

  return (result.results ?? []).map((row) => ({
    id: numberValue(row, "id"),
    snapshot_id: numberValue(row, "snapshot_id"),
    changed_fields: JSON.parse(stringValue(row, "changed_fields")) as SnapshotRevision["changed_fields"],
    created_at: stringValue(row, "created_at")
  }));
}

export async function insertImportEvent(
  db: D1Database,
  event: {
    snapshotId?: number | null;
    status: ImportEvent["status"];
    sourceImageSha256?: string | null;
    fileName?: string | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
    parserVersion?: string | null;
    extractedFieldCount?: number | null;
    message?: string | null;
  },
  timestamp: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO import_events (
        snapshot_id,
        status,
        source_image_sha256,
        file_name,
        image_width,
        image_height,
        parser_version,
        extracted_field_count,
        message,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.snapshotId ?? null,
      event.status,
      event.sourceImageSha256 ?? null,
      event.fileName ?? null,
      event.imageWidth ?? null,
      event.imageHeight ?? null,
      event.parserVersion ?? null,
      event.extractedFieldCount ?? null,
      event.message ?? null,
      timestamp
    )
    .run();
}

export async function listImportEvents(db: D1Database): Promise<ImportEvent[]> {
  const result = await db
    .prepare(
      `SELECT
        id,
        snapshot_id,
        status,
        source_image_sha256,
        file_name,
        image_width,
        image_height,
        parser_version,
        extracted_field_count,
        message,
        created_at
       FROM import_events
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all<Record<string, string | number | null>>();

  return (result.results ?? []).map((row) => ({
    id: numberValue(row, "id"),
    snapshot_id: nullableRowNumber(row, "snapshot_id"),
    status: stringValue(row, "status") as ImportEvent["status"],
    source_image_sha256: nullableRowString(row, "source_image_sha256"),
    file_name: nullableRowString(row, "file_name"),
    image_width: nullableRowNumber(row, "image_width"),
    image_height: nullableRowNumber(row, "image_height"),
    parser_version: nullableRowString(row, "parser_version"),
    extracted_field_count: nullableRowNumber(row, "extracted_field_count"),
    message: nullableRowString(row, "message"),
    created_at: stringValue(row, "created_at")
  }));
}
