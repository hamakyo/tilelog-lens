CREATE TABLE IF NOT EXISTS snapshot_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  changed_fields TEXT NOT NULL CHECK (json_valid(changed_fields)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES stat_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshot_revisions_snapshot_created
  ON snapshot_revisions(snapshot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS import_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('saved', 'failed')),
  source_image_sha256 TEXT,
  file_name TEXT,
  image_width INTEGER CHECK (image_width IS NULL OR image_width > 0),
  image_height INTEGER CHECK (image_height IS NULL OR image_height > 0),
  parser_version TEXT,
  extracted_field_count INTEGER CHECK (extracted_field_count IS NULL OR extracted_field_count >= 0),
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES stat_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_events_created
  ON import_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_events_snapshot
  ON import_events(snapshot_id);
