import { ok } from "@/server/http";
import { AREA_META, CALIBRATION_ANCHORS, CRITERIA, DEFAULT_MIN_COVERAGE, DERIVED_TOLERANCE, RUBRIC_AREAS, RUBRIC_VERSION } from "@/engine/psl/rubric";
import { providerStatus } from "@/server/vision-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, versioned description of the rating rubric (no personal data). */
export async function GET() {
  return ok({ version: RUBRIC_VERSION, areas: RUBRIC_AREAS.map((a) => ({ id: a, ...AREA_META[a] })), criteria: CRITERIA, calibration: CALIBRATION_ANCHORS, minCoverage: DEFAULT_MIN_COVERAGE, derivedTolerance: DERIVED_TOLERANCE, visualProvider: providerStatus() });
}
