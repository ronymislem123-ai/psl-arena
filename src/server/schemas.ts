import { z } from "zod";
import { SIDE_LANDMARK_ORDER } from "@/engine/side-view";

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
