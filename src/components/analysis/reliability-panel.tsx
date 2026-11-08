"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { analysisReliability, RELIABILITY_LEVELS, type MeasureQualityRow, type ReliabilityLevel } from "@/engine/quality/reliability";
import type { AdditionalMeasurementId, AnalysisResult, RatioId } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { symmetryMetricLabelById } from "@/lib/i18n/engine-text";
import { additionalText, landmarkLabel, ratioText } from "@/lib/i18n/ratio-texts";
import { cn, fmt } from "@/lib/utils";

const LEVEL_TONE: Record<ReliabilityLevel, "mint" | "cyan" | "amber" | "rose" | "muted"> = { veryHigh: "mint", high: "cyan", moderate: "amber", low: "rose", notEvaluable: "muted" };
const LEVEL_BAR: Record<ReliabilityLevel, string> = { veryHigh: "bg-mint", high: "bg-cyan", moderate: "bg-amber", low: "bg-rose", notEvaluable: "bg-fg-3" };
const GRADE_TONE: Record<string, "mint" | "cyan" | "amber" | "rose"> = { A: "mint", B: "cyan", C: "amber", D: "rose" };

/** Five-level analysis reliability and the per-measurement detection-quality table (engine 2.0). */
export function ReliabilityPanel({ result, className }: { result: AnalysisResult; className?: string }) {
  const { t, lang } = useT();
  const rel = useMemo(() => analysisReliability(result), [result]);
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? rel.rows : rel.rows.filter((r) => r.status !== "unavailable");
  const name = (r: MeasureQualityRow) =>
    r.kind === "ratio" ? ratioText(r.id as RatioId, lang).name : r.kind === "additional" ? additionalText(r.id as AdditionalMeasurementId, lang).name : symmetryMetricLabelById(r.id, lang, result.symmetry.metrics.find((m) => m.id === r.id)?.label ?? r.id);
  const param = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  return (
    <div className={cn("space-y-5", className)}>
      <Card data-testid="reliability-panel">
        <CardHeader title={t("analysis.reliability.title")} subtitle={t("analysis.reliability.sub")} action={<Badge tone={LEVEL_TONE[rel.level]} data-testid="reliability-level">{t(`analysis.reliability.level.${rel.level}`)}</Badge>} />
        <CardBody className="space-y-4">
          <div>
            <div className="grid grid-cols-5 gap-1.5" aria-hidden>
              {RELIABILITY_LEVELS.map((l) => <div key={l} className={cn("h-2 rounded-full", l === rel.level ? LEVEL_BAR[l] : "bg-white/8")} />)}
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-[10px] text-fg-3 text-center mt-1">{RELIABILITY_LEVELS.map((l) => <div key={l} className={l === rel.level ? "text-fg-1" : ""}>{t(`analysis.reliability.level.${l}`)}</div>)}</div>
          </div>
          {rel.sigmaPsl != null && rel.interval95 && <p className="text-sm text-fg-1">{t("analysis.reliability.interval", { sigma: rel.sigmaPsl.toFixed(2), lo: rel.interval95[0].toFixed(1), hi: rel.interval95[1].toFixed(1) })}</p>}
          <ul className="space-y-1 text-xs">
            {rel.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-fg-2">
                <span className={r.code !== "sigma" && r.cap ? "text-amber" : "text-fg-3"}>•</span>
                <span>
                  {t(`analysis.reliability.reason.${r.code}`, Object.fromEntries(Object.entries(r.params ?? {}).map(([k, v]) => [k, param(v)])))}
                  {r.cap && r.code !== "sigma" && r.code !== "unusable" && <span className="text-fg-3"> → {t("analysis.reliability.capped", { level: t(`analysis.reliability.level.${r.cap}`) })}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 text-xs">{(["A", "B", "C", "D"] as const).map((g) => <Badge key={g} tone={GRADE_TONE[g]}>{t("analysis.reliability.grade", { g, n: rel.counts[g] })}</Badge>)}</div>
          <p className="text-[11px] text-fg-3">{t("analysis.reliability.gradeNote")}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title={t("analysis.reliability.tableTitle")}
          subtitle={t("analysis.reliability.tableSub")}
          action={
            <label className="flex items-center gap-1.5 text-xs text-fg-2">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-[#4f7cff]" />
              {t("analysis.reliability.showUnavailable")}
            </label>
          }
        />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="measure-quality-table">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left py-2">{t("analysis.reliability.col.measure")}</th>
                <th className="text-right py-2">{t("analysis.reliability.col.value")}</th>
                <th className="text-center py-2">{t("analysis.reliability.col.detection")}</th>
                <th className="text-left py-2 pl-2">{t("analysis.reliability.col.weakest")}</th>
                <th className="text-right py-2">λ</th>
                <th className="text-right py-2">{t("common.confidence")}</th>
                <th className="text-left py-2 pl-3">{t("analysis.reliability.col.influences")}</th>
                <th className="text-left py-2 pl-3">{t("analysis.reliability.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="py-1.5 pr-2">
                    <div className="text-fg-1">{name(r)}</div>
                    <div className="text-[10px] text-fg-3 font-mono">{r.id}</div>
                  </td>
                  <td className="py-1.5 text-right font-mono num whitespace-nowrap">
                    {r.value == null ? "—" : r.value.toFixed(Math.abs(r.value) < 10 ? 3 : 1)}
                    {r.sigma != null && <span className="text-fg-3"> ±{r.sigma.toFixed(Math.abs(r.sigma) < 1 ? 3 : 1)}</span>}
                  </td>
                  <td className="py-1.5 text-center">{r.detection ? <Badge tone={GRADE_TONE[r.detection]}>{r.detection}</Badge> : "—"}</td>
                  <td className="py-1.5 pl-2 text-fg-2" title={r.weakest ? `${r.weakest.source} · ${r.weakest.precision}` : undefined}>
                    {r.weakest ? (
                      <>
                        {landmarkLabel(r.weakest.id, lang, r.weakest.id)} <span className="text-fg-3">{Math.round(r.weakest.confidence * 100)} %</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono">{r.reliability.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-mono">{r.status === "unavailable" ? "—" : fmt.pct(r.confidence)}</td>
                  <td className="py-1.5 pl-3">
                    <div className="flex flex-wrap gap-1">{r.influences.map((i) => <Badge key={i} tone="muted" className="text-[9px] px-1 py-0">{t(`analysis.reliability.influence.${i}`)}</Badge>)}</div>
                  </td>
                  <td className="py-1.5 pl-3 text-fg-2">{t(`analysis.reliability.status.${r.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
