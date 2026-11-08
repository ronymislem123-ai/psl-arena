/**
 * Visual assessment provider: the only way the rubric's `visual` criteria (eye shape,
 * lip shape, cheekbone projection, jawline definition) are assessed. These are
 * visual impressions, not measurements; they are never simulated. A provider is
 * available when a vision model is configured (server: PSL_ARENA_VISION_PROVIDER=claude
 * + ANTHROPIC_API_KEY; browser edition: the user's own key), and it is only called
 * when the user consented to sending the photo for that rating.
 */
import { z } from "zod";
import { CRITERIA, type CriterionDefinition, type CriterionId } from "@/engine/psl/rubric";
import type { VisualAssessmentSet } from "@/engine/psl/rating";
import { assessWithClaude, CLAUDE_PROVIDER_ID, DEFAULT_VISUAL_MODEL } from "@/lib/visual-model/claude";
import { bytesToBase64 } from "./bytes";
import { visionConfig, visionConfigHint } from "./vision-config";

export interface VisualAssessmentProvider {
  id: string;
  modelVersion: string;
  assess(image: { buf: Uint8Array; mime: string }, criteria: CriterionDefinition[], opts?: { lang?: "de" | "en" }): Promise<VisualAssessmentSet>;
}

export const VISUAL_CRITERIA = CRITERIA.filter((c) => c.method === "visual");

/** Strict output contract every provider result must satisfy before it is used. */
export const visualAssessmentSchema = z.object({
  providerId: z.string().min(1),
  modelVersion: z.string().min(1),
  assessedAt: z.string().min(1),
  // partial: the model may declare criteria not assessable on a photo (zod 4 records over enums are exhaustive)
  assessments: z.partialRecord(
    z.enum(VISUAL_CRITERIA.map((c) => c.id) as [CriterionId, ...CriterionId[]]),
    z.object({ score: z.number().min(0).max(10), confidence: z.number().min(0).max(1), note: z.string().max(400).optional() }),
  ),
});

/** Test hook: replaces the configured provider (null = use the configuration). */
let override: VisualAssessmentProvider | null | undefined;
export function setVisualProviderForTests(p: VisualAssessmentProvider | null | undefined) {
  override = p;
}

export function getVisualProvider(): VisualAssessmentProvider | null {
  if (override !== undefined) return override;
  const cfg = visionConfig();
  if (!cfg) return null;
  const model = cfg.model ?? DEFAULT_VISUAL_MODEL;
  return {
    id: CLAUDE_PROVIDER_ID,
    modelVersion: model,
    assess: (image, _criteria, opts) => assessWithClaude({ base64: bytesToBase64(image.buf), mime: image.mime }, { apiKey: cfg.apiKey, model, browser: cfg.browser, lang: opts?.lang }),
  };
}

export function providerStatus(): { configured: boolean; providerId: string | null; model: string | null; criteria: CriterionId[]; hint: "notConfigured" | "missingKey" | "browserKey" | null } {
  const p = getVisualProvider();
  return { configured: !!p, providerId: p?.id ?? null, model: p?.modelVersion ?? null, criteria: VISUAL_CRITERIA.map((c) => c.id), hint: p ? null : visionConfigHint() };
}
