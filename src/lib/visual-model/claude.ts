/**
 * Vision-model assessment of the rubric's `visual` criteria through the Claude API
 * (Anthropic TypeScript SDK). Used by the server edition (key from the environment)
 * and by the browser edition (the user's own key, stored only in their browser).
 *
 * What it is: a visual impression by a general vision model, reported per criterion
 * with a confidence and a short reason, always labelled "visual model" — never a
 * measurement. What it is not: an identity check, an age or ethnicity estimate, or
 * an overall attractiveness verdict (the prompt forbids all three; only the listed
 * criteria are returned, validated against a strict schema).
 *
 * The photo is only sent when the caller passes it after the user's explicit consent
 * for that rating (the consent check lives in the callers).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { VisualAssessmentSet } from "@/engine/psl/rating";
import { CRITERIA, type CriterionId } from "@/engine/psl/rubric";

export const CLAUDE_PROVIDER_ID = "claude";
export const DEFAULT_VISUAL_MODEL = "claude-opus-5-5";

/** Criteria a vision model may assess (no geometric measurement exists for them). */
export const VISUAL_MODEL_CRITERIA = CRITERIA.filter((c) => c.method === "visual");

/** What the model is asked to judge per criterion (anchors for 0, 5 and 10). */
const RUBRIC_TEXT: Partial<Record<CriterionId, string>> = {
  eyeShape: "Eye shape — overall palpebral fissure shape. 10: well-defined almond shape with visible lid margins and a slight positive tilt; 5: average shape; 0: strongly hooded, very round or asymmetric fissures that dominate the eye region.",
  cheekboneProjection: "Cheekbone projection — visible prominence of the zygomatic region (malar highlight, contour below the cheekbone). 10: clearly projected cheekbones with a visible contour; 5: average; 0: flat midface without a visible zygomatic contour. Lighting and body fat affect the impression — lower the confidence when they dominate.",
  jawlineDefinition: "Jawline definition — visible sharpness of the lower mandibular border from the chin to the jaw angle. 10: sharp, continuous border with a clear separation from the neck; 5: average; 0: border not visible (soft tissue, double chin). Beards hide the border — then mark it not assessable.",
  lipShape: "Lip shape — vermilion shape and fullness. 10: well-defined vermilion border and Cupid's bow, balanced fullness of both lips; 5: average; 0: very thin or undefined vermilion. Rate the shape, not the colour or make-up.",
};

const SYSTEM = [
  "You assess facial features in a photo for a geometric facial-analysis app, one criterion at a time, on a 0–10 scale with the anchors given.",
  "Rules: judge only the listed criteria; do not identify the person, do not guess name, age, ethnicity, health or any other personal attribute, and do not give an overall attractiveness judgement.",
  "If a criterion cannot be judged from this photo (hidden by hair, beard, glasses, pose, lighting, resolution), set assessable to false, score to 0 and explain why in the note.",
  "Confidence (0–1) states how clearly the photo shows the feature. Notes are one short neutral sentence about the visible feature.",
].join(" ");

const outputSchema = z.object({
  assessments: z.array(
    z.object({
      criterion: z.enum(VISUAL_MODEL_CRITERIA.map((c) => c.id) as [CriterionId, ...CriterionId[]]),
      assessable: z.boolean(),
      score: z.number(),
      confidence: z.number(),
      note: z.string(),
    }),
  ),
});

export interface ClaudeVisualOptions {
  apiKey: string;
  model?: string;
  /** language of the notes */
  lang?: "de" | "en";
  /** browser edition: the user's own key is used from the page */
  browser?: boolean;
  /** request timeout in ms */
  timeoutMs?: number;
  /** for tests: custom fetch */
  fetch?: typeof fetch;
  baseURL?: string;
}

export class VisualModelError extends Error {
  constructor(
    message: string,
    readonly code: "auth" | "rateLimit" | "refusal" | "invalidOutput" | "network" | "api",
  ) {
    super(message);
    this.name = "VisualModelError";
  }
}

/** Sends one photo to the vision model and returns the validated assessment set. */
export async function assessWithClaude(image: { base64: string; mime: string }, opts: ClaudeVisualOptions): Promise<VisualAssessmentSet> {
  const model = opts.model || DEFAULT_VISUAL_MODEL;
  // key and endpoint are set explicitly: the SDK would otherwise also pick up
  // ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL from the process environment
  const client = new Anthropic({
    apiKey: opts.apiKey,
    authToken: null,
    baseURL: opts.baseURL ?? "https://api.anthropic.com",
    dangerouslyAllowBrowser: !!opts.browser,
    timeout: opts.timeoutMs ?? 90_000,
    maxRetries: 2,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  const criteriaText = VISUAL_MODEL_CRITERIA.map((c) => `- ${c.id}: ${RUBRIC_TEXT[c.id] ?? c.definition}`).join("\n");
  const lang = opts.lang === "de" ? "German" : "English";
  let msg;
  try {
    msg = await client.beta.messages.parse({
      model,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(outputSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mime as "image/jpeg" | "image/png" | "image/webp", data: image.base64 } },
            { type: "text", text: `Assess these criteria (write the notes in ${lang}):\n${criteriaText}` },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new VisualModelError("The API key was rejected.", "auth");
    if (e instanceof Anthropic.RateLimitError) throw new VisualModelError("Rate limit reached; try again later.", "rateLimit");
    if (e instanceof Anthropic.APIConnectionError) throw new VisualModelError("The vision model could not be reached.", "network");
    if (e instanceof Anthropic.APIError) throw new VisualModelError(`Vision model error (${e.status ?? "?"}).`, "api");
    throw new VisualModelError(e instanceof Error ? e.message : String(e), "invalidOutput");
  }
  if (msg.stop_reason === "refusal") throw new VisualModelError("The vision model declined this photo.", "refusal");
  const parsed = msg.parsed_output;
  if (!parsed) throw new VisualModelError("The vision model returned no valid assessment.", "invalidOutput");
  return toAssessmentSet(parsed, msg.model ?? model);
}

/** Validates and normalises the model output (scores clamped to 0–10, confidence to 0–1; not assessable → omitted). */
export function toAssessmentSet(parsed: z.infer<typeof outputSchema>, modelVersion: string): VisualAssessmentSet {
  const assessments: VisualAssessmentSet["assessments"] = {};
  for (const a of parsed.assessments) {
    if (!a.assessable || !Number.isFinite(a.score) || !Number.isFinite(a.confidence)) continue;
    assessments[a.criterion] = { score: Math.max(0, Math.min(10, a.score)), confidence: Math.max(0, Math.min(1, a.confidence)), note: a.note.slice(0, 400) };
  }
  return { providerId: CLAUDE_PROVIDER_ID, modelVersion, assessedAt: new Date().toISOString(), assessments };
}

/** Splits a data URL into base64 payload and media type. */
export function splitDataUrl(dataUrl: string): { base64: string; mime: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { mime: m[1], base64: m[2] } : null;
}
