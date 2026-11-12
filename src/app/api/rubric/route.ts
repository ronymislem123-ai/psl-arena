import { ok } from "@/server/http";
import { COVERAGE_MIN, COVERAGE_PASS, REPRO_PASS, REPRO_WARN } from "@/engine/verify/control";
import { AGGREGATION_P, AREA_META, CALIBRATION_ANCHORS, CATEGORY_WEIGHTS, CRITERIA, DERIVED_TOLERANCE, DESCRIPTIVE_RATIOS, LANDMARK_RELIABILITY, RUBRIC_AREAS, RUBRIC_VERSION } from "@/engine/psl/rubric";
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
    // engine 3.1: fixed quality-control thresholds (no user setting)
    qualityControl: { coveragePass: COVERAGE_PASS, coverageMin: COVERAGE_MIN, reproducibilityPassPsl: REPRO_PASS / 10, reproducibilityMaxPsl: REPRO_WARN / 10 },
    derivedTolerance: DERIVED_TOLERANCE,
    visualProvider: providerStatus(),
  });
}
