"use client";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/controls";
import { formatT1, formatValue } from "@/engine/explain";
import { ADDITIONAL_BY_ID, RATIO_BY_ID } from "@/engine/ratios/database";
import { checkTargets, type TargetCheck } from "@/engine/synth/ideal";
import type { AdditionalMeasurementId, AnalysisResult, RatioId } from "@/engine/types";
import { runIdealExample, type IdealExampleResult, type IdealIteration } from "@/lib/ideal-example";
import { useT } from "@/lib/i18n";
import { additionalText, ratioText } from "@/lib/i18n/ratio-texts";
import { cn } from "@/lib/utils";

const unitOf = (c: TargetCheck) => (c.kind === "ratio" ? RATIO_BY_ID[c.id as RatioId].unit : c.id === "FIFTHS" ? "percent" : "ratio");
const fmtV = (c: TargetCheck, v: number | null) => (v == null ? "—" : c.id === "FIFTHS" ? `${v.toFixed(1)} pp` : formatValue(v, unitOf(c) as "percent" | "ratio" | "degrees"));
const rangeOf = (c: TargetCheck) => (c.id === "FIFTHS" ? "0 pp (Gauss, s = 3 pp)" : formatT1({ t1: c.range, unit: unitOf(c) as "percent" | "ratio" | "degrees" }));

/** "IDEALBEISPIEL ANSEHEN": model-driven reference geometry, rendered and re-measured (closed loop). */
export function IdealExampleButton({ compare, size = "sm" }: { compare?: AnalysisResult | null; size?: "sm" | "md" }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<IdealExampleResult | null>(null);
  const [progress, setProgress] = useState<IdealIteration[]>([]);

  const start = useCallback(async () => {
    setOpen(true);
    if (res || busy) return;
    setBusy(true);
    setError(null);
    setProgress([]);
    try {
      const r = await runIdealExample({ iterations: 6, damping: 0.4, onProgress: (it) => setProgress((p) => [...p, it]) });
      setRes(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [res, busy]);

  const yours = compare ? checkTargets(compare) : null;
  const name = (c: TargetCheck) => (c.kind === "ratio" ? ratioText(c.id as RatioId, lang).name : additionalText(c.id as AdditionalMeasurementId, lang).name ?? ADDITIONAL_BY_ID[c.id as AdditionalMeasurementId].name);
  const its = res?.iterations ?? progress;

  return (
    <>
      <Button size={size} variant="outline" onClick={start} data-testid="ideal-open">
        <Sparkles size={14} /> {t("ideal.open")}
      </Button>
      {open && createPortal(<Dialog open={open} onClose={() => setOpen(false)} title={t("ideal.title")} wide>
        <div className="space-y-4 text-sm" data-testid="ideal-dialog">
          <div className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs text-fg-1 flex gap-2">
            <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{t("ideal.disclaimer")}</p>
              <p className="text-fg-2">{t("ideal.notPhotoreal")}</p>
            </div>
          </div>
          {busy && (
            <div className="flex items-center gap-2 text-fg-2" data-testid="ideal-busy">
              <Loader2 size={16} className="animate-spin" /> {t("ideal.running", { n: progress.length })}
            </div>
          )}
          {error && <div className="text-[#ff8fa3]">{error}</div>}
          {res && (
            <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="space-y-3">
                {res.redetected ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={res.redetected.imageDataUrl} alt={t("ideal.imageAlt")} className="w-full rounded-xl border border-line" data-testid="ideal-image" />
                ) : (
                  <div className="rounded-xl border border-line p-4 text-fg-2">{t("ideal.notDetected")}</div>
                )}
                <div className="rounded-xl border border-line p-3 text-xs space-y-1" data-testid="ideal-loop">
                  <div className="font-medium text-fg-1">{t("ideal.loop")}</div>
                  <div className="-mx-1 overflow-x-auto px-1"><table className="w-full">
                    <thead className="text-fg-3">
                      <tr><th className="text-left">#</th><th className="text-right">{t("ideal.residual")}</th><th className="text-right">{t("ideal.inRange")}</th><th className="text-right">Σz²</th></tr>
                    </thead>
                    <tbody>
                      {its.map((it) => (
                        <tr key={it.iteration} className={cn(it.iteration === res.bestIteration && "text-mint")}>
                          <td>{it.iteration}</td>
                          <td className="text-right font-mono">{it.detected ? `${(it.residualMean! * 100).toFixed(2)} / ${(it.residualMax! * 100).toFixed(1)} %` : t("ideal.notDetectedShort")}</td>
                          <td className="text-right font-mono">{it.detected ? `${it.inRange}/${it.total}` : "—"}</td>
                          <td className="text-right font-mono">{it.misfit?.toFixed(2) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                  <p className="text-fg-3">{t("ideal.loopNote")}</p>
                  {res.redetected && res.bestIteration != null && <p className="text-fg-2">{t("ideal.gap", { r: ((res.iterations[res.bestIteration].residualMean ?? 0) * 100).toFixed(1) })}</p>}
                </div>
                <div className="text-xs text-fg-3">{t("ideal.stats", { iter: res.stats.iterations, mean: (res.stats.meanDisplacementIpd * 100).toFixed(1), max: (res.stats.maxDisplacementIpd * 100).toFixed(1), rubric: res.rubricVersion })}</div>
              </div>
              <div className="overflow-x-auto">
                <div className="flex flex-wrap gap-2 mb-2 text-xs">
                  <Badge tone="mint">{t("ideal.geometric")}: {res.geometric.checks.filter((c) => c.inRange).length}/{res.geometric.checks.length}</Badge>
                  {res.redetected && <Badge tone="cyan" data-testid="ideal-redetected-count">{t("ideal.redetected")}: {res.redetected.checks.filter((c) => c.inRange).length}/{res.redetected.checks.length}</Badge>}
                  {res.redetected && <Badge tone="accent">{t("ideal.overall")}: {((res.redetected.analysis.scores.overall ?? 0) / 10).toFixed(1)}</Badge>}
                </div>
                <div className="-mx-1 overflow-x-auto px-1"><table className="w-full text-xs" data-testid="ideal-table">
                  <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="text-left py-1.5">{t("ideal.col.measure")}</th>
                      <th className="text-right py-1.5">{t("ideal.col.target")}</th>
                      <th className="text-right py-1.5">{t("ideal.col.geometric")}</th>
                      <th className="text-right py-1.5">{t("ideal.col.redetected")}</th>
                      <th className="text-right py-1.5">{t("ideal.col.deviation")}</th>
                      {yours && <th className="text-right py-1.5">{t("ideal.col.yours")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {res.geometric.checks.map((g, i) => {
                      const r = res.redetected?.checks[i];
                      const y = yours?.[i];
                      return (
                        <tr key={g.key} className="border-t border-line">
                          <td className="py-1 pr-2"><div className="text-fg-1">{name(g)}</div><div className="text-[10px] font-mono text-fg-3">{g.id}</div></td>
                          <td className="py-1 text-right font-mono whitespace-nowrap">{rangeOf(g)}</td>
                          <td className={cn("py-1 text-right font-mono", g.inRange ? "text-mint" : "text-amber")}>{fmtV(g, g.value)}</td>
                          <td className={cn("py-1 text-right font-mono", r?.inRange ? "text-mint" : "text-amber")}>{r ? fmtV(r, r.value) : "—"}</td>
                          <td className="py-1 text-right font-mono">{r?.z == null ? "—" : r.z === 0 ? "0" : `${r.z > 0 ? "+" : ""}${r.z.toFixed(2)} s`}</td>
                          {yours && <td className={cn("py-1 text-right font-mono", y?.inRange ? "text-mint" : "text-fg-2")}>{y ? `${fmtV(y, y.value)}${y.z ? ` (${y.z > 0 ? "+" : ""}${y.z.toFixed(1)} s)` : ""}` : "—"}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
                <p className="text-[11px] text-fg-3 mt-2">{t("ideal.tableNote")}</p>
              </div>
            </div>
          )}
          {res && (
            <ul className="text-[11px] text-fg-3 list-disc pl-5 space-y-0.5">
              {(t("ideal.limitations") as string).split("|").map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </div>
      </Dialog>, document.body)}
    </>
  );
}
