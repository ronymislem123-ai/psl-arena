import { z } from "zod";
import { SIDE_LANDMARK_ORDER } from "@/engine/side-view";
import { CRITERIA } from "@/engine/psl/rubric";
import { SCALE_EXPORT_FORMAT } from "@/engine/psl/scale";

export const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

export const analysisConfigSchema = z.object({
  includeReconstructed: z.boolean().default(true),
  captureDistance: z.enum(["unknown", "selfie", "standard"]).default("unknown"),
  uncertaintySamples: z.number().int().min(0).max(200).default(40),
  seed: z.number().int().default(20251106),
});

export const analysisInputSchema = z.object({
  mesh: z.array(pointSchema).length(478),
  trichion: z
    .object({ point: pointSchema, source: z.enum(["estimated", "manual"]), confidence: z.number().min(0).max(1) })
    .nullable()
    .optional(),
  neck: z.object({ right: pointSchema, left: pointSchema, source: z.literal("manual") }).nullable().optional(),
  blendshapes: z.record(z.string(), z.number()),
  transformMatrix: z.array(z.number()).length(16).nullable().optional(),
  rawQuality: z.object({
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
    faceWidthPx: z.number().positive(),
    faceHeightPx: z.number().positive(),
    sharpness: z.number().min(0),
    brightness: z.number().min(0).max(255),
    contrast: z.number().min(0),
    faceBox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    faceCount: z.number().int().min(1),
  }),
  config: analysisConfigSchema,
});

export const createAnalysisSchema = z.object({
  profileId: z.string().optional(),
  profileLabel: z.string().trim().min(1).max(60).optional(),
  /** JPEG/PNG data URL; only sent when the user opted into storage */
  imageDataUrl: z.string().max(12_000_000).optional(),
  storeImage: z.boolean().default(false),
  consent: z.object({ rightsConfirmed: z.literal(true), adultsConfirmed: z.literal(true) }),
  input: analysisInputSchema,
});

export const sidePointsSchema = z.object(Object.fromEntries(SIDE_LANDMARK_ORDER.map((id) => [id, pointSchema])) as Record<(typeof SIDE_LANDMARK_ORDER)[number], typeof pointSchema>);

export const createSideAnalysisSchema = z.object({
  profileId: z.string().optional(),
  profileLabel: z.string().trim().min(1).max(60).optional(),
  imageDataUrl: z.string().max(12_000_000).optional(),
  storeImage: z.boolean().default(false),
  consent: z.object({ rightsConfirmed: z.literal(true), adultsConfirmed: z.literal(true) }),
  imageWidth: z.number().int().positive().max(20_000),
  imageHeight: z.number().int().positive().max(20_000),
  points: sidePointsSchema,
});

export const createBattleSchema = z.object({
  analysisAId: z.string().min(1),
  analysisBId: z.string().min(1),
});

export const createProfileSchema = z.object({
  label: z.string().trim().min(1).max(60),
  note: z.string().max(500).optional(),
});

export const updateProfileSchema = createProfileSchema.partial();

export const settingsSchema = z.object({
  language: z.enum(["en", "de"]).optional(),
  reducedMotion: z.boolean().optional(),
  showMeshByDefault: z.boolean().optional(),
  includeReconstructed: z.boolean().optional(),
  defaultCaptureDistance: z.enum(["unknown", "selfie", "standard"]).optional(),
  storeImagesByDefault: z.boolean().optional(),
  uncertaintySamples: z.number().int().min(0).max(200).optional(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const signupSchema = z.object({
  email: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
  name: z.string().max(60).optional(),
});
export const loginSchema = z.object({ email: z.string().min(3).max(254), password: z.string().min(1).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(200) });
export const resetPasswordSchema = z.object({ email: z.string().min(3).max(254), code: z.string().min(10).max(20), newPassword: z.string().min(1).max(200) });
export const regenerateCodesSchema = z.object({ password: z.string().min(1).max(200) });
export const totpCodeSchema = z.object({ code: z.string().min(6).max(12) });
export const totpSetupSchema = z.object({ password: z.string().min(1).max(200) });
export const totpDisableSchema = z.object({ password: z.string().min(1).max(200), code: z.string().min(6).max(20) });
export const mfaCompleteSchema = z.object({ code: z.string().min(6).max(12).optional(), recoveryCode: z.string().min(10).max(20).optional() }).refine((v) => !!v.code || !!v.recoveryCode, { message: "A code is required." });

// ---------------------------------------------------------------- PSL scales / ratings / tournaments
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const tierSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(60),
  short: z.string().trim().max(20).default(""),
  group: z.string().trim().max(60).nullable().default(null),
  min: z.number().finite(),
  max: z.number().finite(),
  order: z.number().int().min(0),
  description: z.string().max(600).default(""),
  color: colorSchema.default("#4f7cff"),
  percentile: z.string().max(60).nullable().default(null),
  images: z.array(z.object({ imageId: z.string().regex(/^img_[a-z0-9]+$/), caption: z.string().max(200).default("") })).max(12).default([]),
  notes: z.string().max(1000).default(""),
});
export const scaleInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(""),
  rangeMin: z.number().finite(),
  rangeMax: z.number().finite(),
  tiers: z.array(tierSchema).min(1).max(64),
  isTemplate: z.boolean().optional(),
});
export const scaleImportSchema = z.object({
  format: z.literal(SCALE_EXPORT_FORMAT),
  formatVersion: z.number().int(),
  exportedAt: z.string().optional(),
  scale: z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(1000).optional(),
    rangeMin: z.number().finite(),
    rangeMax: z.number().finite(),
    version: z.number().int().optional(),
    tiers: z.array(tierSchema.omit({ images: true }).partial({ order: true, notes: true, group: true, percentile: true, description: true, short: true })).min(1).max(64),
  }),
});
export const tierImageSchema = z.object({ tierId: z.string().min(1), imageDataUrl: z.string().max(12_000_000), width: z.number().int().positive(), height: z.number().int().positive(), caption: z.string().max(200).default("") });
export const duplicateScaleSchema = z.object({ name: z.string().trim().max(80).optional() });

export const createRatingSchema = z
  .object({
    analysisId: z.string().optional(),
    newAnalysis: z
      .object({
        profileId: z.string().optional(),
        profileLabel: z.string().trim().min(1).max(60).optional(),
        imageDataUrl: z.string().max(12_000_000).optional(),
        storeImage: z.boolean().default(false),
        input: analysisInputSchema,
      })
      .optional(),
    sideAnalysisId: z.string().nullable().optional(),
    useLatestSide: z.boolean().optional(),
    scaleId: z.string().optional(),
    minCoverage: z.number().min(0.3).max(1).optional(),
    consent: z.object({ rightsConfirmed: z.literal(true), adultsConfirmed: z.literal(true) }),
  })
  .refine((v) => !!v.analysisId || !!v.newAnalysis, { message: "analysisId or newAnalysis is required." });

const criterionIds = CRITERIA.map((c) => c.id) as [string, ...string[]];
export const tournamentCategorySchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(60),
  criteria: z.array(z.object({ id: z.enum(criterionIds), weight: z.number().positive().max(100) })).max(40),
  overall: z.boolean().optional(),
  weight: z.number().min(0).max(1000),
  builtIn: z.boolean().optional(),
});
export const tournamentConfigSchema = z.object({
  format: z.enum(["knockout", "group", "ranking", "category"]),
  seeding: z.enum(["rating", "random", "manual"]).default("rating"),
  randomSeed: z.number().int().default(20251106),
  winnerMethod: z.enum(["weighted", "knockout"]).default("weighted"),
  decisiveCategoryId: z.string().min(1),
  tieEpsilon: z.number().min(0).max(1).default(0.05),
  groupSize: z.number().int().min(2).max(16).default(4),
  qualifyPerGroup: z.number().int().min(1).max(16).default(2),
  minCategoryCoverage: z.number().min(0).max(1).default(0.5),
  categories: z.array(tournamentCategorySchema).min(1).max(40),
});
export const participantSpecSchema = z.object({ profileId: z.string().min(1), ratingId: z.string().optional(), displayName: z.string().trim().max(60).optional() });
export const createTournamentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(1000).optional(),
  config: tournamentConfigSchema,
  scaleId: z.string().optional(),
  participants: z.array(participantSpecSchema).min(2).max(128),
});
export const updateTournamentSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).optional(),
  config: tournamentConfigSchema.optional(),
  scaleId: z.string().optional(),
  participants: z.array(participantSpecSchema).min(2).max(128).optional(),
});
export const tournamentActionSchema = z.object({
  action: z.enum(["start", "advance", "playAll", "pause", "resume", "complete", "decide", "reopen", "duplicate"]),
  matchId: z.string().optional(),
  winnerId: z.string().optional(),
  note: z.string().max(200).optional(),
});
