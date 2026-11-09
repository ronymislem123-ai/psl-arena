"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { TierBadge } from "@/components/psl/tier-badge";
import { FaceThumb } from "@/components/shared/face-thumb";
import { Badge, levelTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/controls";
import { compareRatings, type CompareItem } from "@/engine/psl/compare";
import { formatPsl } from "@/engine/psl/rating";
import { RUBRIC_AREAS } from "@/engine/psl/rubric";
import { useT } from "@/lib/i18n";
import { areaName, criterionName } from "@/lib/i18n/psl-texts";
import { cn, fmt } from "@/lib/utils";
import type { RatingRecord } from "@/server/repos-psl";
import { paths } from "@/lib/paths";

const signed = (v: number | null) => (v == null ? "—" : fmt.signed(v, 2));
const deltaClass = (v: number | null) => (v == null || Math.abs(v) < 0.05 ? "text-fg-3" : v > 0 ? "text-mint" : "text-[#ff8fa3]");

export function CompareView({ records }: { records: RatingRecord[] }) {
  const { t, lang } = useT();
  const [commonOnly, setCommonOnly] = useState(false);
  const items: CompareItem[] = useMemo(() => records.map((r) => ({ id: r.id, label: r.profileLabel, createdAt: r.createdAt, result: r.result })), [records]);
  const c = useMemo(() => compareRatings(items), [items]);
  const rows = commonOnly ? c.criteria.filter((r) => r.common) : c.criteria;
  return (
    <div className="space-y-6" data-testid="compare-view">
      <PageHeader
        kicker={t("navPsl.rater")}
        title={t("compare.title")}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <Badge tone={c.comparable ? "mint" : "amber"}>{c.comparable ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {c.comparable ? t(c.warnings.length ? "compare.comparableWithNotes" : "compare.comparable") : t("compare.notComparable")}</Badge>
            <Badge tone="cyan">{t("compare.commonCriteria", { n: c.commonCriteria })}</Badge>
          </span>
        }
        action={
          <div className="flex gap-2 print:hidden">
            <Link href="/compare"><Button variant="outline" size="sm">{t("compare.pick")}</Button></Link>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={14} /> {t("compare.print")}</Button>
          </div>
        }
      />
      {c.warnings.length > 0 && (
        <Card>
          <CardBody className="pt-4">
            <ul className="space-y-1 text-sm" data-testid="compare-warnings">
              {c.warnings.map((w) => (
                <li key={w.code} className="flex gap-2 text-amber"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span className="text-fg-1">{t(`compare.warning.${w.code}`, w.params ?? {})}</span></li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card strong>
        <CardBody className="pt-5 overflow-x-auto">
          <table className="w-full text-sm" data-testid="compare-header">
            <thead>
              <tr>
                <th className="text-left py-2 w-44"></th>
                {c.items.map((it, i) => (
                  <th key={it.id} className="text-left py-2 align-top">
                    <div className="flex items-center gap-2">
                      <FaceThumb imageId={records[i].profileImageId} label={it.label} size={40} />
                      <div className="min-w-0">
                        <Link href={paths.rating(it.id)} className="font-medium hover:text-accent block truncate">{it.label}</Link>
                        <div className="text-[11px] text-fg-3 font-normal">{fmt.date(it.createdAt, lang)}{i === 0 ? ` · ${t("compare.reference")}` : ""}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("rater.result.score")}</td>{c.items.map((it, i) => <td key={it.id} className="py-2"><span className="font-display text-2xl num">{formatPsl(it.score)}</span> <span className={cn("font-mono text-xs", deltaClass(c.scoreDeltas[i]))}>{i > 0 ? signed(c.scoreDeltas[i]) : ""}</span></td>)}</tr>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("rater.result.tier")}</td>{c.items.map((it) => <td key={it.id} className="py-2"><TierBadge tier={it.tierName ? { id: it.id, name: it.tierName, min: 0, max: 0, color: it.tierColor ?? "#9db6ff" } : null} size="sm" /> <span className="text-[11px] text-fg-3">{it.scaleName} v{it.scaleVersion}</span></td>)}</tr>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("rater.result.rubric")} / {t("common.engine")}</td>{c.items.map((it) => <td key={it.id} className="py-2 font-mono text-xs">{it.rubricVersion} / {it.engineVersion}</td>)}</tr>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("rater.result.coverage")} / {t("rater.result.confidence")}</td>{c.items.map((it) => <td key={it.id} className="py-2 font-mono text-xs">{Math.round(it.coverage * 100)} % / {fmt.pct(it.confidence)} {it.provisional && <Badge tone="amber" className="ml-1">{t("rater.result.provisional")}</Badge>}{!it.valid && !it.provisional && <Badge tone="rose" className="ml-1">{t("rater.result.invalid")}</Badge>}</td>)}</tr>
              <tr className="border-t border-line"><td className="py-2 text-fg-2">{t("compare.quality")} / {t("compare.sideView")}</td>{c.items.map((it) => <td key={it.id} className="py-2 text-xs"><Badge tone={levelTone(it.quality)}>{t(`quality.${it.quality}`)}</Badge> <span className="text-fg-2">{it.sideUsed ? t("common.yes") : t("common.no")}</span></td>)}</tr>
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("compare.gains")} />
          <CardBody>{c.gains.length ? <ul className="space-y-1 text-sm">{c.gains.map((g) => <li key={g.id} className="flex justify-between"><span>{criterionName(g.id, lang)}</span><span className="font-mono text-mint">{signed(g.deltas[g.deltas.length - 1])}</span></li>)}</ul> : <div className="text-xs text-fg-3">{t("compare.none")}</div>}</CardBody>
        </Card>
        <Card>
          <CardHeader title={t("compare.losses")} />
          <CardBody>{c.losses.length ? <ul className="space-y-1 text-sm">{c.losses.map((g) => <li key={g.id} className="flex justify-between"><span>{criterionName(g.id, lang)}</span><span className="font-mono text-[#ff8fa3]">{signed(g.deltas[g.deltas.length - 1])}</span></li>)}</ul> : <div className="text-xs text-fg-3">{t("compare.none")}</div>}</CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("compare.areas")} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="compare-areas">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">{t("compare.areas")}</th>{c.items.map((it, i) => <th key={it.id} className="text-right py-2">{i === 0 ? `${it.label} · ${t("compare.reference")}` : `${it.label} · Δ`}</th>)}<th className="text-right py-2">{t("compare.spread")}</th></tr></thead>
            <tbody>
              {c.areas.map((a) => (
                <tr key={a.id} className="border-t border-line"><td className="py-1.5">{areaName(a.id, lang)}</td>{a.values.map((v, i) => <td key={i} className="py-1.5 text-right font-mono num">{formatPsl(v)} {i > 0 && <span className={cn("text-xs", deltaClass(a.deltas[i]))}>({signed(a.deltas[i])})</span>}</td>)}<td className="py-1.5 text-right font-mono text-xs text-fg-3">{a.spread == null ? "—" : a.spread.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("compare.criteria")} action={<Toggle checked={commonOnly} onChange={setCommonOnly} label={t("compare.commonOnly")} />} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="compare-criteria">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">{t("compare.criteria")}</th>{c.items.map((it, i) => <th key={it.id} className="text-right py-2">{i + 1}</th>)}<th className="text-right py-2">{t("compare.spread")}</th></tr></thead>
            <tbody>
              {RUBRIC_AREAS.flatMap((area) => rows.filter((r) => r.area === area)).map((r) => (
                <tr key={r.id} className={cn("border-t border-line", !r.common && "opacity-60")}><td className="py-1.5"><span>{criterionName(r.id, lang)}</span> <span className="text-[10px] text-fg-3">{areaName(r.area, lang)}</span></td>{r.values.map((v, i) => <td key={i} className="py-1.5 text-right font-mono num">{formatPsl(v)} {i > 0 && v != null && r.values[0] != null && <span className={cn("text-xs", deltaClass(r.deltas[i]))}>({signed(r.deltas[i])})</span>}</td>)}<td className="py-1.5 text-right font-mono text-xs text-fg-3">{r.spread == null ? "—" : r.spread.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export function ComparePicker({ ratings, preselect = [] }: { ratings: { id: string; profileLabel: string; createdAt: string; score: number | null; scaleName: string; tierName: string | null }[]; preselect?: string[] }) {
  const { t, lang } = useT();
  const [sel, setSel] = useState<string[]>(() => preselect.filter((id) => ratings.some((r) => r.id === id)).slice(0, 4));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.rater")} title={t("compare.title")} subtitle={t("compare.sub")} />
      <Card>
        <CardHeader title={t("compare.pick")} subtitle={t("compare.pickHint")} action={<Link href={sel.length >= 2 ? `/compare?ids=${sel.join(",")}` : "#"} aria-disabled={sel.length < 2}><Button disabled={sel.length < 2} data-testid="compare-go">{t("compare.go")} ({sel.length})</Button></Link>} />
        <CardBody>
          {ratings.length < 2 ? (
            <div className="text-sm text-fg-3">{t("compare.empty")}</div>
          ) : (
            <ul className="divide-y divide-line" data-testid="compare-picker">
              {ratings.map((r) => (
                <li key={r.id}>
                  <label className="flex items-center gap-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[#4f7cff]" />
                    <span className="min-w-0 flex-1 truncate">{r.profileLabel}</span>
                    <span className="text-xs text-fg-3">{fmt.date(r.createdAt, lang)} · {r.scaleName} · {r.tierName ?? "—"}</span>
                    <span className="font-mono num">{formatPsl(r.score)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
