import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function dataDir(): string {
  const dir = resolve(process.cwd(), process.env.PSL_ARENA_DATA_DIR ?? "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
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
CREATE INDEX IF NOT EXISTS idx_battle_created ON battle_sessions(created_at DESC);
CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
`;

export const LOCAL_USER_ID = "local";

type DB = Database.Database;
declare global {
  var __pslArenaDb: DB | undefined;
}

export function getDb(): DB {
  if (globalThis.__pslArenaDb) return globalThis.__pslArenaDb;
  const file = join(dataDir(), "psl-arena.sqlite");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO users (id, name, created_at) VALUES (?, ?, ?)").run(LOCAL_USER_ID, "Local user", new Date().toISOString());
  globalThis.__pslArenaDb = db;
  return db;
}

export function newId(prefix: string): string {
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
