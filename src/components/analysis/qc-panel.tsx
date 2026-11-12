"use client";
/**
 * Report of the multi-stage quality control (engine 3.1): overall status, every
 * check of the final control, the re-analysis log, a zoomed view of every landmark
 * (verified position, the single detection when it was corrected, every detection
 * pass and the tolerance circle) and the check of every measurement.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/controls";
import type { AnalysisResult, LandmarkCheck, MeasureCheck, Point, QcCheck, QualityControl, RatioId } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { additionalText, landmarkLabel, ratioText } from "@/lib/i18n/ratio-texts";
import { symmetryMetricLabelById } from "@/lib/i18n/engine-text";
import { cn } from "@/lib/utils";

const CHECK_TONE: Record<QcCheck["status"], Tone> = { pass: "mint", note: "cyan", warn: "amber", fail: "rose" };
const LM_TONE: Record<LandmarkCheck["status"], Tone> = { confirmed: "mint", corrected: "cyan", uncertain: "amber", rejected: "rose", manual: "violet", unverified: "muted" };
const MS_TONE: Record<MeasureCheck["status"], Tone> = { stable: "mint", unstable: "amber", excluded: "rose", implausible: "rose", unverified: "muted" };

/** share of the interpupillary distance, with the decimal mark of the language */
const pct = (v: number | null | undefined, lang: "de" | "en") => (v == null ? "—" : `${lang === "de" ? (v * 100).toFixed(1).replace(".", ",") : (v * 100).toFixed(1)} % IPD`);

function StatusIcon({ status, size = 16 }: { status: QualityControl["status"] | QcCheck["status"]; size?: number }) {
  if (status === "passed" || status === "pass") return <CheckCircle2 size={size} className="shrink-0 text-mint" />;
  if (status === "note") return <Info size={size} className="shrink-0 text-cyan" />;
  if (status === "failed" || status === "fail") return <XCircle size={size} className="shrink-0 text-[#ff8fa3]" />;
  return <AlertTriangle size={size} className="shrink-0 text-amber" />;
}

/** Compact status of the quality control (analysis overview, rating page). */
export function QcBanner({ qc, href, onOpen }: { qc: QualityControl | null | undefined; href?: string; onOpen?: () => void }) {
  const { t, lang } = useT();
  if (!qc) {
    return (
      <div className="flex gap-2.5 rounded-xl border border-line bg-white/3 px-4 py-3 text-sm text-fg-1" data-testid="qc-banner" data-status="none">
        <Info size={18} className="mt-0.5 shrink-0 text-fg-3" />
        <p>{t("qc.none")}</p>
      </div>
    );
  }
  const n = (s: LandmarkCheck["status"]) => qc.landmarks.filter((l) => l.status === s).length;
  const issues = qc.checks.filter((c) => c.status === "warn" || c.status === "fail");
  const tone = qc.status === "passed" ? "border-mint/30 bg-mint/10" : qc.status === "limited" ? "border-amber/30 bg-amber/10" : "border-rose/30 bg-rose/10";
  const action = href ? (
    <Link href={href} className="text-xs text-fg-2 underline underline-offset-2 hover:text-fg-0">{t("qc.details")} →</Link>
  ) : onOpen ? (
    <button type="button" onClick={onOpen} className="text-xs text-fg-2 underline underline-offset-2 hover:text-fg-0">{t("qc.details")} →</button>
  ) : null;
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-4 py-3 text-sm text-fg-1", tone)} data-testid="qc-banner" data-status={qc.status}>
      <ShieldCheck size={18} className={cn("mt-0.5 shrink-0", qc.status === "passed" ? "text-mint" : qc.status === "limited" ? "text-amber" : "text-[#ff8fa3]")} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium">{t(`qc.status.${qc.status}`)}</div>
        <div className="text-xs text-fg-2">
          {t("qc.summary", { passes: qc.passes.used, confirmed: n("confirmed"), corrected: n("corrected"), uncertain: n("uncertain"), rejected: n("rejected"), total: qc.landmarks.length, measures: qc.measures.length })}
          {n("manual") > 0 && t("qc.summaryManual", { n: n("manual") })}
        </div>
        {issues.length > 0 && (
          <ul className="space-y-0.5 text-xs">
            {issues.map((c) => (
              <li key={c.id} className="flex gap-1.5"><StatusIcon status={c.status} size={13} /><span>{checkText(c, t, lang)}</span></li>
            ))}
          </ul>
        )}
        {action}
      </div>
    </div>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;
function checkText(c: QcCheck, t: T, lang: "de" | "en"): string {
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(c.params ?? {})) p[k] = typeof v === "number" && lang === "de" && !Number.isInteger(v) ? String(v).replace(".", ",") : v;
  const text = t(`qc.check.${c.id}.${c.status}`, p);
  const manual = c.id === "landmarks" ? Number(c.params?.manual ?? 0) : 0;
  return manual > 0 ? `${text} ${t("qc.manualNote", { n: manual })}` : text;
}

function measureName(m: MeasureCheck, lang: "de" | "en", result: AnalysisResult): string {
  if (m.kind === "ratio") return `${ratioText(m.id as RatioId, lang).name} (${m.id.replace(/_/g, " ")})`;
  if (m.kind === "symmetry") return symmetryMetricLabelById(m.id, lang, result.symmetry.metrics.find((x) => x.id === m.id)?.label ?? m.id);
  return additionalText(m.id as never, lang)?.name ?? m.id;
}

/** Loads the photo once for all zoomed crops. */
function usePhoto(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const i = new Image();
    i.onload = () => alive && setImg(i);
    i.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return src ? img : null;
}

function LandmarkZoom({ img, check, center, ipd }: { img: HTMLImageElement | null; check: LandmarkCheck; center: Point; ipd: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const SIZE = 132;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    c.width = SIZE * dpr;
    c.height = SIZE * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // window: 4 tolerances around the verified position, at least 12 % of the inter-pupillary distance
    const half = Math.max(0.12 * ipd, 4 * check.tolerance * ipd);
    const k = SIZE / (2 * half);
    const X = (p: Point) => (p.x - center.x + half) * k;
    const Y = (p: Point) => (p.y - center.y + half) * k;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (img) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, center.x - half, center.y - half, 2 * half, 2 * half, 0, 0, SIZE, SIZE);
    }
    // tolerance
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, check.tolerance * ipd * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // detection passes
    for (const p of check.passPoints ?? []) {
      ctx.fillStyle = "#3ad4ff";
      ctx.beginPath();
      ctx.arc(X(p), Y(p), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // the single detection, when it was corrected
    if (check.original) {
      ctx.strokeStyle = "#ff5a7a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(check.original), Y(check.original), 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // verified position
    ctx.strokeStyle = check.status === "rejected" ? "#ff5a7a" : "#34d399";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2 - 7, SIZE / 2);
    ctx.lineTo(SIZE / 2 + 7, SIZE / 2);
    ctx.moveTo(SIZE / 2, SIZE / 2 - 7);
    ctx.lineTo(SIZE / 2, SIZE / 2 + 7);
    ctx.stroke();
  }, [img, check, center, ipd]);
  return <canvas ref={ref} style={{ width: "100%", maxWidth: SIZE, aspectRatio: "1 / 1", height: "auto" }} className="rounded-lg border border-line" aria-hidden />;
}

/** Compact QC line for a rating: the rating stores the status of the analysis it was computed from. */
export function QcRatingBanner({ status, href }: { status: QualityControl["status"] | null | undefined; href: string | null }) {
  const { t } = useT();
  const st = status ?? "none";
  const tone = st === "passed" ? "border-mint/30 bg-mint/10" : st === "limited" || st === "none" ? "border-amber/30 bg-amber/10" : "border-rose/30 bg-rose/10";
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-4 py-3 text-sm text-fg-1", tone)} data-testid="qc-banner" data-status={st}>
      <ShieldCheck size={18} className={cn("mt-0.5 shrink-0", st === "passed" ? "text-mint" : st === "failed" ? "text-[#ff8fa3]" : "text-amber")} />
      <div className="min-w-0 flex-1 space-y-1">
        <p>{t(`qc.rating.${st}`)}</p>
        {status && href && <Link href={href} className="text-xs text-fg-2 underline underline-offset-2 hover:text-fg-0 print:hidden">{t("qc.details")} →</Link>}
      </div>
    </div>
  );
}

export function QcPanel({ result, src }: { result: AnalysisResult; src: string | null }) {
  const { t, lang } = useT();
  const qc = result.qc ?? null;
  const [filter, setFilter] = useState<"issues" | "all">("issues");
  const img = usePhoto(src);
  const pos = useMemo(() => new Map(result.landmarks.map((l) => [l.id, l.raw])), [result.landmarks]);
  const label = (id: LandmarkCheck["id"]) => landmarkLabel(id, lang, result.landmarks.find((l) => l.id === id)?.label ?? id);
  const ipd = useMemo(() => {
    const r = pos.get("pupil_R");
    const l = pos.get("pupil_L");
    return r && l ? Math.hypot(l.x - r.x, l.y - r.y) : 0;
  }, [pos]);
  if (!qc) return <QcBanner qc={null} />;
  const lmIssues = qc.landmarks.filter((l) => l.status !== "confirmed" && l.status !== "unverified");
  const shown = filter === "issues" ? lmIssues : qc.landmarks;
  const msIssues = qc.measures.filter((m) => m.status !== "stable");
  const measures = [...qc.measures].sort((a, b) => (b.spreadUnits ?? -1) - (a.spreadUnits ?? -1));
  return (
    <div className="space-y-5" data-testid="qc-panel">
      <QcBanner qc={qc} />
      <Card>
        <CardHeader title={t("qc.howTitle")} subtitle={t("qc.howSub", { passes: qc.passes.used, total: qc.passes.total })} icon={<ShieldCheck size={18} />} />
        <CardBody className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-fg-1">
            <li>{t("qc.step1")}</li>
            <li>{t("qc.step2")}</li>
            <li>{t("qc.step3")}</li>
            <li>{t("qc.step4")}</li>
          </ol>
          <p className="text-xs text-fg-3">{t("qc.limits")}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("qc.checksTitle")} subtitle={t("qc.checksSub", { n: qc.iterations })} />
        <CardBody>
          <ul className="divide-y divide-line" data-testid="qc-checks">
            {qc.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 py-2 text-sm" data-testid={`qc-check-${c.id}`} data-status={c.status}>
                <StatusIcon status={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t(`qc.checkName.${c.id}`)}</div>
                  <div className="text-xs text-fg-2">{checkText(c, t, lang)}</div>
                </div>
                <Badge tone={CHECK_TONE[c.status]}>{t(`qc.checkStatus.${c.status}`)}</Badge>
              </li>
            ))}
          </ul>
          {qc.actions.length > 0 && (
            <div className="mt-3 border-t border-line pt-3 text-xs text-fg-2" data-testid="qc-actions">
              <div className="mb-1 font-mono uppercase tracking-wider text-fg-3">{t("qc.actionsTitle")}</div>
              <ul className="space-y-0.5">
                {qc.actions.map((a, i) => (
                  <li key={i}>{t(`qc.action.${a.code}`, { round: a.round, list: a.ids.map((id) => (a.code === "excludeMeasure" ? id.slice(2).replace(/_/g, " ") : label(id as LandmarkCheck["id"]))).join(", ") })}</li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title={t("qc.landmarksTitle")}
          subtitle={t("qc.landmarksSub")}
          action={<Tabs tabs={[{ id: "issues", label: t("qc.filterIssues"), count: lmIssues.length }, { id: "all", label: t("qc.filterAll"), count: qc.landmarks.length }]} value={filter} onChange={setFilter} />}
        />
        <CardBody>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-3">
            <span><span className="text-mint">✚</span> {t("qc.legend.verified")}</span>
            <span><span className="text-cyan">●</span> {t("qc.legend.passes")}</span>
            <span><span className="text-[#ff8fa3]">○</span> {t("qc.legend.original")}</span>
            <span>┄ {t("qc.legend.tolerance")}</span>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-fg-2" data-testid="qc-no-issues">{t("qc.noLandmarkIssues", { n: qc.landmarks.length })}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-3" data-testid="qc-landmarks">
              {shown.map((l) => {
                const c = pos.get(l.id) ?? l.passPoints?.[0];
                return (
                  <div key={l.id} className="min-w-0 rounded-xl border border-line bg-bg-1/50 p-2" data-testid={`qc-lm-${l.id}`} data-status={l.status}>
                    <div className="flex justify-center">{c && ipd > 0 ? <LandmarkZoom img={img} check={l} center={c} ipd={ipd} /> : null}</div>
                    <div className="mt-1.5 text-xs font-medium break-words">{label(l.id)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge tone={LM_TONE[l.status]}>{t(`qc.lmStatus.${l.status}`)}</Badge>
                      {l.rule && <Badge tone="muted">{t(`qc.rule.${l.rule}`)}</Badge>}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-fg-3">
                      {l.spread != null && <div>{t("qc.spread")}: {pct(l.spread, lang)} · {t("qc.tolerance")}: {pct(l.tolerance, lang)}</div>}
                      {l.deviation != null && <div>{t("qc.deviation")}: {pct(l.deviation, lang)}</div>}
                      {l.agreement != null && <div>{t("qc.agreement", { n: Math.round(l.agreement * l.passes), total: l.passes })}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!src && <p className="mt-2 text-xs text-fg-3">{t("qc.noImage")}</p>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("qc.measuresTitle")} subtitle={t("qc.measuresSub", { issues: msIssues.length, total: qc.measures.length })} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="qc-measures">
            <thead className="text-[10px] uppercase tracking-wider text-fg-3">
              <tr><th className="py-2 text-left">{t("qc.measure")}</th><th className="py-2 text-right">{t("qc.spreadUnits")}</th><th className="py-2 pl-3 text-left">{t("qc.state")}</th></tr>
            </thead>
            <tbody>
              {measures.map((m) => (
                <tr key={`${m.kind}:${m.id}`} className="border-t border-line" data-testid={`qc-ms-${m.id}`} data-status={m.status}>
                  <td className="py-1.5 pr-2 text-xs break-words">{measureName(m, lang, result)}</td>
                  <td className="py-1.5 text-right font-mono text-xs num">{m.spreadUnits == null ? "—" : lang === "de" ? m.spreadUnits.toFixed(2).replace(".", ",") : m.spreadUnits.toFixed(2)}</td>
                  <td className="py-1.5 pl-3"><Badge tone={MS_TONE[m.status]}>{t(`qc.msStatus.${m.status}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-fg-3">{t("qc.measuresNote")}</p>
        </CardBody>
      </Card>
    </div>
  );
}
