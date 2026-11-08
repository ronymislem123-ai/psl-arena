"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { FaceThumb } from "@/components/shared/face-thumb";
import { Badge, levelTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/controls";
import { compareAnalyses, type AnalysisCompareItem } from "@/engine/psl/compare";
import { formatValue } from "@/engine/explain";
import { RATIO_BY_ID, CATEGORY_META } from "@/engine/ratios/database";
import type { RatioId } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { symmetryMetricLabelById } from "@/lib/i18n/engine-text";
import { categoryText, ratioText } from "@/lib/i18n/ratio-texts";
import { cn, fmt } from "@/lib/utils";
import type { AnalysisRecord } from "@/server/repos";
import { paths } from "@/lib/paths";

const signed = (v: number | null, digits = 1) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}`);
const dc = (v: number | null, eps = 0.5) => (v == null || Math.abs(v) < eps ? "text-fg-3" : v > 0 ? "text-mint" : "text-[#ff8fa3]");
const f1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));

export function AnalysesCompareView({ records }: { records: AnalysisRecord[] }) {
  const { t, lang } = useT();
  const [commonOnly, setCommonOnly] = useState(false);
  const items: AnalysisCompareItem[] = useMemo(() => records.map((r) => ({ id: r.id, label: r.profileLabel, createdAt: r.createdAt, result: r.result })), [records]);
  const c = useMemo(() => compareAnalyses(items), [items]);
  const rows = commonOnly ? c.ratios.filter((r) => r.common) : c.ratios;
  const last = c.items.length - 1;
  const scoreLabel: Record<string, string> = { overall: t("common.overall"), proportion: t("analysis.proportion"), harmony: t("analysis.harmony"), structure: t("analysis.structure"), symmetry: t("analysis.symmetryScore") };
  return (
    <div className="space-y-6" data-testid="analyses-compare-view">
      <PageHeader
        kicker={t("nav.analysis")}
        title={t("compareAnalyses.title")}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <Badge tone={c.comparable ? "mint" : "amber"}>{c.comparable ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {c.comparable ? t("compareAnalyses.comparable") : t("compareAnalyses.notComparable")}</Badge>
            <Badge tone="cyan">{t("compareAnalyses.commonRatios", { n: c.commonRatios })}</Badge>
          </span>
        }
        action={
          <div className="flex gap-2 print:hidden">
            <Link href="/compare?mode=analyses"><Button variant="outline" size="sm">{t("compareAnalyses.pick")}</Button></Link>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={14} /> {t("compare.print")}</Button>
          </div>
        }
      />
      {c.warnings.length > 0 && (
        <Card>
          <CardBody className="pt-4">
            <ul className="space-y-1 text-sm" data-testid="analyses-warnings">
              {c.warnings.map((w) => <li key={w.code} className="flex gap-2 text-amber"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span className="text-fg-1">{t(`compareAnalyses.warning.${w.code}`, w.params ?? {})}</span></li>)}
            </ul>
          </CardBody>
        </Card>
      )}
      <Card strong>
        <CardBody className="pt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 w-44"></th>
                {c.items.map((it, i) => (
                  <th key={it.id} className="text-left py-2 align-top">
                    <div className="flex items-center gap-2">
                      <FaceThumb imageId={records[i].imageId} label={it.label} size={40} />
                      <div className="min-w-0"><Link href={paths.analysis(it.id)} className="font-medium hover:text-accent block truncate">{it.label}</Link><div className="text-[11px] text-fg-3 font-normal">{fmt.date(it.createdAt, lang)}{i === 0 ? ` · ${t("compare.reference")}` : ""}</div></div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.scores.map((s) => (
                <tr key={s.id} className="border-t border-line"><td className="py-2 text-fg-2">{scoreLabel[s.id]}</td>{s.values.map((v, i) => <td key={i} className="py-2"><span className={cn("font-mono num", s.id === "overall" && "font-display text-xl")}>{f1(v)}</span> {i > 0 && <span className={cn("font-mono text-xs", dc(s.deltas[i]))}>{signed(s.deltas[i])}</span>}</td>)}</tr>
              ))}
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("common.engine")} / {t("common.quality")}</td>{c.items.map((it) => <td key={it.id} className="py-2 text-xs"><span className="font-mono">{it.engineVersion}</span> <Badge tone={levelTone(it.quality)}>{t(`quality.${it.quality}`)}</Badge></td>)}</tr>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("common.coverage")} / {t("common.confidence")}</td>{c.items.map((it) => <td key={it.id} className="py-2 font-mono text-xs">{it.evaluable}/{it.total} · {fmt.pct(it.confidence)}</td>)}</tr>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("compareAnalyses.hairline")} / {t("battle.captureDistance")}</td>{c.items.map((it) => <td key={it.id} className="py-2 text-xs text-fg-2">{it.hairline ? t("common.yes") : t("common.no")} · {t(`battle.capture${it.captureDistance.charAt(0).toUpperCase()}${it.captureDistance.slice(1)}`)}{it.includeReconstructed ? "" : ` · ${t("analysis.excluded")}`}</td>)}</tr>
            </tbody>
          </table>
        </CardBody>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title={t("compareAnalyses.gains")} /><CardBody>{c.gains.length ? <ul className="space-y-1 text-sm">{c.gains.map((g) => <li key={g.id} className="flex justify-between"><span>{g.number}. {ratioText(g.id, lang).name}</span><span className="font-mono text-mint">{signed(g.indexDeltas[last], 0)}</span></li>)}</ul> : <div className="text-xs text-fg-3">{t("compare.none")}</div>}</CardBody></Card>
        <Card><CardHeader title={t("compareAnalyses.losses")} /><CardBody>{c.losses.length ? <ul className="space-y-1 text-sm">{c.losses.map((g) => <li key={g.id} className="flex justify-between"><span>{g.number}. {ratioText(g.id, lang).name}</span><span className="font-mono text-[#ff8fa3]">{signed(g.indexDeltas[last], 0)}</span></li>)}</ul> : <div className="text-xs text-fg-3">{t("compare.none")}</div>}</CardBody></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("compareAnalyses.categories")} />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="analyses-categories">
              <tbody>{c.categories.map((row) => <tr key={row.id} className="border-t border-line first:border-t-0"><td className="py-1.5">{categoryText(row.id, lang).label || CATEGORY_META[row.id].label}</td>{row.values.map((v, i) => <td key={i} className="py-1.5 text-right font-mono num">{f1(v)} {i > 0 && <span className={cn("text-xs", dc(row.deltas[i]))}>({signed(row.deltas[i])})</span>}</td>)}</tr>)}</tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("compareAnalyses.symmetry")} />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="analyses-symmetry">
              <tbody>{c.symmetryMetrics.map((row) => <tr key={row.id} className="border-t border-line first:border-t-0"><td className="py-1.5">{symmetryMetricLabelById(row.id, lang, row.id)}</td>{row.values.map((v, i) => <td key={i} className="py-1.5 text-right font-mono num">{f1(v)} {i > 0 && <span className={cn("text-xs", dc(row.deltas[i]))}>({signed(row.deltas[i])})</span>}</td>)}</tr>)}</tbody>
            </table>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title={t("compareAnalyses.ratios")} action={<Toggle checked={commonOnly} onChange={setCommonOnly} label={t("compare.commonOnly")} />} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="analyses-ratios">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">#</th><th className="text-left py-2">{t("analysis.columns.ratio")}</th>{c.items.map((it, i) => <th key={it.id} className="text-right py-2">{i + 1} · {t("compareAnalyses.value")} / {t("compareAnalyses.index")}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-t border-line", !r.common && "opacity-60")} data-testid={`ratio-row-${r.id}`}>
                  <td className="py-1.5 font-mono text-xs text-fg-3">{r.number}</td>
                  <td className="py-1.5"><span>{ratioText(r.id as RatioId, lang).name}</span> <span className="text-[10px] text-fg-3">{RATIO_BY_ID[r.id].abbreviation}</span></td>
                  {r.values.map((v, i) => (
                    <td key={i} className="py-1.5 text-right font-mono num whitespace-nowrap">
                      <span className={cn(r.inT1[i] === true && "text-mint", r.inT1[i] === false && "text-amber")}>{v == null ? "—" : formatValue(v, r.unit as "percent" | "ratio" | "degrees")}</span>
                      <span className="text-fg-3"> / {r.indices[i] == null ? "—" : r.indices[i]!.toFixed(0)}</span>
                      {i > 0 && r.indexDeltas[i] != null && <span className={cn("text-xs ml-1", dc(r.indexDeltas[i], 1))}>({signed(r.indexDeltas[i], 0)})</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
