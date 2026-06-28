# DESIGN.md — TileLog Lens architecture and implementation design

## 1. Architecture overview

```txt
Owner browser
  ├─ React SPA
  │   ├─ local screenshot preview
  │   ├─ optional browser-side OCR/manual entry
  │   ├─ SHA-256 hash generation in browser
  │   └─ CSV/JSON download UI
  │
  ↓ authenticated HTTPS behind Cloudflare Access

Cloudflare Access
  ├─ email One-time PIN / OTP
  └─ policy allows only OWNER_EMAIL

Cloudflare Worker
  ├─ Hono API
  ├─ Access JWT validation middleware
  ├─ request guard middleware
  ├─ static React assets
  └─ D1 queries

Cloudflare D1
  ├─ stat_snapshots
  └─ play_notes (future, not in MVP migration)
```

No screenshot storage service is used in MVP. R2 is intentionally omitted.
MVP stores one optional note directly on `stat_snapshots.note`.

## 2. Runtime flow

### 2.1 Login

1. Owner visits app URL.
2. Cloudflare Access prompts for email OTP.
3. Owner authenticates.
4. Access forwards request to Worker and includes `Cf-Access-Jwt-Assertion`.
5. Hono middleware validates JWT and owner email.
6. React SPA loads.

### 2.2 Snapshot creation

1. Owner opens Import page.
2. Owner selects local screenshot optionally.
3. Browser displays image preview locally.
4. Browser extracts local metadata:
   - filename
   - last modified
   - image dimensions
   - optional EXIF timestamp
   - SHA-256 hash
5. Browser may run OCR locally. Manual entry is always available.
6. Owner enters required `observed_date` and `observed_time`.
7. Owner confirms all values.
8. React POSTs JSON-only payload to `/api/snapshots`.
9. API validates request and rejects image/base64 payloads.
10. API stores numerical data in D1.

### 2.3 Export

1. Owner clicks export button.
2. React requests authenticated export endpoint.
3. API reads D1.
4. API generates CSV/JSON in memory.
5. API returns download response.
6. Export file is not stored server-side.

## 3. Cloudflare Access design

### 3.1 Perimeter protection

Cloudflare Access protects the full app hostname.

Policy:

```txt
Action: Allow
Include: Emails -> OWNER_EMAIL only
Login method: One-time PIN / OTP
```

Avoid policies such as `Everyone`, broad domains, or bypass rules.

### 3.2 Application-level authorization

The Worker must validate Access JWT even though Access already protects the perimeter.

Reasons:

- defense in depth
- protects API if routing changes
- detects misconfiguration
- ensures only OWNER_EMAIL can mutate/export data

JWT validation checks:

- header exists: `Cf-Access-Jwt-Assertion`
- signature verified by Cloudflare Access JWKS
- `iss` equals configured `ACCESS_ISSUER`
- `aud` includes configured `ACCESS_AUD`
- token not expired
- `email` equals `OWNER_EMAIL`

## 4. Deployment design

Recommended production settings:

```jsonc
{
  "name": "tilelog-lens",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-06-01",
  "workers_dev": false,
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tilelog_lens",
      "database_id": "<database-id>"
    }
  ],
  "vars": {
    "ENVIRONMENT": "production",
    "ACCESS_ISSUER": "https://<team-name>.cloudflareaccess.com",
    "ACCESS_JWKS_URL": "https://<team-name>.cloudflareaccess.com/cdn-cgi/access/certs"
  }
}
```

Secrets:

```txt
OWNER_EMAIL
ACCESS_AUD
```

If `workers_dev` is enabled for preview, protect the workers.dev route with Access too.

## 5. Data model

### 5.1 Core table: `stat_snapshots`

```sql
CREATE TABLE stat_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  observed_date TEXT NOT NULL
    CHECK (observed_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  observed_time TEXT NOT NULL
    CHECK (
      observed_time GLOB '[0-1][0-9]:[0-5][0-9]'
      OR observed_time GLOB '2[0-3]:[0-5][0-9]'
    ),

  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  observed_at_utc TEXT NOT NULL,

  game_mode TEXT NOT NULL DEFAULT 'east',

  player_name TEXT,
  player_id TEXT,

  rank_name TEXT,
  rank_level INTEGER,
  rank_points INTEGER,
  rank_points_max INTEGER,

  matches INTEGER NOT NULL CHECK (matches >= 0),
  avg_win_score INTEGER CHECK (avg_win_score IS NULL OR avg_win_score >= 0),
  avg_place REAL NOT NULL CHECK (avg_place >= 1.0 AND avg_place <= 4.0),
  max_renchan INTEGER CHECK (max_renchan IS NULL OR max_renchan >= 0),
  avg_win_turn REAL CHECK (avg_win_turn IS NULL OR avg_win_turn >= 0),

  first_rate REAL NOT NULL CHECK (first_rate >= 0 AND first_rate <= 100),
  second_rate REAL NOT NULL CHECK (second_rate >= 0 AND second_rate <= 100),
  third_rate REAL NOT NULL CHECK (third_rate >= 0 AND third_rate <= 100),
  fourth_rate REAL NOT NULL CHECK (fourth_rate >= 0 AND fourth_rate <= 100),
  bust_rate REAL CHECK (bust_rate IS NULL OR (bust_rate >= 0 AND bust_rate <= 100)),

  win_rate REAL NOT NULL CHECK (win_rate >= 0 AND win_rate <= 100),
  tsumo_rate REAL CHECK (tsumo_rate IS NULL OR (tsumo_rate >= 0 AND tsumo_rate <= 100)),
  deal_in_rate REAL NOT NULL CHECK (deal_in_rate >= 0 AND deal_in_rate <= 100),
  call_rate REAL NOT NULL CHECK (call_rate >= 0 AND call_rate <= 100),
  riichi_rate REAL NOT NULL CHECK (riichi_rate >= 0 AND riichi_rate <= 100),

  note TEXT,

  source_image_sha256 TEXT,
  file_name TEXT,
  file_last_modified TEXT,
  exif_taken_at TEXT,
  image_width INTEGER CHECK (image_width IS NULL OR image_width > 0),
  image_height INTEGER CHECK (image_height IS NULL OR image_height > 0),
  parser_version TEXT,

  source_image_stored INTEGER NOT NULL DEFAULT 0 CHECK (source_image_stored = 0),

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  CHECK (rank_points IS NULL OR rank_points >= 0),
  CHECK (rank_points_max IS NULL OR rank_points_max > 0),
  CHECK (rank_points IS NULL OR rank_points_max IS NULL OR rank_points <= rank_points_max),

  UNIQUE (game_mode, observed_at_utc)
);

CREATE INDEX idx_stat_snapshots_observed_at
  ON stat_snapshots(observed_at_utc);

CREATE INDEX idx_stat_snapshots_mode_observed
  ON stat_snapshots(game_mode, observed_at_utc);

CREATE INDEX idx_stat_snapshots_source_hash
  ON stat_snapshots(source_image_sha256);
```

### 5.2 Future notes table: `play_notes`

MVP stores one optional note directly on `stat_snapshots.note`.
A separate `play_notes` table is reserved for future richer note-taking
features and is not part of the initial migration.

Future example:

```sql
CREATE TABLE play_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER,
  noted_at TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES stat_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX idx_play_notes_snapshot_id
  ON play_notes(snapshot_id);
```

## 6. Shared TypeScript types

```ts
export type GameMode = "east" | "south" | "three_player" | "other";

export type Snapshot = {
  id: number;
  observed_date: string;
  observed_time: string;
  timezone: string;
  observed_at_utc: string;
  game_mode: GameMode;
  player_name?: string | null;
  player_id?: string | null;
  rank_name?: string | null;
  rank_level?: number | null;
  rank_points?: number | null;
  rank_points_max?: number | null;
  matches: number;
  avg_win_score?: number | null;
  avg_place: number;
  max_renchan?: number | null;
  avg_win_turn?: number | null;
  first_rate: number;
  second_rate: number;
  third_rate: number;
  fourth_rate: number;
  bust_rate?: number | null;
  win_rate: number;
  tsumo_rate?: number | null;
  deal_in_rate: number;
  call_rate: number;
  riichi_rate: number;
  note?: string | null;
  source_image_sha256?: string | null;
  source_image_stored: 0;
  created_at: string;
  updated_at: string;
};
```

## 7. Validation design

Use Zod schemas shared between frontend and Worker.

### 7.1 Snapshot create schema

```ts
const rate = z.number().min(0).max(100);

export const snapshotCreateSchema = z.object({
  observed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observed_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.literal("Asia/Tokyo").default("Asia/Tokyo"),
  game_mode: z.enum(["east", "south", "three_player", "other"]).default("east"),
  player_name: z.string().max(80).nullable().optional(),
  player_id: z.string().max(80).nullable().optional(),
  rank_name: z.string().max(40).nullable().optional(),
  rank_level: z.number().int().min(1).max(3).nullable().optional(),
  rank_points: z.number().int().min(0).nullable().optional(),
  rank_points_max: z.number().int().positive().nullable().optional(),
  matches: z.number().int().min(0),
  avg_win_score: z.number().int().min(0).nullable().optional(),
  avg_place: z.number().min(1).max(4),
  max_renchan: z.number().int().min(0).nullable().optional(),
  avg_win_turn: z.number().min(0).nullable().optional(),
  first_rate: rate,
  second_rate: rate,
  third_rate: rate,
  fourth_rate: rate,
  bust_rate: rate.nullable().optional(),
  win_rate: rate,
  tsumo_rate: rate.nullable().optional(),
  deal_in_rate: rate,
  call_rate: rate,
  riichi_rate: rate,
  note: z.string().max(5000).nullable().optional(),
  source_image_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  file_name: z.string().max(255).nullable().optional(),
  file_last_modified: z.string().max(80).nullable().optional(),
  exif_taken_at: z.string().max(80).nullable().optional(),
  image_width: z.number().int().positive().nullable().optional(),
  image_height: z.number().int().positive().nullable().optional(),
  parser_version: z.string().max(40).nullable().optional()
});
```

### 7.2 Consistency warnings

Return warnings to frontend:

```ts
type ValidationWarning = {
  code:
    | "RANK_RATE_SUM_NOT_100"
    | "AVG_PLACE_MISMATCH"
    | "MATCHES_DECREASED"
    | "DUPLICATE_IMAGE_HASH"
    | "DUPLICATE_OBSERVED_AT";
  message: string;
  severity: "warning";
};
```

Calculations:

```ts
const rankRateSum = first + second + third + fourth;
const calculatedAvgPlace =
  first / 100 * 1 + second / 100 * 2 + third / 100 * 3 + fourth / 100 * 4;
```

## 8. API design

All API routes require Access JWT authorization.

### 8.1 `GET /api/health`

Returns:

```json
{ "ok": true }
```

### 8.2 `GET /api/snapshots`

Query parameters:

- `game_mode` optional
- `limit` default 100
- `offset` default 0
- `order` `asc|desc`, default `desc`

Returns:

```json
{
  "items": [],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 241
  }
}
```

### 8.3 `POST /api/snapshots`

Input: snapshot create JSON.

Returns:

```json
{
  "item": { "id": 1 },
  "warnings": []
}
```

### 8.4 `GET /api/snapshots/:id`

Returns one snapshot.

### 8.5 `PUT /api/snapshots/:id`

Updates snapshot.

Rules:

- full update preferred for MVP.
- derive `observed_at_utc` server-side again when date/time changes.

### 8.6 `DELETE /api/snapshots/:id`

Hard delete.

Returns:

```json
{ "ok": true }
```

### 8.7 `GET /api/analytics/deltas`

Returns consecutive-snapshot estimates.

```ts
type EstimatedDelta = {
  from_snapshot_id: number;
  to_snapshot_id: number;
  from_observed_at_utc: string;
  to_observed_at_utc: string;
  matches_delta: number;
  estimated_first_delta?: number;
  estimated_second_delta?: number;
  estimated_third_delta?: number;
  estimated_fourth_delta?: number;
  estimated_win_delta?: number;
  estimated_deal_in_delta?: number;
  estimated_call_delta?: number;
  estimated_riichi_delta?: number;
  period_first_rate?: number;
  period_second_rate?: number;
  period_third_rate?: number;
  period_fourth_rate?: number;
  period_win_rate?: number;
  period_deal_in_rate?: number;
  period_call_rate?: number;
  period_riichi_rate?: number;
  quality: "ok" | "same_matches" | "negative_matches" | "insufficient_data";
};
```

### 8.8 CSV export endpoints

- `GET /api/export/snapshots.csv`
- `GET /api/export/deltas.csv`

Headers:

```txt
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="tilelog-snapshots.csv"
```

### 8.9 AI JSON export endpoint

`GET /api/export/ai-context.json?anonymize=true`

Default `anonymize=true`.

Headers:

```txt
Content-Type: application/json; charset=utf-8
Content-Disposition: attachment; filename="tilelog-ai-context.json"
```

## 9. Derived metrics

For each snapshot:

```ts
attack_defense_gap = win_rate - deal_in_rate;
top_two_rate = first_rate + second_rate;
bottom_two_rate = third_rate + fourth_rate;
rank_point_progress = rank_points / rank_points_max when both exist;
calculated_avg_place =
  1 * first_rate / 100 +
  2 * second_rate / 100 +
  3 * third_rate / 100 +
  4 * fourth_rate / 100;
```

For consecutive snapshots:

```ts
estimated_count(metricRate, matches) = Math.round(matches * metricRate / 100);
period_count = estimated_count(B) - estimated_count(A);
period_rate = period_count / matches_delta * 100;
```

Show caveat:

> Period values are estimates because source screenshots expose cumulative rates rounded to two decimal places.

## 10. Frontend design

### 10.1 Pages

```txt
/
  Dashboard
/import
  Create snapshot from manual entry/local screenshot preview
/snapshots
  List snapshots
/snapshots/:id
  View/edit snapshot
/export
  CSV/JSON exports
/settings
  Privacy/disclaimer and owner-only info
```

### 10.2 Import form sections

1. Observation timestamp
   - date required
   - time required, HH:mm
   - timezone fixed/default Asia/Tokyo
2. Rank
   - rank name
   - level
   - points/max
3. Match summary
   - matches
   - average place
   - average win score
   - max renchan
   - average win turn
4. Placement rates
   - first/second/third/fourth
   - bust
5. Action rates
   - win
   - tsumo
   - deal-in
   - call
   - riichi
6. Optional note
7. Local image metadata
   - image hash
   - file name
   - dimensions
   - last modified

### 10.3 Local image handling

Implement browser-only helpers:

```ts
async function sha256File(file: File): Promise<string>;
async function getImageDimensions(file: File): Promise<{ width: number; height: number }>;
function fileLastModifiedIso(file: File): string;
```

Important:

- Never include the File object in API calls.
- Never use `JSON.stringify` on objects that include the file or image data.
- Clear object URLs after use with `URL.revokeObjectURL`.

## 11. Export JSON design

Example shape:

```json
{
  "schema_version": "1.0",
  "app": "TileLog Lens",
  "game": "Mahjong Soul / 雀魂",
  "exported_at": "2026-06-03T12:00:00.000Z",
  "privacy": {
    "anonymized": true,
    "screenshots_included": false,
    "source_images_stored": false
  },
  "metrics_description": {
    "avg_place": "Average placement. Lower is better.",
    "win_rate": "Winning hand rate.",
    "deal_in_rate": "Deal-in rate.",
    "call_rate": "Open call rate.",
    "riichi_rate": "Riichi declaration rate.",
    "attack_defense_gap": "win_rate minus deal_in_rate. Higher is generally better."
  },
  "summary": {
    "snapshot_count": 0,
    "latest_observed_at_utc": null,
    "latest_game_mode": null,
    "latest_metrics": null,
    "attack_style_label": null,
    "stability_status": "insufficient_data",
    "top_findings": [],
    "recommended_actions": [],
    "data_quality_issue_count": 0,
    "summary_text": "Not enough data."
  },
  "snapshots": [],
  "derived_metrics": [],
  "estimated_deltas": [],
  "period_analyses": [],
  "period_comparisons": [],
  "metric_distributions": [],
  "riichi_trends": [],
  "riichi_risk_signals": [],
  "attack_style": null,
  "analysis_comments": [],
  "improvement_priorities": [],
  "regression_factors": [],
  "focus_recommendations": [],
  "stability_score": {
    "score": null,
    "status": "insufficient_data",
    "summary": "Not enough data.",
    "volatile_metrics": [],
    "watch_metrics": []
  },
  "goal_gap_comments": [],
  "rank_point_analysis": null,
  "data_quality_warnings": [],
  "data_quality_issues": [],
  "analysis_request": {
    "language": "ja",
    "goal": "Analyze Mahjong Soul statistics trends and identify improvement priorities.",
    "focus": [
      "average placement trend",
      "win rate vs deal-in rate",
      "call rate changes",
      "riichi rate changes",
      "third/fourth place reduction",
      "rank point progress"
    ]
  }
}
```

## 12. Security design details

### 12.1 Body size

Set a low JSON body size limit. Snapshot payloads should be tiny. A 32KB or 64KB limit is enough for MVP.

### 12.2 Payload scanning

Reject:

- top-level keys named `image`, `screenshot`, `file`, `blob`, `base64`, `dataUrl`
- string values containing `data:image/`
- string values longer than allowed field limits

### 12.3 Logging

Do not log:

- Access JWT
- request bodies
- notes
- export content
- player IDs

Safe logs:

- request method/path
- status code
- operation type
- anonymous snapshot id

## 13. Legal and branding design

UI footer:

```txt
TileLog Lens is an unofficial personal statistics tracker. It is not affiliated with Yostar or Mahjong Soul / 雀魂. It is designed only for post-game personal record keeping and does not provide real-time gameplay assistance.
```

README Japanese disclaimer:

```txt
本アプリは「雀魂」の非公式・個人用戦績記録ツールです。対局中の判断補助、ゲームクライアントの改変、通信解析、自動操作、リアルタイム支援を目的としません。スクリーンショット画像はブラウザ内でのみ処理し、サーバーには保存しません。保存されるのは、ユーザーが確認した戦績数値のみです。
```

Avoid:

- app names beginning with “雀魂”
- official logo use
- character images
- official-like color/mark imitation
- wording like “official,” “authorized,” or “certified”

## 14. Failure states

### 14.1 Duplicate observation time

Show:

> A snapshot for this mode and observation time already exists. Edit the existing snapshot or choose a different HH:mm timestamp.

### 14.2 Duplicate image hash

Show warning:

> This image appears to have been imported before. You can still save if you are intentionally correcting data.

### 14.3 Inconsistent rates

Show warning:

> Placement rates do not sum to approximately 100%. Please check OCR/manual input.

### 14.4 Missing Access token

API returns:

```json
{ "error": "forbidden" }
```

Do not include sensitive details.

## 15. Reference documentation

- Cloudflare Access One-time PIN: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare D1 with Hono: https://developers.cloudflare.com/d1/examples/d1-and-hono/
- Hono on Cloudflare Workers: https://hono.dev/docs/getting-started/cloudflare-workers
