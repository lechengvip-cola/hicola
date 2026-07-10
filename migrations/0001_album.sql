CREATE TABLE IF NOT EXISTS album_events (
  id TEXT PRIMARY KEY,
  title TEXT,
  event_date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  cover_media_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS album_media (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  batch_id TEXT,
  original_key TEXT NOT NULL,
  preview_key TEXT,
  thumbnail_key TEXT,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  captured_at TEXT,
  date_source TEXT,
  width INTEGER,
  height INTEGER,
  duration REAL,
  sort_order INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  allow_download INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS upload_batches (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  total_files INTEGER DEFAULT 0,
  completed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  duplicate_files INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS upload_errors (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  filename TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS album_security_settings (
  id INTEGER PRIMARY KEY,
  family_password_hash TEXT,
  family_password_salt TEXT,
  family_password_iterations INTEGER,
  family_password_algorithm TEXT,
  family_password_version INTEGER NOT NULL DEFAULT 1,
  family_access_enabled INTEGER NOT NULL DEFAULT 0,
  family_session_days INTEGER NOT NULL DEFAULT 30,
  password_updated_at TEXT,
  password_updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL,
  password_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_active_at TEXT,
  revoked_at TEXT,
  ip_hash TEXT,
  user_agent_summary TEXT
);

CREATE TABLE IF NOT EXISTS album_login_attempts (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_album_events_event_date ON album_events(event_date);
CREATE INDEX IF NOT EXISTS idx_album_events_status ON album_events(status);
CREATE INDEX IF NOT EXISTS idx_album_events_year ON album_events(year);
CREATE INDEX IF NOT EXISTS idx_album_media_event_id ON album_media(event_id);
CREATE INDEX IF NOT EXISTS idx_album_media_batch_id ON album_media(batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_album_media_sha256_unique ON album_media(sha256) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_album_media_captured_at ON album_media(captured_at);
CREATE INDEX IF NOT EXISTS idx_family_sessions_token_hash ON family_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_family_sessions_expires_at ON family_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_album_login_attempts_ip ON album_login_attempts(ip_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_album_login_attempts_ip_unique ON album_login_attempts(ip_hash);

INSERT OR IGNORE INTO album_security_settings (
  id,
  family_password_version,
  family_access_enabled,
  family_session_days,
  created_at,
  updated_at
) VALUES (
  1,
  1,
  0,
  30,
  datetime('now'),
  datetime('now')
);
