/** Plain-text report in the mandatory analysis format (used for copy/export and the result page). */
import { pslBand } from "@/engine/psl/bands";
import { formatPsl, type RatingResult } from "@/engine/psl/rating";
import { isFrontOnlyRubric, MIN_SCORABLE_COVERAGE } from "@/engine/psl/rubric";
import { formatTierRange } from "@/engine/psl/scale";
import type { Lang } from "@/lib/i18n";
import { areaName, criterionName } from "@/lib/i18n/psl-texts";

type T = (key: string, vars?: Record<string, string | number>) => string;

export function reportLines(r: RatingResult, label: string, lang: Lang, t: T) {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const areas = r.areas.filter((a) => a.score != null).map((a) => `${areaName(a.id, lang)} ${formatPsl(a.score)}`).join(", ");
  const front = isFrontOnlyRubric(r.rubricVersion);
  const reasoning = r.score == null
    ? r.warningCodes.includes("insufficientData")
      ? t("rater.result.reasoningInsufficient", { coverage: pct(r.coverage), min: pct(MIN_SCORABLE_COVERAGE) })
      : t("rater.result.reasoningInvalid")
    : t("rater.result.reasoningText", { n: r.criteria.filter((c) => c.assessable).length, coverage: pct(r.coverage), score: formatPsl(r.score), scale: r.scale.name, rubric: `${t("rater.result.rubric")} ${r.rubricVersion}`, tier: r.tier?.name ?? "—", range: r.tier ? formatTierRange(r.tier) : "—", areas });
  const strengths = r.strengths.length ? r.strengths.map((s) => t("rater.result.strengthLine", { name: criterionName(s.id, lang), score: formatPsl(s.score), source: t(`rater.result.source.${r.criteria.find((c) => c.id === s.id)?.source ?? "frontal"}`) })) : [t("rater.result.noneAbove")];
  const lower = r.lowerRated.length ? r.lowerRated.map((s) => t("rater.result.lowerLine", { name: criterionName(s.id, lang), score: formatPsl(s.score), source: t(`rater.result.source.${r.criteria.find((c) => c.id === s.id)?.source ?? "frontal"}`) })) : [t("rater.result.noneBelow")];
  const provisional = r.provisional ? t("rater.result.provisionalText", { min: pct(r.minCoverage) }) : "";
  const usedWeight = r.areas.filter((a) => a.score != null).reduce((sum, a) => sum + a.weight, 0);
  const totalWeight = r.areas.reduce((sum, a) => sum + a.weight, 0);
  const overall = (front
    ? t("rater.result.overallTextFront", {
        weights: r.areas.map((a) => `${areaName(a.id, lang)} ${a.weight} %`).join(", "),
        renorm: r.score != null && usedWeight < totalWeight - 1e-9 ? t("rater.result.renormNote", { used: Math.round(usedWeight) }) : "",
        min: pct(MIN_SCORABLE_COVERAGE),
        provisional,
      })
    : r.aggregation
      ? t("rater.result.overallText", { p: r.aggregation.p, penalty: (r.aggregation.compensationPenalty ?? 0).toFixed(1), provisional })
      : t("rater.result.overallTextV1", { provisional })).trim();
  const quality = t(front ? "rater.result.qualityLine" : "rater.result.qualityLineV2", { level: t(`quality.${r.quality.frontalLevel}`), issues: r.quality.frontalIssues, side: r.quality.sideUsed ? t("rater.result.used") : t("rater.result.notUsed"), visual: r.quality.visualUsed ? t("rater.result.used") : t("rater.result.notUsed"), hairline: r.quality.hairline ? t("rater.result.present") : t("rater.result.missing") });
  const assessable = r.criteria.filter((c) => c.assessable).map((c) => criterionName(c.id, lang));
  const notAssessable = r.notAssessable.map((n) => `${criterionName(n.id, lang)} (${t(`rater.result.reason.${n.code}`)})`);
  const warnings = r.warningCodes.map((w) => t(`rater.result.warning.${w}`));
  const band = front ? pslBand(r.score) : null;
  const legacy = front ? null : t("rater.result.legacyNote", { v: r.rubricVersion });
  return { reasoning, strengths, lower, overall, quality, assessable, notAssessable, warnings, front, band: band ? t(`rater.result.band.${band}`) : null, legacy };
}

export function buildReportText(r: RatingResult, label: string, lang: Lang, t: T): string {
  const L = reportLines(r, label, lang, t);
  const lines: string[] = [];
  lines.push(`${label} — ${t("rater.result.title")} (${t("rater.result.rubric")} ${r.rubricVersion}, ${t("rater.result.scaleUsed")}: ${r.scale.name} v${r.scale.version})`);
  lines.push("");
  const d = r.displayDecimals ?? 1;
  lines.push(`${L.front ? t("rater.result.frontLabel") : t("rater.result.legacyScoreLabel")}: ${r.score == null ? "—" : `${formatPsl(r.score, d)}${r.scoreSigma != null ? ` ± ${r.scoreSigma.toFixed(Math.max(d, 1))}` : ""} / ${r.scale.rangeMax}`}${r.provisional ? ` (${t("rater.result.provisional")})` : ""}`);
  lines.push(`Tier: ${r.tier ? `${r.tier.name} (${formatTierRange(r.tier)})` : "—"}`);
  if (L.band) lines.push(`${t("rater.result.bandTitle")}: ${L.band}`);
  lines.push(L.front ? t("rater.result.frontNote") : L.legacy!);
  lines.push("");
  lines.push(`${t("rater.result.reasoning")}:`);
  lines.push(L.reasoning);
  lines.push("");
  lines.push(`${t("rater.result.strengths")}:`);
  for (const s of L.strengths) lines.push(`- ${s}`);
  lines.push("");
  lines.push(`${t("rater.result.lowerRated")}:`);
  for (const s of L.lower) lines.push(`- ${s}`);
  lines.push("");
  lines.push(`${t("rater.result.overallAssessment")}:`);
  lines.push(L.overall);
  lines.push("");
  lines.push(`${t("rater.result.analysisQuality")}:`);
  lines.push(`- ${L.quality}`);
  lines.push(`- ${t("rater.result.assessable")} (${L.assessable.length}): ${L.assessable.join(", ")}`);
  lines.push(`- ${t("rater.result.notAssessable")} (${L.notAssessable.length}): ${L.notAssessable.join("; ") || "—"}`);
  if (L.warnings.length) lines.push(`- ${t("rater.result.limitations")}: ${L.warnings.join(" ")}`);
  lines.push("");
  lines.push(`${t("rater.result.disclaimer")}:`);
  lines.push(t("rater.result.disclaimerText"));
  return lines.join("\n");
}
