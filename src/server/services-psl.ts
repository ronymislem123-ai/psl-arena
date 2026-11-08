/**
 * Use-cases for the PSL modules: scale editing/import, rating creation
 * (frontal + optional profile + optional visual provider), tournament lifecycle.
 */
import type { AnalysisInput } from "@/engine/types";
import { rateFace, type RatingResult, type VisualStatus } from "@/engine/psl/rating";
import { VisualModelError } from "@/lib/visual-model/claude";
import { RUBRIC_VERSION } from "@/engine/psl/rubric";
import { BUILTIN_SCALE_ID, exportScale, snapshotScale, validateScale, type PslScale, type PslTier, type ScaleExport } from "@/engine/psl/scale";
import { computeResults, initialState, resolveTiedMatch, step } from "@/engine/tournament/engine";
import type { ParticipantData, TournamentConfig } from "@/engine/tournament/types";
import { base64ToBytes } from "./bytes";
import { ServiceError } from "./errors";
import { readImage, storeImage } from "./images";
import { getAnalysis, getProfile, getSideAnalysis, listSideAnalyses } from "./repos";
import { addTournamentVersion, createScale, deleteTournament, getRating, getScale, getTournament, insertRating, insertTournament, listRatings, updateScale, updateTournament, userOwnsImage, type NewParticipant, type ScaleInput, type TournamentRecord } from "./repos-psl";
import { createAnalysis } from "./services";
import { getVisualProvider, VISUAL_CRITERIA, visualAssessmentSchema } from "./vision-provider";

// ---------------------------------------------------------------- scales
export function assertValidScale(input: Pick<PslScale, "name" | "rangeMin" | "rangeMax" | "tiers">) {
  const issues = validateScale(input);
  if (issues.length) {
    const err = new ServiceError(400, `Scale is not valid: ${issues.map((i) => i.message).join(" ")}`);
    (err as ServiceError & { issues?: unknown }).issues = issues;
    throw err;
  }
}

function assertOwnImages(userId: string, tiers: PslTier[]) {
  for (const t of tiers) for (const img of t.images) if (!userOwnsImage(userId, img.imageId)) throw new ServiceError(400, `Image ${img.imageId} is not available.`);
}

export function saveNewScale(userId: string, input: ScaleInput): PslScale {
  assertValidScale(input);
  assertOwnImages(userId, input.tiers);
  return createScale(userId, input);
}

export function saveScale(userId: string, id: string, input: ScaleInput): PslScale {
  if (id === BUILTIN_SCALE_ID) throw new ServiceError(400, "The built-in scale cannot be edited; duplicate it first.");
  assertValidScale(input);
  assertOwnImages(userId, input.tiers);
  const s = updateScale(userId, id, input);
  if (!s) throw new ServiceError(404, "Scale not found.");
  return s;
}

export function duplicateScale(userId: string, id: string, name?: string): PslScale {
  const src = getScale(userId, id);
  if (!src) throw new ServiceError(404, "Scale not found.");
  // reference images are shared by id; both scales point at the same encrypted files
  return createScale(userId, { name: name?.trim() || `${src.name} (copy)`, description: src.description, rangeMin: src.rangeMin, rangeMax: src.rangeMax, tiers: src.tiers.map((t) => ({ ...t, images: [...t.images] })) });
}

export function importScale(userId: string, data: ScaleExport, name?: string): PslScale {
  const tiers: PslTier[] = data.scale.tiers.map((t, i) => ({ ...t, order: t.order ?? i, images: [], notes: t.notes ?? "", group: t.group ?? null, percentile: t.percentile ?? null, description: t.description ?? "", short: t.short ?? t.name }));
  const input: ScaleInput = { name: name?.trim() || data.scale.name, description: data.scale.description ?? "", rangeMin: data.scale.rangeMin, rangeMax: data.scale.rangeMax, tiers };
  assertValidScale(input);
  return createScale(userId, input);
}

export function exportScaleJson(userId: string, id: string): ScaleExport {
  const s = getScale(userId, id);
  if (!s) throw new ServiceError(404, "Scale not found.");
  return exportScale(s);
}

function decodeDataUrl(dataUrl: string): { buf: Uint8Array; mime: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ServiceError(400, "Invalid image data URL.");
  const buf = base64ToBytes(m[2]);
  if (buf.length > 8_000_000) throw new ServiceError(413, "Image too large (max 8 MB).");
  return { buf, mime: m[1] };
}

export function addTierImage(userId: string, scaleId: string, tierId: string, imageDataUrl: string, width: number, height: number, caption: string): PslScale {
  const s = getScale(userId, scaleId);
  if (!s || s.builtIn) throw new ServiceError(404, "Scale not found.");
  const tier = s.tiers.find((t) => t.id === tierId);
  if (!tier) throw new ServiceError(404, "Tier not found.");
  if (tier.images.length >= 12) throw new ServiceError(400, "At most 12 reference images per tier.");
  const { buf, mime } = decodeDataUrl(imageDataUrl);
  const img = storeImage(userId, buf, mime, width, height);
  tier.images.push({ imageId: img.id, caption: caption.slice(0, 200) });
  return updateScale(userId, scaleId, { name: s.name, description: s.description, rangeMin: s.rangeMin, rangeMax: s.rangeMax, tiers: s.tiers })!;
}

// ---------------------------------------------------------------- ratings
export interface CreateRatingArgs {
  analysisId?: string;
  newAnalysis?: { profileId?: string; profileLabel?: string; imageDataUrl?: string; storeImage: boolean; input: AnalysisInput };
  sideAnalysisId?: string | null;
  useLatestSide?: boolean;
  scaleId?: string;
  minCoverage?: number;
  /** explicit consent to send the frontal photo to the configured vision model for this rating */
  visualConsent?: boolean;
  /** the photo for the vision model when it is not stored (sent only with consent, never stored) */
  visualImageDataUrl?: string;
  lang?: "de" | "en";
}

export async function createRating(userId: string, args: CreateRatingArgs) {
  let analysis = args.analysisId ? getAnalysis(userId, args.analysisId) : null;
  let imageDataUrl: string | undefined;
  if (!analysis && args.newAnalysis) {
    analysis = createAnalysis(userId, { profileId: args.newAnalysis.profileId, profileLabel: args.newAnalysis.profileLabel, imageDataUrl: args.newAnalysis.imageDataUrl, storeImage: args.newAnalysis.storeImage, input: args.newAnalysis.input });
    imageDataUrl = args.newAnalysis.imageDataUrl;
  }
  if (!analysis) throw new ServiceError(404, "Analysis not found.");
  const profile = getProfile(userId, analysis.profileId);
  if (!profile) throw new ServiceError(404, "Profile not found.");

  let side = args.sideAnalysisId ? getSideAnalysis(userId, args.sideAnalysisId) : null;
  if (args.sideAnalysisId && !side) throw new ServiceError(404, "Side-view analysis not found.");
  if (side && side.profileId !== analysis.profileId) throw new ServiceError(400, "The side-view analysis belongs to a different profile.");
  if (!side && args.sideAnalysisId !== null && (args.useLatestSide ?? true)) {
    const latest = listSideAnalyses(userId, { profileId: analysis.profileId, limit: 5 }).find((s) => s.analyzable);
    side = latest ? getSideAnalysis(userId, latest.id) : null;
  }

  const scale = getScale(userId, args.scaleId ?? BUILTIN_SCALE_ID);
  if (!scale) throw new ServiceError(404, "Scale not found.");
  assertValidScale(scale);

  // optional vision-model assessment of the visual criteria: only with a configured
  // model AND the user's consent for this rating; never simulated
  let visual = null;
  let visualStatus: VisualStatus = "notConfigured";
  let visualError: string | undefined;
  const provider = getVisualProvider();
  if (provider) {
    if (!args.visualConsent) visualStatus = "noConsent";
    else {
      const src = args.visualImageDataUrl ?? imageDataUrl;
      const img = src ? decodeDataUrl(src) : analysis.imageId ? readImage(userId, analysis.imageId) : null;
      if (!img) visualStatus = "noImage";
      else {
        try {
          const raw = await provider.assess(img, VISUAL_CRITERIA, { lang: args.lang });
          visual = visualAssessmentSchema.parse(raw);
          visualStatus = "used";
        } catch (e) {
          visualStatus = "failed";
          visualError = e instanceof VisualModelError ? e.code : "invalidOutput";
          console.error("[vision-provider] assessment failed:", e instanceof Error ? e.message : e);
        }
      }
    }
  }

  const result: RatingResult = rateFace({ frontal: analysis.result, side: side?.result ?? null, visual, visualStatus, visualError, scale: snapshotScale(scale), minCoverage: args.minCoverage });
  return insertRating({ userId, profileId: analysis.profileId, analysisId: analysis.id, sideAnalysisId: side?.id ?? null, scaleId: scale.id, result });
}

// ---------------------------------------------------------------- tournaments
export interface ParticipantSpec {
  profileId: string;
  ratingId?: string;
  displayName?: string;
}

function buildParticipant(userId: string, spec: ParticipantSpec): NewParticipant {
  const profile = getProfile(userId, spec.profileId);
  if (!profile) throw new ServiceError(404, `Profile ${spec.profileId} not found.`);
  const rating = spec.ratingId ? getRating(userId, spec.ratingId) : (() => {
    const latest = listRatings(userId, { profileId: spec.profileId, limit: 1 })[0];
    return latest ? getRating(userId, latest.id) : null;
  })();
  if (!rating) throw new ServiceError(400, `"${profile.label}" has no PSL rating yet. Rate the profile first.`);
  if (rating.profileId !== profile.id) throw new ServiceError(400, "The rating belongs to a different profile.");
  if (rating.rubricVersion !== RUBRIC_VERSION) throw new ServiceError(409, `"${profile.label}" was rated with rubric ${rating.rubricVersion}; re-rate with ${RUBRIC_VERSION} for a fair comparison.`);
  return { profileId: profile.id, ratingId: rating.id, displayName: (spec.displayName?.trim() || profile.label).slice(0, 60), imageId: profile.imageId, rating: rating.result };
}

export function createTournament(userId: string, args: { name: string; description?: string; config: TournamentConfig; scaleId?: string; participants: ParticipantSpec[] }): TournamentRecord {
  if (args.participants.length < 2) throw new ServiceError(400, "A tournament needs at least two participants.");
  if (args.participants.length > 128) throw new ServiceError(400, "At most 128 participants.");
  const ids = new Set(args.participants.map((p) => p.profileId));
  if (ids.size !== args.participants.length) throw new ServiceError(400, "A profile can take part only once per tournament.");
  const scale = getScale(userId, args.scaleId ?? BUILTIN_SCALE_ID);
  if (!scale) throw new ServiceError(404, "Scale not found.");
  assertValidScale(scale);
  validateConfig(args.config);
  const participants = args.participants.map((p) => buildParticipant(userId, p));
  return insertTournament({ userId, name: args.name.trim(), description: args.description?.trim() ?? "", config: args.config, scaleSnapshot: snapshotScale(scale), rubricVersion: RUBRIC_VERSION, participants });
}

export function validateConfig(config: TournamentConfig) {
  if (!config.categories.length) throw new ServiceError(400, "At least one category is required.");
  const ids = new Set(config.categories.map((c) => c.id));
  if (ids.size !== config.categories.length) throw new ServiceError(400, "Category ids must be unique.");
  if (!ids.has(config.decisiveCategoryId)) throw new ServiceError(400, "The decisive category must be one of the tournament categories.");
  if (config.groupSize < 2 || config.groupSize > 16) throw new ServiceError(400, "Group size must be 2–16.");
  if (config.qualifyPerGroup < 1 || config.qualifyPerGroup > config.groupSize) throw new ServiceError(400, "Qualifiers per group must be 1–group size.");
}

export function updateTournamentDraft(userId: string, id: string, patch: { name?: string; description?: string; config?: TournamentConfig; participants?: ParticipantSpec[]; scaleId?: string }): TournamentRecord {
  const cur = getTournament(userId, id);
  if (!cur) throw new ServiceError(404, "Tournament not found.");
  if (cur.status !== "draft") throw new ServiceError(409, cur.status === "completed" ? "Completed tournaments are locked. Reopen it to create a new version." : "Only draft tournaments can be edited.");
  if (patch.config) validateConfig(patch.config);
  const participants = patch.participants ? patch.participants.map((p) => buildParticipant(userId, p)) : undefined;
  if (participants && participants.length < 2) throw new ServiceError(400, "A tournament needs at least two participants.");
  let scaleSnapshot;
  if (patch.scaleId) {
    const scale = getScale(userId, patch.scaleId);
    if (!scale) throw new ServiceError(404, "Scale not found.");
    assertValidScale(scale);
    scaleSnapshot = snapshotScale(scale);
  }
  return updateTournament(userId, id, { name: patch.name?.trim(), description: patch.description?.trim(), config: patch.config, participants, scaleSnapshot })!;
}

export function toParticipantData(t: TournamentRecord): ParticipantData[] {
  return t.participants.map((p) => ({ id: p.id, name: p.displayName, imageId: p.imageId, rating: p.rating, seed: p.seed }));
}

export type TournamentAction = "start" | "advance" | "playAll" | "pause" | "resume" | "complete" | "decide" | "reopen" | "duplicate";

export function runTournamentAction(userId: string, id: string, action: TournamentAction, params: { matchId?: string; winnerId?: string; note?: string } = {}): { tournament: TournamentRecord; blocked: boolean } {
  const t = getTournament(userId, id);
  if (!t) throw new ServiceError(404, "Tournament not found.");
  const now = new Date().toISOString();
  const participants = toParticipantData(t);
  const finish = (state: ReturnType<typeof initialState>) => {
    const results = computeResults(participants, t.config, state, now);
    return updateTournament(userId, id, { state, results, status: "completed", completedAt: state.completedAt ?? now })!;
  };
  switch (action) {
    case "start": {
      if (t.status !== "draft") throw new ServiceError(409, "The tournament has already started.");
      if (t.participants.length < 2) throw new ServiceError(400, "At least two participants are required.");
      let state = initialState(participants, t.config, now);
      if (t.config.format === "ranking" || t.config.format === "category") {
        state = step(state, participants, t.config, now).state;
        return { tournament: finish(state), blocked: false };
      }
      return { tournament: updateTournament(userId, id, { state, status: "running" })!, blocked: false };
    }
    case "advance":
    case "playAll": {
      if (t.status !== "running" || !t.state) throw new ServiceError(409, "The tournament is not running.");
      let state = t.state;
      let res = step(state, participants, t.config, now);
      state = res.state;
      while (action === "playAll" && !res.done && !res.blocked) {
        res = step(state, participants, t.config, now);
        state = res.state;
      }
      if (res.done) return { tournament: finish(state), blocked: false };
      return { tournament: updateTournament(userId, id, { state })!, blocked: res.blocked };
    }
    case "pause":
      if (t.status !== "running") throw new ServiceError(409, "Only running tournaments can be paused.");
      return { tournament: updateTournament(userId, id, { status: "paused" })!, blocked: false };
    case "resume":
      if (t.status !== "paused") throw new ServiceError(409, "The tournament is not paused.");
      return { tournament: updateTournament(userId, id, { status: "running" })!, blocked: false };
    case "decide": {
      if (t.status !== "running" || !t.state?.bracket) throw new ServiceError(409, "No knockout match to decide.");
      if (!params.matchId || !params.winnerId) throw new ServiceError(400, "matchId and winnerId are required.");
      const match = t.state.bracket.rounds.flat().find((m) => m.id === params.matchId);
      if (!match || match.status !== "tied") throw new ServiceError(409, "Only tied matches can be decided manually.");
      if (match.a !== params.winnerId && match.b !== params.winnerId) throw new ServiceError(400, "The winner must be one of the two participants.");
      const state = resolveTiedMatch(t.state, params.matchId, params.winnerId);
      const stillTied = state.bracket!.rounds[state.currentRound].some((m) => m.status === "tied");
      if (!stillTied) {
        // the round is complete once every tie is resolved: continue like "advance"
        const res = step({ ...state, currentRound: state.currentRound }, participants, t.config, now);
        if (res.done) return { tournament: finish(res.state), blocked: false };
        return { tournament: updateTournament(userId, id, { state: res.state })!, blocked: res.blocked };
      }
      return { tournament: updateTournament(userId, id, { state })!, blocked: true };
    }
    case "complete": {
      if (t.status === "completed") throw new ServiceError(409, "Already completed.");
      if ((t.config.format === "knockout" || t.config.format === "group") && t.state?.phase !== "done") throw new ServiceError(409, "Play all rounds before completing a knockout or group tournament.");
      const state = t.state ?? initialState(participants, t.config, now);
      return { tournament: finish({ ...state, phase: "done", completedAt: state.completedAt ?? now }), blocked: false };
    }
    case "reopen": {
      if (t.status !== "completed") throw new ServiceError(409, "Only completed tournaments can be reopened.");
      addTournamentVersion(userId, id, params.note?.trim() || `Version ${t.version} archived before reopening`);
      return { tournament: updateTournament(userId, id, { status: "draft", state: null, results: null, completedAt: null, version: t.version + 1 })!, blocked: false };
    }
    case "duplicate": {
      const copy = insertTournament({ userId, name: `${t.name} (copy)`, description: t.description, config: t.config, scaleSnapshot: t.scaleSnapshot, rubricVersion: t.rubricVersion, participants: t.participants.map((p) => ({ profileId: p.profileId, ratingId: p.ratingId, displayName: p.displayName, imageId: p.imageId, rating: p.rating })) });
      return { tournament: copy, blocked: false };
    }
    default:
      throw new ServiceError(400, "Unknown action.");
  }
}

export function removeTournament(userId: string, id: string): boolean {
  return deleteTournament(userId, id);
}
