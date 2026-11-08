import { ok } from "@/server/http";
import { AGGREGATION_P, AREA_META, CALIBRATION_ANCHORS, CATEGORY_WEIGHTS, CRITERIA, DEFAULT_MIN_COVERAGE, DERIVED_TOLERANCE, DESCRIPTIVE_RATIOS, LANDMARK_RELIABILITY, RUBRIC_AREAS, RUBRIC_VERSION } from "@/engine/psl/rubric";
import { providerStatus } from "@/server/vision-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, versioned description of the rating rubric (no personal data). */
export async function GET() {
  return ok({
    version: RUBRIC_VERSION,
    areas: RUBRIC_AREAS.map((a) => ({ id: a, ...AREA_META[a], weight: CATEGORY_WEIGHTS[a] ?? 0 })),
    criteria: CRITERIA,
    aggregation: { method: "weighted-power-mean", p: AGGREGATION_P, landmarkReliability: LANDMARK_RELIABILITY },
    descriptive: DESCRIPTIVE_RATIOS,
    calibration: CALIBRATION_ANCHORS,
    minCoverage: DEFAULT_MIN_COVERAGE,
    derivedTolerance: DERIVED_TOLERANCE,
    visualProvider: providerStatus(),
  });
}
