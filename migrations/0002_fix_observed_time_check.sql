CREATE TABLE IF NOT EXISTS stat_snapshots_new (
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

INSERT INTO stat_snapshots_new (
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
)
SELECT
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
FROM stat_snapshots;

DROP TABLE stat_snapshots;

ALTER TABLE stat_snapshots_new RENAME TO stat_snapshots;

CREATE INDEX IF NOT EXISTS idx_stat_snapshots_observed_at
  ON stat_snapshots(observed_at_utc);

CREATE INDEX IF NOT EXISTS idx_stat_snapshots_mode_observed
  ON stat_snapshots(game_mode, observed_at_utc);

CREATE INDEX IF NOT EXISTS idx_stat_snapshots_source_hash
  ON stat_snapshots(source_image_sha256);
