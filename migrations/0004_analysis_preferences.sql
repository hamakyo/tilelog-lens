CREATE TABLE IF NOT EXISTS analysis_saved_views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  game_mode TEXT NOT NULL CHECK (game_mode IN ('east', 'south', 'three_player', 'other')),
  filters_json TEXT NOT NULL CHECK (json_valid(filters_json)),
  tab TEXT NOT NULL CHECK (tab IN ('overview', 'riichi', 'improvement', 'detail')),
  chart_metrics_json TEXT NOT NULL CHECK (json_valid(chart_metrics_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_saved_views_updated
  ON analysis_saved_views(updated_at DESC);

CREATE TABLE IF NOT EXISTS analysis_experiments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  game_mode TEXT NOT NULL CHECK (game_mode IN ('east', 'south', 'three_player', 'other')),
  metric TEXT NOT NULL CHECK (metric IN ('avg_place', 'win_rate', 'deal_in_rate', 'fourth_rate', 'riichi_rate', 'rank_points')),
  target_value REAL NOT NULL,
  target_matches INTEGER NOT NULL CHECK (target_matches BETWEEN 1 AND 10000),
  baseline_snapshot_id INTEGER,
  baseline_value REAL NOT NULL,
  baseline_matches INTEGER NOT NULL CHECK (baseline_matches >= 0),
  baseline_observed_at_utc TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (baseline_snapshot_id) REFERENCES stat_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_experiments_updated
  ON analysis_experiments(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_experiments_status
  ON analysis_experiments(status, updated_at DESC);
