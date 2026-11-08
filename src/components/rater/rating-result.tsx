"use client";
import { IdealExampleButton } from "@/components/ideal/ideal-example";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Copy, Download, Info, Printer, RefreshCw, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { ScaleBar, TierBadge } from "@/components/psl/tier-badge";
import { FaceThumb } from "@/components/shared/face-thumb";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/controls";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ui/score-ring";
import { formatPsl, type CriterionScore } from "@/engine/psl/rating";
import { CRITERION_BY_ID } from "@/engine/psl/rubric";
import { formatTierRange } from "@/engine/psl/scale";
import { api, imageUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { areaDescription, areaName, criterionDefinition, criterionName, descriptiveReason } from "@/lib/i18n/psl-texts";
import { buildReportText, reportLines } from "@/lib/psl-report";
import { useSessionImage } from "@/lib/session-images";
import { cn, fmt, scoreTone } from "@/lib/utils";
import type { RatingRecord } from "@/server/repos-psl";
import { paths } from "@/lib/paths";
import { ApiLink } from "@/components/shared/api-link";

const SOURCE_TONE: Record<string, Tone> = { frontal: "cyan", profile: "violet", mixed: "accent", "visual-model": "amber", derived: "mint" };
const pslTone = (v: number | null) => (v == null ? "muted" : scoreTone(v * 10));

export function RatingResult({ record }: { record: RatingRecord }) {
  const { t, lang } = useT();
  const router = useRouter();
  const r = record.result;
  const sessionSrc = useSessionImage(record.analysisId);
  const src = imageUrl(record.profileImageId) ?? sessionSrc;
  const [open, setOpen] = useState<CriterionScore | null>(null);
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => reportLines(r, record.profileLabel, lang, t), [r, record.profileLabel, lang, t]);
  const report = useMemo(() => buildReportText(r, record.profileLabel, lang, t), [r, record.profileLabel, lang, t]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const del = async () => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteRating(record.id);
    router.push("/history");
    router.refresh();
  };
  const statusTone: Tone = r.valid ? "mint" : r.provisional ? "amber" : "rose";
  const statusText = r.valid ? t("rater.result.valid") : r.provisional ? t("rater.result.provisional") : t("rater.result.invalid");
  const scoreMax = r.scale.rangeMax;
  const decimals = r.displayDecimals ?? 1;
  const isV2 = !!r.aggregation;
  const areaOrder = r.areas.map((a) => a.id);

  return (
    <div className="space-y-6 print:space-y-4" data-testid="rating-result">
      <PageHeader
        kicker={`${t("rater.result.title")} · ${fmt.date(record.createdAt, lang)} · ${t("rater.result.rubric")} ${r.rubricVersion} · ${t("rater.result.scaleUsed")}: ${r.scale.name} v${r.scale.version}`}
        title={record.profileLabel}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <Badge tone={statusTone} data-testid="rating-status">{r.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {statusText}</Badge>
            <Badge tone="cyan">{t("rater.result.coverage")}: {Math.round(r.coverage * 100)} %</Badge>
            <Badge tone="accent">{t("rater.result.confidence")}: {fmt.pct(r.confidence)}</Badge>
            {r.scoreSigma != null && <Badge tone="muted">{t("rater.result.sigma")} ±{r.scoreSigma.toFixed(Math.max(decimals, 1))}</Badge>}
            {r.reliability && <Badge tone={r.reliability === "veryHigh" ? "mint" : r.reliability === "high" ? "cyan" : r.reliability === "moderate" ? "amber" : "rose"} data-testid="rating-reliability">{t("analysis.reliability.title")}: {t(`analysis.reliability.level.${r.reliability}`)}</Badge>}
            {r.tierUncertainty != null && <Badge tone={r.tierUncertainty > 0.3 ? "amber" : "muted"} data-testid="tier-uncertainty">{t("rater.result.tierUncertainty", { p: fmt.pct(r.tierUncertainty) })}</Badge>}
            <Link href={paths.profile(record.profileId)} className="text-xs text-fg-2 hover:text-fg-0 underline underline-offset-2">{t("nav.profiles")} →</Link>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={copy} data-testid="rating-copy"><Copy size={14} /> {copied ? t("rater.result.copied") : t("rater.result.copyReport")}</Button>
            <ApiLink href={`/api/ratings/${record.id}?download=1`}><Button variant="outline" size="sm"><Download size={14} /> {t("rater.result.exportJson")}</Button></ApiLink>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={14} /> {t("rater.result.print")}</Button>
            <Link href={`/rater?profile=${record.profileId}`}><Button variant="outline" size="sm"><RefreshCw size={14} /> {t("rater.result.reRate")}</Button></Link>
            <Link href={`/compare?ids=${record.id}`}><Button variant="outline" size="sm">{t("compare.compareWith")}</Button></Link>
            <IdealExampleButton />
            <Button variant="danger" size="sm" onClick={del}><Trash2 size={14} /></Button>
          </div>
        }
      />

      {/* hero */}
      <Card strong>
        <CardBody className="pt-5">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr_1fr] items-center">
            <div className="flex items-center gap-4">
              <FaceThumb imageId={record.profileImageId} src={src} label={record.profileLabel} size={96} className="rounded-2xl" />
              <ScoreRing value={r.score} max={scoreMax} size={150} stroke={10} label={t("rater.result.score")} digits={decimals} tone={r.score == null ? "muted" : undefined} animate />
            </div>
            <div className="space-y-2">
              <div className="font-display text-5xl font-bold num" data-testid="rating-score">{r.score == null ? "—" : formatPsl(r.score, decimals)}<span className="text-xl text-fg-3"> / {scoreMax}</span></div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-fg-2">{t("rater.result.tier")}</span>
                <TierBadge tier={r.tier} size="lg" />
                {r.tier && <span className="font-mono text-xs text-fg-3">{formatTierRange(r.tier)}</span>}
              </div>
              {r.tier?.description && <p className="text-sm text-fg-2">{r.tier.description}</p>}
              {r.tier?.percentile && <p className="text-xs text-fg-3">{r.tier.percentile}</p>}
              <ScaleBar tiers={r.scale.tiers} rangeMin={r.scale.rangeMin} rangeMax={r.scale.rangeMax} value={r.score} className="pt-7" />
            </div>
            <div className="space-y-2" data-testid="rating-areas">
              {r.areas.map((a) => (
                <div key={a.id} title={areaDescription(a.id, lang)}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-fg-1">{areaName(a.id, lang)} <span className="text-fg-3">· {isV2 ? `${a.weight} % · ` : ""}{Math.round(a.coverage * 100)} %</span></span>
                    <span className="font-mono num">{formatPsl(a.score)}{a.sigma != null && <span className="text-fg-3 text-[10px]"> ±{a.sigma.toFixed(1)}</span>}</span>
                  </div>
                  <Progress value={a.score == null ? 0 : (a.score / scoreMax) * 100} tone={pslTone(a.score)} className="mt-1" />
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* mandatory report format */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("rater.result.reasoning")} />
          <CardBody className="space-y-4 text-sm">
            <p className="text-fg-1" data-testid="rating-reasoning">{lines.reasoning}</p>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{t("rater.result.strengths")}</div>
              <ul className="space-y-1">{lines.strengths.map((s, i) => <li key={i} className="flex gap-2 text-mint"><span>•</span><span className="text-fg-1">{s}</span></li>)}</ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{t("rater.result.lowerRated")}</div>
              <ul className="space-y-1">{lines.lower.map((s, i) => <li key={i} className="flex gap-2 text-amber"><span>•</span><span className="text-fg-1">{s}</span></li>)}</ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{t("rater.result.overallAssessment")}</div>
              <p className="text-fg-1">{lines.overall}</p>
              <p className="text-xs text-fg-3 mt-1">{t(isV2 ? "rater.result.harmonyNote" : "rater.result.areaBalanceNote")}</p>
            </div>
          </CardBody>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("rater.result.analysisQuality")} icon={<Info size={18} />} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-fg-1">{lines.quality}</p>
              {lines.warnings.length > 0 && (
                <ul className="space-y-1">
                  {lines.warnings.map((w, i) => <li key={i} className="flex gap-2 text-amber"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span className="text-fg-1">{w}</span></li>)}
                </ul>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/3 p-2"><div className="text-fg-3">{t("rater.result.assessable")}</div><div className="font-mono text-lg">{lines.assessable.length}</div></div>
                <div className="rounded-lg bg-white/3 p-2"><div className="text-fg-3">{t("rater.result.notAssessable")}</div><div className="font-mono text-lg">{lines.notAssessable.length}</div></div>
              </div>
              {lines.notAssessable.length > 0 && <p className="text-xs text-fg-3">{lines.notAssessable.join("; ")}</p>}
              <p className="text-xs text-fg-3 border-t border-line pt-2">{t("rater.result.populationNote")}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("rater.result.disclaimer")} />
            <CardBody><p className="text-xs text-fg-2">{t("rater.result.disclaimerText")}</p></CardBody>
          </Card>
        </div>
      </div>

      {/* criteria */}
      <Card>
        <CardHeader title={t("rater.result.criteria")} subtitle={`${t("rater.result.rubric")} ${r.rubricVersion}`} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="rating-criteria">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left py-2">{t("rater.result.criteria")}</th>
                <th className="text-left py-2">{t("rater.result.areas")}</th>
                <th className="text-right py-2">{isV2 ? t("rater.result.reliability") : t("rater.result.weight")}</th>
                <th className="text-right py-2 pl-3">{t("rater.result.score")}</th>
                <th className="text-left py-2 pl-3">{t("analysis.detail.reliability")}</th>
                <th className="text-right py-2 pl-3">{t("rater.result.confidence")}</th>
              </tr>
            </thead>
            <tbody>
              {areaOrder.flatMap((area) => r.criteria.filter((c) => c.area === area)).map((c) => (
                <tr key={c.id} className={cn("border-t border-line cursor-pointer hover:bg-white/3", !c.assessable && "opacity-70")} onClick={() => setOpen(c)} data-testid={`criterion-${c.id}`}>
                  <td className="py-2 pr-2"><div className="font-medium">{criterionName(c.id, lang)}</div><div className="text-[11px] text-fg-3">{CRITERION_BY_ID[c.id].method}</div></td>
                  <td className="py-2 text-xs text-fg-2">{areaName(c.area, lang)}</td>
                  <td className="py-2 text-right font-mono text-xs text-fg-2">{isV2 ? (c.reliability != null ? c.reliability.toFixed(2) : "—") : c.weight}</td>
                  <td className="py-2 pl-3 text-right">
                    {c.assessable && c.score != null ? (
                      <div className="flex items-center justify-end gap-2"><Progress value={(c.score / 10) * 100} tone={pslTone(c.score)} className="w-16" animate={false} /><span className="font-mono num">{formatPsl(c.score)}</span></div>
                    ) : (
                      <span className="text-xs text-fg-3 flex items-center justify-end gap-1"><XCircle size={12} /> {t(`rater.result.reason.${c.notAssessableCode ?? "inputsUnavailable"}`)}</span>
                    )}
                  </td>
                  <td className="py-2 pl-3"><Badge tone={SOURCE_TONE[c.source]}>{t(`rater.result.source.${c.source}`)}</Badge></td>
                  <td className="py-2 pl-3 text-right font-mono text-xs text-fg-2">{c.assessable ? fmt.pct(c.confidence) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {r.descriptive && r.descriptive.length > 0 && (
        <Card>
          <CardHeader title={t("rater.result.descriptive")} subtitle={t("rater.result.descriptiveSub")} />
          <CardBody>
            <ul className="space-y-2 text-sm" data-testid="rating-descriptive">
              {r.descriptive.map((d) => (
                <li key={d.id} className="flex gap-3">
                  <span className="font-mono text-xs w-24 shrink-0 text-fg-1">{d.id}{d.value != null && <span className="text-fg-3"> · {d.value.toFixed(2)}</span>}</span>
                  <span className="text-xs text-fg-2">{descriptiveReason(d.id, d.reason, lang)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? criterionName(open.id, lang) : ""} wide>
        {open && (
          <div className="grid gap-4 md:grid-cols-[1fr_240px] text-sm">
            <div className="space-y-3">
              <Section title={t("analysis.detail.what")}>{criterionDefinition(open.id, lang)}</Section>
              <Section title={t("analysis.detail.how")}>{CRITERION_BY_ID[open.id].requirements}</Section>
              <Section title={t("analysis.detail.limitations")}>
                <ul className="list-disc pl-5 space-y-1">{CRITERION_BY_ID[open.id].limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </Section>
              <Section title={t("analysis.detail.landmarks")}>
                <div className="flex flex-wrap gap-1">{open.usedInputs.map((u) => <Badge key={u} tone="mint">{u}</Badge>)}{open.missingInputs.map((u) => <Badge key={u} tone="muted">{u}</Badge>)}</div>
              </Section>
            </div>
            <div className="space-y-3">
              <div className="glass rounded-xl p-4"><div className="text-[11px] uppercase tracking-wider text-fg-2">{t("rater.result.score")}</div><div className="font-display text-3xl num mt-1">{open.assessable ? formatPsl(open.score) : "—"}</div>{open.index != null && <div className="text-xs text-fg-3">index {open.index.toFixed(0)}/100</div>}</div>
              <div className="glass rounded-xl p-4"><div className="text-[11px] uppercase tracking-wider text-fg-2">{isV2 ? t("rater.result.reliability") : t("rater.result.weight")}</div><div className="font-display text-3xl num mt-1">{isV2 ? (open.reliability != null ? open.reliability.toFixed(2) : "—") : open.weight}</div><div className="text-xs text-fg-3">{areaName(open.area, lang)}{isV2 && ` · ${t("rater.result.categoryWeight")} ${r.areas.find((a) => a.id === open.area)?.weight ?? 0} %`}</div></div>
              {!open.assessable && <div className="text-xs text-amber">{t(`rater.result.reason.${open.notAssessableCode ?? "inputsUnavailable"}`)}</div>}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{title}</div>
      <div className="text-fg-1">{children}</div>
    </div>
  );
}
