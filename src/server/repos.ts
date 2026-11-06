/**
 * Data access. Every function is scoped to a user id; rows of other users are
 * invisible (queries filter by user_id, never by id alone).
 */
import type { AnalysisInput, AnalysisResult, BattleResult } from "@/engine/types";
import type { SidePoints, SideViewResult } from "@/engine/side-view";
import { getDb, newId } from "./db";
import { deleteAllImageFiles, deleteImageFile } from "./images";
import { deleteAllPsl, exportPsl, pslStats } from "./repos-psl";

export interface ProfileRow {
  id: string;
  label: string;
  imageId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  analysisCount: number;
  latestAnalysisId: string | null;
  latestOverall: number | null;
  latestAt: string | null;
  sideAnalysisCount: number;
  latestSideId: string | null;
  latestSideScore: number | null;
}

export interface AnalysisSummary {
  id: string;
  profileId: string;
  profileLabel: string;
  imageId: string | null;
  createdAt: string;
  engineVersion: string;
  imageWidth: number;
  imageHeight: number;
  overall: number | null;
  harmony: number | null;
  proportion: number | null;
  symmetry: number | null;
  confidence: number;
  coverageFraction: number;
  qualityLevel: string;
  analyzable: boolean;
}

export interface AnalysisRecord extends AnalysisSummary {
  input: AnalysisInput;
  result: AnalysisResult;
}

export interface BattleSummary {
  id: string;
  createdAt: string;
  engineVersion: string;
  analysisAId: string;
  analysisBId: string;
  profileAId: string;
  profileBId: string;
  labelA: string;
  labelB: string;
  imageAId: string | null;
  imageBId: string | null;
  verdict: string;
  overallA: number | null;
  overallB: number | null;
  diff: number | null;
  margin: number;
}

export interface BattleRecord extends BattleSummary {
  result: BattleResult;
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- profiles
const PROFILE_SELECT = `
SELECT p.id, p.label, p.image_id AS imageId, p.note, p.created_at AS createdAt, p.updated_at AS updatedAt,
  (SELECT COUNT(*) FROM analysis_sessions a WHERE a.profile_id = p.id) AS analysisCount,
  (SELECT a.id FROM analysis_sessions a WHERE a.profile_id = p.id ORDER BY a.created_at DESC LIMIT 1) AS latestAnalysisId,
  (SELECT a.overall FROM analysis_sessions a WHERE a.profile_id = p.id ORDER BY a.created_at DESC LIMIT 1) AS latestOverall,
  (SELECT a.created_at FROM analysis_sessions a WHERE a.profile_id = p.id ORDER BY a.created_at DESC LIMIT 1) AS latestAt,
  (SELECT COUNT(*) FROM side_analyses s WHERE s.profile_id = p.id) AS sideAnalysisCount,
  (SELECT s.id FROM side_analyses s WHERE s.profile_id = p.id ORDER BY s.created_at DESC LIMIT 1) AS latestSideId,
  (SELECT s.score FROM side_analyses s WHERE s.profile_id = p.id ORDER BY s.created_at DESC LIMIT 1) AS latestSideScore
FROM face_profiles p WHERE p.user_id = ?`;

export function listProfiles(userId: string): ProfileRow[] {
  return getDb().prepare(`${PROFILE_SELECT} ORDER BY p.updated_at DESC`).all(userId) as ProfileRow[];
}

export function getProfile(userId: string, id: string): ProfileRow | null {
  return (getDb().prepare(`${PROFILE_SELECT} AND p.id = ?`).get(userId, id) as ProfileRow | undefined) ?? null;
}

export function createProfile(userId: string, label: string, note?: string, imageId?: string | null): ProfileRow {
  const id = newId("prof");
  const t = now();
  getDb().prepare("INSERT INTO face_profiles (id, user_id, label, image_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, userId, label, imageId ?? null, note ?? null, t, t);
  return getProfile(userId, id)!;
}

export function updateProfile(userId: string, id: string, patch: { label?: string; note?: string; imageId?: string | null }): ProfileRow | null {
  const p = getProfile(userId, id);
  if (!p) return null;
  getDb()
    .prepare("UPDATE face_profiles SET label = ?, note = ?, image_id = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(patch.label ?? p.label, patch.note ?? p.note, patch.imageId === undefined ? p.imageId : patch.imageId, now(), id, userId);
  return getProfile(userId, id);
}

export function deleteProfile(userId: string, id: string): boolean {
  const db = getDb();
  const p = getProfile(userId, id);
  if (!p) return false;
  const imgs = db
    .prepare("SELECT DISTINCT image_id AS id FROM analysis_sessions WHERE profile_id = ? AND user_id = ? AND image_id IS NOT NULL UNION SELECT DISTINCT image_id AS id FROM side_analyses WHERE profile_id = ? AND user_id = ? AND image_id IS NOT NULL")
    .all(id, userId, id, userId) as { id: string }[];
  db.prepare("DELETE FROM face_profiles WHERE id = ? AND user_id = ?").run(id, userId);
  if (p.imageId) deleteImageFile(p.imageId);
  for (const i of imgs) deleteImageFile(i.id);
  return true;
}

// ---------------------------------------------------------------- analyses
const ANALYSIS_SELECT = `
SELECT a.id, a.profile_id AS profileId, p.label AS profileLabel, a.image_id AS imageId, a.created_at AS createdAt, a.engine_version AS engineVersion,
  a.image_width AS imageWidth, a.image_height AS imageHeight, a.overall, a.harmony, a.proportion, a.symmetry, a.confidence,
  a.coverage_fraction AS coverageFraction, a.quality_level AS qualityLevel, a.analyzable
FROM analysis_sessions a JOIN face_profiles p ON p.id = a.profile_id WHERE a.user_id = ?`;

function mapAnalysisSummary(r: Record<string, unknown>): AnalysisSummary {
  return { ...(r as unknown as AnalysisSummary), analyzable: !!r.analyzable };
}

export function listAnalyses(userId: string, opts: { profileId?: string; limit?: number } = {}): AnalysisSummary[] {
  const db = getDb();
  const limit = opts.limit ?? 100;
  const rows = opts.profileId
    ? db.prepare(`${ANALYSIS_SELECT} AND a.profile_id = ? ORDER BY a.created_at DESC LIMIT ?`).all(userId, opts.profileId, limit)
    : db.prepare(`${ANALYSIS_SELECT} ORDER BY a.created_at DESC LIMIT ?`).all(userId, limit);
  return (rows as Record<string, unknown>[]).map(mapAnalysisSummary);
}

export function getAnalysis(userId: string, id: string): AnalysisRecord | null {
  const row = getDb().prepare(`${ANALYSIS_SELECT} AND a.id = ?`).get(userId, id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const full = getDb().prepare("SELECT input_json, result_json FROM analysis_sessions WHERE id = ? AND user_id = ?").get(id, userId) as { input_json: string; result_json: string };
  return { ...mapAnalysisSummary(row), input: JSON.parse(full.input_json) as AnalysisInput, result: JSON.parse(full.result_json) as AnalysisResult };
}

export function insertAnalysis(args: { userId: string; profileId: string; imageId: string | null; input: AnalysisInput; result: AnalysisResult }): AnalysisRecord {
  const db = getDb();
  const id = newId("ana");
  const t = now();
  const { result, input, userId } = args;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO analysis_sessions (id, user_id, profile_id, image_id, engine_version, created_at, image_width, image_height, config_json, input_json, result_json,
        overall, harmony, proportion, symmetry, confidence, coverage_fraction, quality_level, analyzable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, userId, args.profileId, args.imageId, result.engineVersion, t, input.rawQuality.imageWidth, input.rawQuality.imageHeight,
      JSON.stringify(result.config), JSON.stringify(input), JSON.stringify(result),
      result.scores.overall, result.scores.harmony, result.scores.proportion, result.scores.symmetry, result.scores.confidence,
      result.coverage.fraction, result.quality.level, result.quality.analyzable ? 1 : 0,
    );
    const lm = db.prepare("INSERT INTO landmarks (analysis_id, landmark_id, raw_x, raw_y, aligned_x, aligned_y, source, precision, confidence, mesh_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const l of result.landmarks) lm.run(id, l.id, l.raw.x, l.raw.y, l.aligned.x, l.aligned.y, l.source, l.precision, l.confidence, l.meshIndex ?? null);
    const rm = db.prepare("INSERT INTO ratio_measurements (analysis_id, ratio_id, value, availability, confidence, in_t1, tier, tier_points, index_score, deviation, value_sigma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const r of result.ratios) rm.run(id, r.id, r.value, r.availability, r.confidence, r.inT1 === null ? null : r.inT1 ? 1 : 0, r.tier, r.tierPoints, r.index, r.deviation, r.valueSigma ?? null);
    const cs = db.prepare("INSERT INTO category_scores (analysis_id, category_id, index_score, confidence, available, total) VALUES (?, ?, ?, ?, ?, ?)");
    for (const c of result.categories) cs.run(id, c.id, c.index, c.confidence, c.coverage.available, c.coverage.total);
    db.prepare("UPDATE face_profiles SET updated_at = ?, image_id = COALESCE(image_id, ?) WHERE id = ? AND user_id = ?").run(t, args.imageId, args.profileId, userId);
  });
  tx();
  return getAnalysis(userId, id)!;
}

/** Removes an image file once no analysis, side analysis or profile references it any more. */
function dropImageIfOrphaned(imageId: string) {
  const stillUsed = getDb()
    .prepare("SELECT 1 FROM analysis_sessions WHERE image_id = ? UNION SELECT 1 FROM side_analyses WHERE image_id = ? UNION SELECT 1 FROM face_profiles WHERE image_id = ? UNION SELECT 1 FROM tournament_participants WHERE image_id = ? UNION SELECT 1 FROM psl_scales WHERE tiers_json LIKE '%' || ? || '%' LIMIT 1")
    .get(imageId, imageId, imageId, imageId, imageId);
  if (!stillUsed) deleteImageFile(imageId);
}

export function deleteAnalysis(userId: string, id: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT image_id FROM analysis_sessions WHERE id = ? AND user_id = ?").get(id, userId) as { image_id: string | null } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM analysis_sessions WHERE id = ? AND user_id = ?").run(id, userId);
  if (row.image_id) dropImageIfOrphaned(row.image_id);
  return true;
}

// ---------------------------------------------------------------- side-view analyses
export interface SideAnalysisSummary {
  id: string;
  profileId: string;
  profileLabel: string;
  imageId: string | null;
  createdAt: string;
  engineVersion: string;
  imageWidth: number;
  imageHeight: number;
  facing: "left" | "right";
  score: number | null;
  scoreSigma: number | null;
  scoredCount: number;
  analyzable: boolean;
}

export interface SideAnalysisRecord extends SideAnalysisSummary {
  points: SidePoints;
  result: SideViewResult;
}

const SIDE_SELECT = `
SELECT s.id, s.profile_id AS profileId, p.label AS profileLabel, s.image_id AS imageId, s.created_at AS createdAt, s.engine_version AS engineVersion,
  s.image_width AS imageWidth, s.image_height AS imageHeight, s.facing, s.score, s.score_sigma AS scoreSigma, s.scored_count AS scoredCount, s.analyzable
FROM side_analyses s JOIN face_profiles p ON p.id = s.profile_id WHERE s.user_id = ?`;

function mapSideSummary(r: Record<string, unknown>): SideAnalysisSummary {
  return { ...(r as unknown as SideAnalysisSummary), analyzable: !!r.analyzable };
}

export function listSideAnalyses(userId: string, opts: { profileId?: string; limit?: number } = {}): SideAnalysisSummary[] {
  const db = getDb();
  const limit = opts.limit ?? 100;
  const rows = opts.profileId
    ? db.prepare(`${SIDE_SELECT} AND s.profile_id = ? ORDER BY s.created_at DESC LIMIT ?`).all(userId, opts.profileId, limit)
    : db.prepare(`${SIDE_SELECT} ORDER BY s.created_at DESC LIMIT ?`).all(userId, limit);
  return (rows as Record<string, unknown>[]).map(mapSideSummary);
}

export function getSideAnalysis(userId: string, id: string): SideAnalysisRecord | null {
  const row = getDb().prepare(`${SIDE_SELECT} AND s.id = ?`).get(userId, id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const full = getDb().prepare("SELECT points_json, result_json FROM side_analyses WHERE id = ? AND user_id = ?").get(id, userId) as { points_json: string; result_json: string };
  return { ...mapSideSummary(row), points: JSON.parse(full.points_json) as SidePoints, result: JSON.parse(full.result_json) as SideViewResult };
}

export function insertSideAnalysis(args: { userId: string; profileId: string; imageId: string | null; imageWidth: number; imageHeight: number; points: SidePoints; result: SideViewResult }): SideAnalysisRecord {
  const db = getDb();
  const id = newId("side");
  const t = now();
  const { result, userId } = args;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO side_analyses (id, user_id, profile_id, image_id, engine_version, created_at, image_width, image_height, facing, points_json, result_json, score, score_sigma, scored_count, analyzable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, args.profileId, args.imageId, result.engineVersion, t, args.imageWidth, args.imageHeight, result.facing, JSON.stringify(args.points), JSON.stringify(result), result.score, result.scoreSigma, result.scoredCount, result.analyzable ? 1 : 0);
    const sm = db.prepare("INSERT INTO side_measurements (analysis_id, measurement_id, value, in_range, deviation, index_score, value_sigma) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const m of result.measurements) sm.run(id, m.id, m.value, m.inRange === null ? null : m.inRange ? 1 : 0, m.deviation, m.index, m.valueSigma);
    db.prepare("UPDATE face_profiles SET updated_at = ? WHERE id = ? AND user_id = ?").run(t, args.profileId, userId);
  });
  tx();
  return getSideAnalysis(userId, id)!;
}

export function deleteSideAnalysis(userId: string, id: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT image_id FROM side_analyses WHERE id = ? AND user_id = ?").get(id, userId) as { image_id: string | null } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM side_analyses WHERE id = ? AND user_id = ?").run(id, userId);
  if (row.image_id) dropImageIfOrphaned(row.image_id);
  return true;
}

// ---------------------------------------------------------------- battles
const BATTLE_SELECT = `
SELECT b.id, b.created_at AS createdAt, b.engine_version AS engineVersion, b.analysis_a_id AS analysisAId, b.analysis_b_id AS analysisBId,
  b.profile_a_id AS profileAId, b.profile_b_id AS profileBId, pa.label AS labelA, pb.label AS labelB,
  aa.image_id AS imageAId, ab.image_id AS imageBId,
  b.verdict, b.overall_a AS overallA, b.overall_b AS overallB, b.diff, b.margin
FROM battle_sessions b
JOIN face_profiles pa ON pa.id = b.profile_a_id
JOIN face_profiles pb ON pb.id = b.profile_b_id
JOIN analysis_sessions aa ON aa.id = b.analysis_a_id
JOIN analysis_sessions ab ON ab.id = b.analysis_b_id
WHERE b.user_id = ?`;

export function listBattles(userId: string, limit = 100): BattleSummary[] {
  return getDb().prepare(`${BATTLE_SELECT} ORDER BY b.created_at DESC LIMIT ?`).all(userId, limit) as BattleSummary[];
}

export function getBattle(userId: string, id: string): BattleRecord | null {
  const row = getDb().prepare(`${BATTLE_SELECT} AND b.id = ?`).get(userId, id) as BattleSummary | undefined;
  if (!row) return null;
  const full = getDb().prepare("SELECT result_json FROM battle_sessions WHERE id = ? AND user_id = ?").get(id, userId) as { result_json: string };
  return { ...row, result: JSON.parse(full.result_json) as BattleResult };
}

export function insertBattle(args: { userId: string; a: AnalysisRecord; b: AnalysisRecord; result: BattleResult }): BattleRecord {
  const id = newId("btl");
  getDb()
    .prepare(
      `INSERT INTO battle_sessions (id, user_id, analysis_a_id, analysis_b_id, profile_a_id, profile_b_id, engine_version, created_at, result_json, verdict, overall_a, overall_b, diff, margin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, args.userId, args.a.id, args.b.id, args.a.profileId, args.b.profileId, args.result.engineVersion, now(), JSON.stringify(args.result), args.result.verdict, args.result.overallA, args.result.overallB, args.result.diff, args.result.margin);
  return getBattle(args.userId, id)!;
}

export function deleteBattle(userId: string, id: string): boolean {
  return getDb().prepare("DELETE FROM battle_sessions WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

// ---------------------------------------------------------------- stats / settings / data
export function stats(userId: string) {
  const db = getDb();
  const c = (sql: string) => (db.prepare(sql).get(userId) as { n: number }).n;
  const avg = db.prepare("SELECT AVG(overall) AS v FROM analysis_sessions WHERE user_id = ? AND overall IS NOT NULL").get(userId) as { v: number | null };
  const best = db.prepare(`${ANALYSIS_SELECT} AND a.overall IS NOT NULL ORDER BY a.overall DESC LIMIT 1`).get(userId) as Record<string, unknown> | undefined;
  const verdicts = db.prepare("SELECT verdict, COUNT(*) AS n FROM battle_sessions WHERE user_id = ? GROUP BY verdict").all(userId) as { verdict: string; n: number }[];
  return {
    profiles: c("SELECT COUNT(*) AS n FROM face_profiles WHERE user_id = ?"),
    analyses: c("SELECT COUNT(*) AS n FROM analysis_sessions WHERE user_id = ?"),
    battles: c("SELECT COUNT(*) AS n FROM battle_sessions WHERE user_id = ?"),
    sideAnalyses: c("SELECT COUNT(*) AS n FROM side_analyses WHERE user_id = ?"),
    images: c("SELECT COUNT(*) AS n FROM images WHERE user_id = ?"),
    ...pslStats(userId),
    averageOverall: avg.v,
    bestAnalysis: best ? mapAnalysisSummary(best) : null,
    verdicts: Object.fromEntries(verdicts.map((v) => [v.verdict, v.n])),
  };
}

export function getSettings(userId: string): Record<string, unknown> {
  const rows = getDb().prepare("SELECT key, value_json FROM settings WHERE user_id = ?").all(userId) as { key: string; value_json: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value_json)]));
}

export function setSettings(userId: string, patch: Record<string, unknown>) {
  const stmt = getDb().prepare("INSERT INTO settings (user_id, key, value_json) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value_json = excluded.value_json");
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) stmt.run(userId, k, JSON.stringify(v));
  return getSettings(userId);
}

export function deleteAllData(userId: string) {
  const db = getDb();
  deleteAllImageFiles(userId);
  const tx = db.transaction(() => {
    deleteAllPsl(userId);
    db.prepare("DELETE FROM battle_sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM side_analyses WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM analysis_sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM face_profiles WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM images WHERE user_id = ?").run(userId);
  });
  tx();
}

export function exportAll(userId: string) {
  return {
    exportedAt: now(),
    profiles: listProfiles(userId),
    analyses: listAnalyses(userId, { limit: 10_000 }).map((a) => getAnalysis(userId, a.id)),
    battles: listBattles(userId, 10_000).map((b) => getBattle(userId, b.id)),
    sideAnalyses: listSideAnalyses(userId, { limit: 10_000 }).map((a) => getSideAnalysis(userId, a.id)),
    ...exportPsl(userId),
    settings: getSettings(userId),
  };
}
