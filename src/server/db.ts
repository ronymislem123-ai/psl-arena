import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function dataDir(): string {
  const dir = resolve(process.cwd(), process.env.PSL_ARENA_DATA_DIR ?? "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Id of the pre-authentication single user; its data is adopted by the first account. */
export const LEGACY_USER_ID = "local";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  password_salt TEXT,
  last_login_at TEXT,
  totp_secret_enc TEXT,
  totp_pending_enc TEXT,
  totp_enabled_at TEXT,
  totp_last_step INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 1,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS face_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
  image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  image_width INTEGER NOT NULL,
  image_height INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  overall REAL,
  harmony REAL,
  proportion REAL,
  symmetry REAL,
  confidence REAL NOT NULL,
  coverage_fraction REAL NOT NULL,
  quality_level TEXT NOT NULL,
  analyzable INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_profile ON analysis_sessions(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_user ON analysis_sessions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS landmarks (
  analysis_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  landmark_id TEXT NOT NULL,
  raw_x REAL NOT NULL, raw_y REAL NOT NULL,
  aligned_x REAL NOT NULL, aligned_y REAL NOT NULL,
  source TEXT NOT NULL,
  precision TEXT NOT NULL,
  confidence REAL NOT NULL,
  mesh_index INTEGER,
  PRIMARY KEY (analysis_id, landmark_id)
);
CREATE TABLE IF NOT EXISTS ratio_measurements (
  analysis_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  ratio_id TEXT NOT NULL,
  value REAL,
  availability TEXT NOT NULL,
  confidence REAL NOT NULL,
  in_t1 INTEGER,
  tier TEXT,
  tier_points REAL,
  index_score REAL,
  deviation REAL,
  value_sigma REAL,
  PRIMARY KEY (analysis_id, ratio_id)
);
CREATE TABLE IF NOT EXISTS category_scores (
  analysis_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  index_score REAL,
  confidence REAL NOT NULL,
  available INTEGER NOT NULL,
  total INTEGER NOT NULL,
  PRIMARY KEY (analysis_id, category_id)
);
CREATE TABLE IF NOT EXISTS battle_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_a_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  analysis_b_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  profile_a_id TEXT NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
  profile_b_id TEXT NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  result_json TEXT NOT NULL,
  verdict TEXT NOT NULL,
  overall_a REAL,
  overall_b REAL,
  diff REAL,
  margin REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_battle_created ON battle_sessions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS side_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
  image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  image_width INTEGER NOT NULL,
  image_height INTEGER NOT NULL,
  facing TEXT NOT NULL,
  points_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  score REAL,
  score_sigma REAL,
  scored_count INTEGER NOT NULL,
  analyzable INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_side_profile ON side_analyses(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_side_user ON side_analyses(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS side_measurements (
  analysis_id TEXT NOT NULL REFERENCES side_analyses(id) ON DELETE CASCADE,
  measurement_id TEXT NOT NULL,
  value REAL,
  in_range INTEGER,
  deviation REAL,
  index_score REAL,
  value_sigma REAL,
  PRIMARY KEY (analysis_id, measurement_id)
);
CREATE TABLE IF NOT EXISTS psl_scales (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  range_min REAL NOT NULL,
  range_max REAL NOT NULL,
  tiers_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scales_user ON psl_scales(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS psl_ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
  analysis_id TEXT REFERENCES analysis_sessions(id) ON DELETE SET NULL,
  side_analysis_id TEXT REFERENCES side_analyses(id) ON DELETE SET NULL,
  scale_id TEXT,
  scale_snapshot_json TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  result_json TEXT NOT NULL,
  psl_score REAL,
  tier_id TEXT,
  tier_name TEXT,
  coverage REAL NOT NULL,
  valid INTEGER NOT NULL,
  provisional INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON psl_ratings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_profile ON psl_ratings(profile_id, created_at DESC);
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  config_json TEXT NOT NULL,
  scale_snapshot_json TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  state_json TEXT,
  results_json TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tournaments_user ON tournaments(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS tournament_participants (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES face_profiles(id) ON DELETE SET NULL,
  rating_id TEXT REFERENCES psl_ratings(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  rating_snapshot_json TEXT NOT NULL,
  seed INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tparticipants ON tournament_participants(tournament_id, sort_order);
CREATE TABLE IF NOT EXISTS tournament_versions (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  note TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tversions ON tournament_versions(tournament_id, version DESC);
CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const SCHEMA_VERSION = "6";

type DB = Database.Database;
declare global {
  var __pslArenaDb: DB | undefined;
}

/** Brings an older database (v1 single local user, v4 without side-view tables) up to the current schema. */
function migrate(db: DB) {
  // v1 → v4: an existing users table gets missing account/TOTP columns before the
  // unique e-mail index in SCHEMA is created. A fresh database skips this (no table yet).
  // v4 → v5 adds the side-view tables, v5 → v6 the PSL scale/rating/tournament tables: all handled by the SCHEMA exec below.
  const cols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
  if (cols.length > 0) {
    const wanted = [
      ["email", "TEXT"], ["password_hash", "TEXT"], ["password_salt", "TEXT"], ["last_login_at", "TEXT"],
      ["totp_secret_enc", "TEXT"], ["totp_pending_enc", "TEXT"], ["totp_enabled_at", "TEXT"], ["totp_last_step", "INTEGER"],
    ] as const;
    for (const [col, type] of wanted) {
      if (!cols.includes(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    }
  }
  db.exec(SCHEMA); // creates missing tables/indexes idempotently
  db.prepare("INSERT INTO schema_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(SCHEMA_VERSION);
}

export function getDb(): DB {
  if (globalThis.__pslArenaDb) return globalThis.__pslArenaDb;
  const file = join(dataDir(), "psl-arena.sqlite");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalThis.__pslArenaDb = db;
  return db;
}

/** Test helper: close and forget the cached connection (e.g. when the data dir changes). */
export function closeDb() {
  globalThis.__pslArenaDb?.close();
  globalThis.__pslArenaDb = undefined;
}

export function newId(prefix: string): string {
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
