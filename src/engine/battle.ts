/**
 * Battle resolver: compares two analyses category by category and overall.
 * A winner is only declared when the overall difference exceeds the combined
 * measurement uncertainty; otherwise the result is a draw. Insufficient data
 * quality or coverage yields "inconclusive".
 */
import { ENGINE_VERSION } from "./analysis";
import { CATEGORY_META, CATEGORY_ORDER, RATIO_BY_ID } from "./ratios/database";
import type { AnalysisResult, BattleResult, BattleRound, CategoryId, KeyDifference, RoundWinner, Verdict } from "./types";

export const MIN_COVERAGE_FOR_VERDICT = 0.5;
export const MIN_CONFIDENCE_FOR_VERDICT = 0.35;
export const BASE_MARGIN = 1.0;

function margin(sigmaA: number | undefined, sigmaB: number | undefined, confA: number, confB: number): number {
  const sa = sigmaA ?? (1 - confA) * 8;
  const sb = sigmaB ?? (1 - confB) * 8;
  // 95 % interval of the difference + base margin
  return BASE_MARGIN + 1.96 * Math.sqrt(sa * sa + sb * sb);
}

function decide(a: number | null, b: number | null, m: number): RoundWinner {
  if (a == null || b == null) return "n/a";
  const d = b - a;
  if (Math.abs(d) <= m) return "draw";
  return d > 0 ? "B" : "A";
}

export function resolveBattle(A: AnalysisResult, B: AnalysisResult): BattleResult {
  const rounds: BattleRound[] = [];

  // Round 1: facial harmony (flat index)
  {
    const m = margin(A.uncertainty?.harmonySigma, B.uncertainty?.harmonySigma, A.scores.confidence, B.scores.confidence);
    rounds.push({ id: "harmony", label: "Facial Harmony", a: A.scores.harmony, b: B.scores.harmony, diff: A.scores.harmony != null && B.scores.harmony != null ? B.scores.harmony - A.scores.harmony : null, margin: m, winner: decide(A.scores.harmony, B.scores.harmony, m), confidenceA: A.scores.confidence, confidenceB: B.scores.confidence, weight: 1 });
  }
  for (const cat of CATEGORY_ORDER) {
    const ca = A.categories.find((c) => c.id === cat)!;
    const cb = B.categories.find((c) => c.id === cat)!;
    const m = margin(ca.sigma, cb.sigma, ca.confidence, cb.confidence);
    rounds.push({ id: cat, label: CATEGORY_META[cat].label, a: ca.index, b: cb.index, diff: ca.index != null && cb.index != null ? cb.index - ca.index : null, margin: m, winner: decide(ca.index, cb.index, m), confidenceA: ca.confidence, confidenceB: cb.confidence, weight: CATEGORY_META[cat].weight / 100 });
  }
  {
    const m = margin(A.symmetry.sigma, B.symmetry.sigma, A.symmetry.confidence, B.symmetry.confidence);
    rounds.push({ id: "symmetry", label: "Symmetry", a: A.symmetry.score, b: B.symmetry.score, diff: A.symmetry.score != null && B.symmetry.score != null ? B.symmetry.score - A.symmetry.score : null, margin: m, winner: decide(A.symmetry.score, B.symmetry.score, m), confidenceA: A.symmetry.confidence, confidenceB: B.symmetry.confidence, weight: 1 });
  }

  const roundWinsA = rounds.filter((r) => r.winner === "A").length;
  const roundWinsB = rounds.filter((r) => r.winner === "B").length;
  const roundDraws = rounds.filter((r) => r.winner === "draw").length;

  const overallA = A.scores.overall;
  const overallB = B.scores.overall;
  const mOverall = margin(A.uncertainty?.overallSigma, B.uncertainty?.overallSigma, A.scores.confidence, B.scores.confidence);
  const diff = overallA != null && overallB != null ? overallB - overallA : null;

  let verdict: Verdict;
  let reason: string;
  let verdictCode: BattleResult["verdictCode"];
  let verdictParams: Record<string, number> = {};
  const covA = A.coverage.fraction;
  const covB = B.coverage.fraction;
  if (!A.quality.analyzable || !B.quality.analyzable) {
    verdict = "inconclusive";
    verdictCode = "qualityFailed";
    reason = "At least one image failed the quality check; no verdict is possible.";
  } else if (overallA == null || overallB == null) {
    verdict = "inconclusive";
    verdictCode = "noOverall";
    reason = "An overall score could not be computed for at least one person.";
  } else if (covA < MIN_COVERAGE_FOR_VERDICT || covB < MIN_COVERAGE_FOR_VERDICT) {
    verdict = "inconclusive";
    verdictCode = "lowCoverage";
    verdictParams = { covA: Math.round(covA * 100), covB: Math.round(covB * 100), min: MIN_COVERAGE_FOR_VERDICT * 100 };
    reason = `Scoring coverage is too low (${Math.round(covA * 100)} % vs ${Math.round(covB * 100)} %; at least ${MIN_COVERAGE_FOR_VERDICT * 100} % required).`;
  } else if (A.scores.confidence < MIN_CONFIDENCE_FOR_VERDICT || B.scores.confidence < MIN_CONFIDENCE_FOR_VERDICT) {
    verdict = "inconclusive";
    verdictCode = "lowConfidence";
    reason = "Measurement confidence is too low for a conclusive result (image quality, pose or expression).";
  } else if (Math.abs(diff as number) <= mOverall) {
    verdict = "draw";
    verdictCode = "draw";
    verdictParams = { diff: Math.abs(diff as number), margin: mOverall };
    reason = `The overall difference (${Math.abs(diff as number).toFixed(1)} points) lies within the measurement uncertainty (±${mOverall.toFixed(1)}).`;
  } else {
    verdict = (diff as number) > 0 ? "B" : "A";
    verdictCode = "winner";
    verdictParams = { diff: Math.abs(diff as number), margin: mOverall };
    reason = `Overall difference of ${Math.abs(diff as number).toFixed(1)} points exceeds the uncertainty margin of ±${mOverall.toFixed(1)}.`;
  }

  // key differences by harmony index delta among ratios available on both sides
  const keyDifferences: KeyDifference[] = [];
  for (const ra of A.ratios) {
    const rb = B.ratios.find((r) => r.id === ra.id);
    if (!rb || ra.availability !== "available" || rb.availability !== "available" || ra.index == null || rb.index == null) continue;
    const delta = rb.index - ra.index;
    if (Math.abs(delta) < 5) continue;
    keyDifferences.push({ ratioId: ra.id, a: ra.value, b: rb.value, indexA: ra.index, indexB: rb.index, delta, favours: delta > 0 ? "B" : "A" });
  }
  keyDifferences.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const top = keyDifferences.slice(0, 6);

  const winnerLabel = verdict === "A" ? "Person 1" : verdict === "B" ? "Person 2" : null;
  const summaryParts: string[] = [];
  if (winnerLabel) summaryParts.push(`${winnerLabel} wins the battle ${verdict === "A" ? `${overallA!.toFixed(1)} : ${overallB!.toFixed(1)}` : `${overallB!.toFixed(1)} : ${overallA!.toFixed(1)}`}.`);
  else if (verdict === "draw") summaryParts.push(`Draw — ${overallA!.toFixed(1)} : ${overallB!.toFixed(1)} is within the uncertainty margin.`);
  else summaryParts.push("No conclusive result.");
  summaryParts.push(`Rounds: ${roundWinsA} – ${roundWinsB} (${roundDraws} drawn).`);
  if (top.length) {
    summaryParts.push(
      "Decisive ratios: " +
        top
          .slice(0, 3)
          .map((k) => `${RATIO_BY_ID[k.ratioId].abbreviation} favours ${k.favours === "A" ? "Person 1" : "Person 2"} (${k.delta > 0 ? "+" : ""}${k.delta.toFixed(0)})`)
          .join("; ") +
        ".",
    );
  }

  return {
    engineVersion: ENGINE_VERSION,
    rounds,
    roundWinsA,
    roundWinsB,
    roundDraws,
    overallA,
    overallB,
    diff,
    margin: mOverall,
    verdict,
    verdictReason: reason,
    verdictCode,
    verdictParams,
    coverageA: covA,
    coverageB: covB,
    confidenceA: A.scores.confidence,
    confidenceB: B.scores.confidence,
    keyDifferences: top,
    summary: summaryParts.join(" "),
  };
}

export type { CategoryId };
