/**
 * Data access for PSL scales, ratings and tournaments. Every function is scoped
 * to a user id. The built-in standard scale is not stored; it is served from code.
 */
import { BUILTIN_SCALE_ID, buildStandardScale, type PslScale, type PslScaleSnapshot, type PslTier } from "@/engine/psl/scale";
import type { RatingResult } from "@/engine/psl/rating";
import type { TournamentConfig, TournamentFormat, TournamentResults, TournamentState, TournamentStatus } from "@/engine/tournament/types";
import { getDb, newId } from "./db";
import { deleteImageFile } from "./images";

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- scales
export interface ScaleSummary {
  id: string;
  name: string;
  description: string;
  rangeMin: number;
  rangeMax: number;
  tierCount: number;
  imageCount: number;
  version: number;
  builtIn: boolean;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScaleInput {
  name: string;
  description: string;
  rangeMin: number;
  rangeMax: number;
  tiers: PslTier[];
  isTemplate?: boolean;
}

function rowToScale(r: Record<string, unknown>): PslScale & { isTemplate: boolean } {
  return {
    id: r.id as string, name: r.name as string, description: r.description as string, rangeMin: r.range_min as number, rangeMax: r.range_max as number,
    tiers: JSON.parse(r.tiers_json as string) as PslTier[], version: r.version as number, builtIn: false, createdAt: r.created_at as string, updatedAt: r.updated_at as string, isTemplate: !!r.is_template,
  };
}

export function builtInScale(): PslScale {
  return buildStandardScale();
}

export function listScales(userId: string): ScaleSummary[] {
  const b = builtInScale();
  const rows = getDb().prepare("SELECT * FROM psl_scales WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as Record<string, unknown>[];
  const own = rows.map(rowToScale).map((s) => ({ id: s.id, name: s.name, description: s.description, rangeMin: s.rangeMin, rangeMax: s.rangeMax, tierCount: s.tiers.length, imageCount: s.tiers.reduce((n, t) => n + t.images.length, 0), version: s.version, builtIn: false, isTemplate: s.isTemplate, createdAt: s.createdAt, updatedAt: s.updatedAt }));
  return [{ id: b.id, name: b.name, description: b.description, rangeMin: b.rangeMin, rangeMax: b.rangeMax, tierCount: b.tiers.length, imageCount: 0, version: b.version, builtIn: true, isTemplate: false, createdAt: b.createdAt, updatedAt: b.updatedAt }, ...own];
}

export function getScale(userId: string, id: string): PslScale | null {
  if (id === BUILTIN_SCALE_ID) return builtInScale();
  const row = getDb().prepare("SELECT * FROM psl_scales WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
  return row ? rowToScale(row) : null;
}

export function createScale(userId: string, input: ScaleInput): PslScale {
  const id = newId("scale");
  const t = now();
  getDb().prepare("INSERT INTO psl_scales (id, user_id, name, description, range_min, range_max, tiers_json, version, is_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)").run(id, userId, input.name, input.description, input.rangeMin, input.rangeMax, JSON.stringify(input.tiers), input.isTemplate ? 1 : 0, t, t);
  return getScale(userId, id)!;
}

export function updateScale(userId: string, id: string, input: ScaleInput): PslScale | null {
  const cur = getScale(userId, id);
  if (!cur || cur.builtIn) return null;
  getDb().prepare("UPDATE psl_scales SET name = ?, description = ?, range_min = ?, range_max = ?, tiers_json = ?, version = version + 1, is_template = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(input.name, input.description, input.rangeMin, input.rangeMax, JSON.stringify(input.tiers), input.isTemplate ? 1 : 0, now(), id, userId);
  // reference images removed from the scale are deleted from the store
  const keep = new Set(input.tiers.flatMap((t) => t.images.map((i) => i.imageId)));
  for (const t of cur.tiers) for (const img of t.images) if (!keep.has(img.imageId)) deleteImageFile(img.imageId);
  return getScale(userId, id);
}

export function deleteScale(userId: string, id: string): boolean {
  const cur = getScale(userId, id);
  if (!cur || cur.builtIn) return false;
  getDb().prepare("DELETE FROM psl_scales WHERE id = ? AND user_id = ?").run(id, userId);
  for (const t of cur.tiers) for (const img of t.images) deleteImageFile(img.imageId);
  return true;
}

/** Verifies that an image id belongs to the user (for tier reference images). */
export function userOwnsImage(userId: string, imageId: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM images WHERE id = ? AND user_id = ?").get(imageId, userId);
}

// ---------------------------------------------------------------- ratings
export interface RatingSummary {
  id: string;
  profileId: string;
  profileLabel: string;
  profileImageId: string | null;
  analysisId: string | null;
  sideAnalysisId: string | null;
  scaleId: string | null;
  scaleName: string;
  rubricVersion: string;
  score: number | null;
  tierId: string | null;
  tierName: string | null;
  coverage: number;
  valid: boolean;
  provisional: boolean;
  createdAt: string;
}

export interface RatingRecord extends RatingSummary {
  result: RatingResult;
  scaleSnapshot: PslScaleSnapshot;
}

const RATING_SELECT = `
SELECT r.id, r.profile_id AS profileId, p.label AS profileLabel, p.image_id AS profileImageId, r.analysis_id AS analysisId, r.side_analysis_id AS sideAnalysisId, r.scale_id AS scaleId,
  json_extract(r.scale_snapshot_json, '$.name') AS scaleName, r.rubric_version AS rubricVersion, r.psl_score AS score, r.tier_id AS tierId, r.tier_name AS tierName,
  r.coverage, r.valid, r.provisional, r.created_at AS createdAt
FROM psl_ratings r JOIN face_profiles p ON p.id = r.profile_id WHERE r.user_id = ?`;

function mapRating(r: Record<string, unknown>): RatingSummary {
  return { ...(r as unknown as RatingSummary), valid: !!r.valid, provisional: !!r.provisional };
}

export function listRatings(userId: string, opts: { profileId?: string; limit?: number } = {}): RatingSummary[] {
  const limit = opts.limit ?? 100;
  const rows = opts.profileId
    ? getDb().prepare(`${RATING_SELECT} AND r.profile_id = ? ORDER BY r.created_at DESC LIMIT ?`).all(userId, opts.profileId, limit)
    : getDb().prepare(`${RATING_SELECT} ORDER BY r.created_at DESC LIMIT ?`).all(userId, limit);
  return (rows as Record<string, unknown>[]).map(mapRating);
}

/** Newest rating per profile (for leaderboards and tournament participant picking). */
export function latestRatings(userId: string): RatingSummary[] {
  const rows = getDb().prepare(`${RATING_SELECT} AND r.id IN (SELECT id FROM psl_ratings x WHERE x.user_id = ? AND x.created_at = (SELECT MAX(created_at) FROM psl_ratings y WHERE y.profile_id = x.profile_id)) ORDER BY r.psl_score DESC`).all(userId, userId) as Record<string, unknown>[];
  return rows.map(mapRating);
}

export function getRating(userId: string, id: string): RatingRecord | null {
  const row = getDb().prepare(`${RATING_SELECT} AND r.id = ?`).get(userId, id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const full = getDb().prepare("SELECT result_json, scale_snapshot_json FROM psl_ratings WHERE id = ? AND user_id = ?").get(id, userId) as { result_json: string; scale_snapshot_json: string };
  return { ...mapRating(row), result: JSON.parse(full.result_json) as RatingResult, scaleSnapshot: JSON.parse(full.scale_snapshot_json) as PslScaleSnapshot };
}

export function insertRating(args: { userId: string; profileId: string; analysisId: string | null; sideAnalysisId: string | null; scaleId: string | null; result: RatingResult }): RatingRecord {
  const id = newId("rate");
  const r = args.result;
  getDb()
    .prepare(
      `INSERT INTO psl_ratings (id, user_id, profile_id, analysis_id, side_analysis_id, scale_id, scale_snapshot_json, rubric_version, result_json, psl_score, tier_id, tier_name, coverage, valid, provisional, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, args.userId, args.profileId, args.analysisId, args.sideAnalysisId, args.scaleId, JSON.stringify(r.scale), r.rubricVersion, JSON.stringify(r), r.score, r.tier?.id ?? null, r.tier?.name ?? null, r.coverage, r.valid ? 1 : 0, r.provisional ? 1 : 0, now());
  return getRating(args.userId, id)!;
}

export function deleteRating(userId: string, id: string): boolean {
  return getDb().prepare("DELETE FROM psl_ratings WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

// ---------------------------------------------------------------- tournaments
export interface TournamentParticipantRow {
  id: string;
  profileId: string | null;
  ratingId: string | null;
  displayName: string;
  imageId: string | null;
  seed: number;
  sortOrder: number;
  rating: RatingResult;
}

export interface TournamentSummary {
  id: string;
  name: string;
  description: string;
  format: TournamentFormat;
  status: TournamentStatus;
  participantCount: number;
  version: number;
  rubricVersion: string;
  scaleName: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  winnerNames: string[];
}

export interface TournamentRecord extends TournamentSummary {
  config: TournamentConfig;
  scaleSnapshot: PslScaleSnapshot;
  state: TournamentState | null;
  results: TournamentResults | null;
  participants: TournamentParticipantRow[];
}

const T_SELECT = `
SELECT t.id, t.name, t.description, t.format, t.status, t.version, t.rubric_version AS rubricVersion, json_extract(t.scale_snapshot_json, '$.name') AS scaleName,
  t.created_at AS createdAt, t.updated_at AS updatedAt, t.completed_at AS completedAt,
  (SELECT COUNT(*) FROM tournament_participants x WHERE x.tournament_id = t.id) AS participantCount, t.results_json AS resultsJson
FROM tournaments t WHERE t.user_id = ?`;

function mapTournamentSummary(r: Record<string, unknown>, names: Map<string, string>): TournamentSummary {
  const results = r.resultsJson ? (JSON.parse(r.resultsJson as string) as TournamentResults) : null;
  const winnerNames = results ? results.officialWinnerIds.map((id) => names.get(id) ?? id) : [];
  return { id: r.id as string, name: r.name as string, description: r.description as string, format: r.format as TournamentFormat, status: r.status as TournamentStatus, participantCount: r.participantCount as number, version: r.version as number, rubricVersion: r.rubricVersion as string, scaleName: r.scaleName as string, createdAt: r.createdAt as string, updatedAt: r.updatedAt as string, completedAt: (r.completedAt as string | null) ?? null, winnerNames };
}

function participantNames(tournamentId: string): Map<string, string> {
  const rows = getDb().prepare("SELECT id, display_name FROM tournament_participants WHERE tournament_id = ?").all(tournamentId) as { id: string; display_name: string }[];
  return new Map(rows.map((r) => [r.id, r.display_name]));
}

export function listTournaments(userId: string, limit = 100): TournamentSummary[] {
  const rows = getDb().prepare(`${T_SELECT} ORDER BY t.updated_at DESC LIMIT ?`).all(userId, limit) as Record<string, unknown>[];
  return rows.map((r) => mapTournamentSummary(r, participantNames(r.id as string)));
}

export function listParticipants(tournamentId: string): TournamentParticipantRow[] {
  const rows = getDb().prepare("SELECT id, profile_id AS profileId, rating_id AS ratingId, display_name AS displayName, image_id AS imageId, seed, sort_order AS sortOrder, rating_snapshot_json FROM tournament_participants WHERE tournament_id = ? ORDER BY sort_order").all(tournamentId) as Record<string, unknown>[];
  return rows.map((r) => ({ id: r.id as string, profileId: (r.profileId as string | null) ?? null, ratingId: (r.ratingId as string | null) ?? null, displayName: r.displayName as string, imageId: (r.imageId as string | null) ?? null, seed: r.seed as number, sortOrder: r.sortOrder as number, rating: JSON.parse(r.rating_snapshot_json as string) as RatingResult }));
}

export function getTournament(userId: string, id: string): TournamentRecord | null {
  const row = getDb().prepare(`${T_SELECT} AND t.id = ?`).get(userId, id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const full = getDb().prepare("SELECT config_json, scale_snapshot_json, state_json, results_json FROM tournaments WHERE id = ? AND user_id = ?").get(id, userId) as { config_json: string; scale_snapshot_json: string; state_json: string | null; results_json: string | null };
  const participants = listParticipants(id);
  return {
    ...mapTournamentSummary(row, new Map(participants.map((p) => [p.id, p.displayName]))),
    config: JSON.parse(full.config_json) as TournamentConfig,
    scaleSnapshot: JSON.parse(full.scale_snapshot_json) as PslScaleSnapshot,
    state: full.state_json ? (JSON.parse(full.state_json) as TournamentState) : null,
    results: full.results_json ? (JSON.parse(full.results_json) as TournamentResults) : null,
    participants,
  };
}

export interface NewParticipant {
  profileId: string | null;
  ratingId: string | null;
  displayName: string;
  imageId: string | null;
  rating: RatingResult;
}

export function insertTournament(args: { userId: string; name: string; description: string; config: TournamentConfig; scaleSnapshot: PslScaleSnapshot; rubricVersion: string; participants: NewParticipant[] }): TournamentRecord {
  const db = getDb();
  const id = newId("tour");
  const t = now();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO tournaments (id, user_id, name, description, format, status, config_json, scale_snapshot_json, rubric_version, state_json, results_json, version, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, NULL, NULL, 1, ?, ?, NULL)").run(id, args.userId, args.name, args.description, args.config.format, JSON.stringify(args.config), JSON.stringify(args.scaleSnapshot), args.rubricVersion, t, t);
    replaceParticipantsTx(id, args.participants);
  });
  tx();
  return getTournament(args.userId, id)!;
}

function replaceParticipantsTx(tournamentId: string, participants: NewParticipant[]) {
  const db = getDb();
  db.prepare("DELETE FROM tournament_participants WHERE tournament_id = ?").run(tournamentId);
  const ins = db.prepare("INSERT INTO tournament_participants (id, tournament_id, profile_id, rating_id, display_name, image_id, rating_snapshot_json, seed, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  participants.forEach((p, i) => ins.run(newId("tp"), tournamentId, p.profileId, p.ratingId, p.displayName, p.imageId, JSON.stringify(p.rating), i + 1, i));
}

export function updateTournament(userId: string, id: string, patch: { name?: string; description?: string; config?: TournamentConfig; status?: TournamentStatus; state?: TournamentState | null; results?: TournamentResults | null; completedAt?: string | null; version?: number; participants?: NewParticipant[]; scaleSnapshot?: PslScaleSnapshot }): TournamentRecord | null {
  const cur = getTournament(userId, id);
  if (!cur) return null;
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("UPDATE tournaments SET name = ?, description = ?, format = ?, status = ?, config_json = ?, scale_snapshot_json = ?, state_json = ?, results_json = ?, version = ?, updated_at = ?, completed_at = ? WHERE id = ? AND user_id = ?").run(
      patch.name ?? cur.name, patch.description ?? cur.description, (patch.config ?? cur.config).format, patch.status ?? cur.status, JSON.stringify(patch.config ?? cur.config), JSON.stringify(patch.scaleSnapshot ?? cur.scaleSnapshot),
      patch.state === undefined ? (cur.state ? JSON.stringify(cur.state) : null) : patch.state ? JSON.stringify(patch.state) : null,
      patch.results === undefined ? (cur.results ? JSON.stringify(cur.results) : null) : patch.results ? JSON.stringify(patch.results) : null,
      patch.version ?? cur.version, now(), patch.completedAt === undefined ? cur.completedAt : patch.completedAt, id, userId,
    );
    if (patch.participants) replaceParticipantsTx(id, patch.participants);
  });
  tx();
  return getTournament(userId, id);
}

export function deleteTournament(userId: string, id: string): boolean {
  return getDb().prepare("DELETE FROM tournaments WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

export interface TournamentVersionRow {
  id: string;
  version: number;
  note: string;
  createdAt: string;
}

export function addTournamentVersion(userId: string, tournamentId: string, note: string): TournamentVersionRow | null {
  const cur = getTournament(userId, tournamentId);
  if (!cur) return null;
  const id = newId("tv");
  const t = now();
  getDb().prepare("INSERT INTO tournament_versions (id, tournament_id, version, note, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, tournamentId, cur.version, note, JSON.stringify(cur), t);
  return { id, version: cur.version, note, createdAt: t };
}

export function listTournamentVersions(userId: string, tournamentId: string): TournamentVersionRow[] {
  if (!getTournament(userId, tournamentId)) return [];
  return getDb().prepare("SELECT id, version, note, created_at AS createdAt FROM tournament_versions WHERE tournament_id = ? ORDER BY version DESC").all(tournamentId) as TournamentVersionRow[];
}

export function getTournamentVersion(userId: string, tournamentId: string, versionId: string): TournamentRecord | null {
  if (!getTournament(userId, tournamentId)) return null;
  const row = getDb().prepare("SELECT snapshot_json FROM tournament_versions WHERE id = ? AND tournament_id = ?").get(versionId, tournamentId) as { snapshot_json: string } | undefined;
  return row ? (JSON.parse(row.snapshot_json) as TournamentRecord) : null;
}

export function pslStats(userId: string) {
  const db = getDb();
  const c = (sql: string) => (db.prepare(sql).get(userId) as { n: number }).n;
  return {
    scales: c("SELECT COUNT(*) AS n FROM psl_scales WHERE user_id = ?") + 1,
    ratings: c("SELECT COUNT(*) AS n FROM psl_ratings WHERE user_id = ?"),
    tournaments: c("SELECT COUNT(*) AS n FROM tournaments WHERE user_id = ?"),
    completedTournaments: c("SELECT COUNT(*) AS n FROM tournaments WHERE user_id = ? AND status = 'completed'"),
  };
}

export function deleteAllPsl(userId: string) {
  const db = getDb();
  const scales = db.prepare("SELECT id FROM psl_scales WHERE user_id = ?").all(userId) as { id: string }[];
  for (const s of scales) deleteScale(userId, s.id);
  db.prepare("DELETE FROM tournaments WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM psl_ratings WHERE user_id = ?").run(userId);
}

export function exportPsl(userId: string) {
  return {
    scales: listScales(userId).filter((s) => !s.builtIn).map((s) => getScale(userId, s.id)),
    ratings: listRatings(userId, { limit: 10_000 }).map((r) => getRating(userId, r.id)),
    tournaments: listTournaments(userId, 10_000).map((t) => getTournament(userId, t.id)),
  };
}
