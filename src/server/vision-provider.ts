/**
 * Integration point for an external visual-assessment model (the only way the
 * rubric's `visual` criteria can be assessed). No provider ships enabled: without
 * one, visual criteria are reported as "not assessable" — never simulated.
 *
 * To add a provider, implement `VisualAssessmentProvider`, validate the model's
 * output with `visualAssessmentSchema` and register it in `getVisualProvider()`.
 */
import { z } from "zod";
import { CRITERIA, type CriterionDefinition, type CriterionId } from "@/engine/psl/rubric";
import type { VisualAssessmentSet } from "@/engine/psl/rating";

export interface VisualAssessmentProvider {
  id: string;
  modelVersion: string;
  assess(image: { buf: Uint8Array; mime: string }, criteria: CriterionDefinition[]): Promise<VisualAssessmentSet>;
}

export const VISUAL_CRITERIA = CRITERIA.filter((c) => c.method === "visual");

/** Strict output contract every provider result must satisfy before it is used. */
export const visualAssessmentSchema = z.object({
  providerId: z.string().min(1),
  modelVersion: z.string().min(1),
  assessedAt: z.string().min(1),
  assessments: z.record(
    z.enum(VISUAL_CRITERIA.map((c) => c.id) as [CriterionId, ...CriterionId[]]),
    z.object({ score: z.number().min(0).max(10), confidence: z.number().min(0).max(1), note: z.string().max(400).optional() }),
  ),
});

export function getVisualProvider(): VisualAssessmentProvider | null {
  // Reserved for a configured provider (e.g. PSL_ARENA_VISION_PROVIDER=<id>); none is bundled.
  return null;
}

export function providerStatus(): { configured: boolean; providerId: string | null; criteria: CriterionId[] } {
  const p = getVisualProvider();
  return { configured: !!p, providerId: p?.id ?? null, criteria: VISUAL_CRITERIA.map((c) => c.id) };
}
