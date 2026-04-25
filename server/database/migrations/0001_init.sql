-- Film Logger MVP — initial schema
-- Conventions:
--   * Timestamps stored as ISO 8601 TEXT in UTC.
--   * `client_id` is a UUID generated on-device for offline-created rows;
--     server-assigned `id` is the canonical PK once the row is synced.
--   * Soft-delete via `deleted_at` so last-write-wins sync stays coherent.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  recovery_code_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  name TEXT NOT NULL,
  format TEXT NOT NULL,                  -- '135' | '120' | '4x5' | '8x10' | 'other'
  has_interchangeable_back INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cameras_user ON cameras(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cameras_client ON cameras(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  name TEXT NOT NULL,
  focal_length_mm INTEGER NOT NULL,
  max_aperture REAL,
  min_aperture REAL,
  mount TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lenses_user ON lenses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lenses_client ON lenses(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS camera_lenses (
  camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  lens_id INTEGER NOT NULL REFERENCES lenses(id) ON DELETE CASCADE,
  PRIMARY KEY (camera_id, lens_id)
);

CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_labs_user ON labs(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_labs_client ON labs(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  camera_id INTEGER NOT NULL REFERENCES cameras(id),
  film_stock TEXT NOT NULL,
  iso INTEGER NOT NULL,
  box_speed INTEGER,
  frame_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'loaded',  -- 'loaded' | 'finished' | 'archived'
  loaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rolls_user_status ON rolls(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rolls_camera ON rolls(camera_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rolls_client ON rolls(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS developments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  roll_id INTEGER NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  lab_id INTEGER REFERENCES labs(id),    -- NULL = self-developed
  dropped_off_at TEXT,
  expected_ready_at TEXT,
  delivered_at TEXT,
  status TEXT NOT NULL,                  -- 'dropped_off' | 'in_progress' | 'delivered' | 'cancelled'
  process TEXT,                          -- 'C-41' | 'E-6' | 'B&W' | 'ECN-2' | etc.
  push_pull_stops INTEGER NOT NULL DEFAULT 0,
  scans_requested INTEGER NOT NULL DEFAULT 0,
  scan_resolution TEXT,
  scan_format TEXT,
  cost REAL,
  currency TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_developments_roll ON developments(roll_id);
CREATE INDEX IF NOT EXISTS idx_developments_user_status ON developments(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_developments_client ON developments(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS shots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  roll_id INTEGER NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  frame_number INTEGER,
  taken_at TEXT NOT NULL,
  lens_id INTEGER REFERENCES lenses(id),
  aperture REAL,
  shutter_speed TEXT,
  location_text TEXT,
  latitude REAL,
  longitude REAL,
  location_accuracy_m REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shots_roll ON shots(roll_id);
CREATE INDEX IF NOT EXISTS idx_shots_user_taken ON shots(user_id, taken_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shots_client ON shots(user_id, client_id) WHERE client_id IS NOT NULL;
