"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, Select } from "@/components/ui/controls";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ui/score-ring";
import { SideCanvas } from "@/components/side/side-canvas";
import { formatSideRange, formatSideValue, SIDE_BY_ID, SIDE_DEFINITIONS, type SideMeasurementId, type SideMeasurementResult } from "@/engine/side-view";
import { api, imageUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { SIDE_ASSUMPTION_TEXTS, SIDE_ISSUE_TEXTS, SIDE_SOURCE_TEXTS, sideLandmarkText, sideMeasurementText } from "@/lib/i18n/side-texts";
import { useSessionImage } from "@/lib/session-images";
import { cn, fmt, scoreLabel, scoreTone } from "@/lib/utils";
import type { SideAnalysisRecord } from "@/server/repos";
import { paths } from "@/lib/paths";

const SOURCE_TONE: Record<string, Tone> = { guide: "violet", literature: "cyan", descriptive: "muted" };

export function SideResult({ record }: { record: SideAnalysisRecord }) {
  const { t, lang } = useT();
  const router = useRouter();
  const sessionSrc = useSessionImage(record.id);
  const src = imageUrl(record.imageId) ?? sessionSrc;
  const r = record.result;
  const [layer, setLayer] = useState<SideMeasurementId | "all">("all");
  const [open, setOpen] = useState<SideMeasurementResult | null>(null);

  const del = async () => {
    if (!confirm(t("side.deleteConfirm"))) return;
    await api.deleteSideAnalysis(record.id);
    router.push("/history");
    router.refresh();
  };

  const sigmaText = (m: SideMeasurementResult) => (m.valueSigma == null ? "—" : SIDE_BY_ID[m.id].unit === "ratio" ? m.valueSigma.toFixed(3) : m.valueSigma.toFixed(1));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`${t("side.title")} · ${fmt.date(record.createdAt, lang)} · ${t("common.engine")} side-view ${r.engineVersion}`}
        title={record.profileLabel}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <Badge tone="cyan">
              {t("side.facing")}: {t(r.facing === "left" ? "side.facingLeft" : "side.facingRight")}
            </Badge>
            <Badge tone="accent">
              {r.scoredCount} {t("side.scored")} · {r.measurements.length - r.scoredCount} {t("side.descriptive")}
            </Badge>
            {r.scoreSigma != null && <Badge tone="muted">σ {r.scoreSigma.toFixed(1)}</Badge>}
            <Link href={paths.profile(record.profileId)} className="text-xs text-fg-2 hover:text-fg-0 underline underline-offset-2">
              {t("nav.profiles")} →
            </Link>
          </span>
        }
        action={
          <Button variant="danger" size="sm" onClick={del}>
            <Trash2 size={14} /> {t("common.delete")}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <Card strong>
            <CardBody className="pt-5 space-y-3">
              <SideCanvas src={src} width={record.imageWidth} height={record.imageHeight} points={record.points} result={r} highlight={layer === "all" ? null : layer} />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={layer} onChange={(e) => setLayer(e.target.value as SideMeasurementId | "all")} className="h-8 text-xs" aria-label={t("upload.layers")} data-testid="side-layer">
                  <option value="all">{t("side.layerAll")}</option>
                  {SIDE_DEFINITIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {sideMeasurementText(d.id, lang).name}
                    </option>
                  ))}
                </Select>
                {!src && <span className="text-xs text-fg-3">{t("side.photoNotStored")}</span>}
              </div>
            </CardBody>
          </Card>

          {r.issues.length > 0 && (
            <Card>
              <CardHeader title={t("side.issues")} icon={<AlertTriangle size={18} className="text-amber" />} />
              <CardBody>
                <ul className="space-y-1.5 text-sm">
                  {r.issues.map((i) => (
                    <li key={i.code} className={cn("flex gap-2", i.severity === "error" ? "text-[#ff8fa3]" : "text-amber")}>
                      {i.severity === "error" ? <XCircle size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
                      <span>{SIDE_ISSUE_TEXTS[lang][i.code]}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={t("side.assumptions")} icon={<Info size={18} />} />
            <CardBody>
              <ul className="space-y-1.5 text-sm text-fg-1">
                {r.assumptionCodes.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="text-cyan">•</span>
                    {SIDE_ASSUMPTION_TEXTS[lang][c]}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card strong>
            <CardBody className="pt-5">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing value={r.score} size={150} stroke={10} label={t("side.score")} digits={1} />
                <div className="flex-1 w-full space-y-2">
                  <div className="font-display text-xl font-semibold">{scoreLabel(r.score, t)}</div>
                  <p className="text-sm text-fg-2">{t("side.scoreSub", { n: r.scoredCount })}</p>
                  {r.uncertainty.samples > 0 && <p className="text-xs text-fg-3">{t("side.uncertaintyNote", { px: r.uncertainty.sigmaPx.toFixed(1), n: r.uncertainty.samples })}</p>}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("side.measurements")} />
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="side-table">
                <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="text-left py-2">{t("side.columns.measurement")}</th>
                    <th className="text-right py-2">{t("side.columns.value")}</th>
                    <th className="text-right py-2">{t("side.columns.sigma")}</th>
                    <th className="text-right py-2">{t("side.columns.range")}</th>
                    <th className="text-left py-2 pl-3">{t("side.columns.source")}</th>
                    <th className="text-right py-2">{t("side.columns.index")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.measurements.map((m) => {
                    const def = SIDE_BY_ID[m.id];
                    const tx = sideMeasurementText(m.id, lang);
                    return (
                      <tr
                        key={m.id}
                        className={cn("border-t border-line cursor-pointer hover:bg-white/3", layer === m.id && "bg-accent/10")}
                        onClick={() => setOpen(m)}
                        onMouseEnter={() => setLayer(m.id)}
                        data-testid={`side-row-${m.id}`}
                      >
                        <td className="py-2 pr-2">
                          <div className="font-medium">{tx.name}</div>
                          <div className="text-[11px] text-fg-3 font-mono">{m.id}</div>
                        </td>
                        <td className="py-2 pl-2 text-right font-mono num whitespace-nowrap">{formatSideValue(m.id, m.value)}</td>
                        <td className="py-2 pl-3 text-right font-mono num text-fg-3 whitespace-nowrap">{sigmaText(m)}</td>
                        <td className="py-2 pl-3 text-right font-mono num text-fg-2 whitespace-nowrap">{formatSideRange(m.id)}</td>
                        <td className="py-2 pl-3">
                          <Badge tone={SOURCE_TONE[def.source]}>{SIDE_SOURCE_TEXTS[lang][def.source]}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          {m.value == null && m.missingLandmarks?.length ? (
                            <span className="text-xs text-fg-3" data-testid={`side-nd-${m.id}`} title={m.missingLandmarks.map((id) => sideLandmarkText(id, lang).name).join(", ")}>{t("side.notDeterminable")}</span>
                          ) : m.index == null ? (
                            <span className="text-xs text-fg-3">{t("side.notScored")}</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={m.index} tone={scoreTone(m.index)} className="w-14" animate={false} />
                              <span className={cn("font-mono num text-xs", m.inRange ? "text-mint" : "text-amber")}>{m.index.toFixed(0)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? sideMeasurementText(open.id, lang).name : ""} wide>
        {open && <MeasurementDetail m={open} />}
      </Dialog>
    </div>
  );
}

function MeasurementDetail({ m }: { m: SideMeasurementResult }) {
  const { t, lang } = useT();
  const def = SIDE_BY_ID[m.id];
  const tx = sideMeasurementText(m.id, lang);
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4 text-sm">
        <Section title={t("side.detail.what")}>{tx.description}</Section>
        <Section title={t("side.detail.how")}>{tx.methodology}</Section>
        <Section title={t("side.detail.reference")}>
          <div className="font-mono text-fg-0">{formatSideRange(m.id)}</div>
          <div className="mt-1 text-fg-2">{tx.reference}</div>
          <Badge tone={SOURCE_TONE[def.source]} className="mt-2">
            {SIDE_SOURCE_TEXTS[lang][def.source]}
          </Badge>
        </Section>
        <Section title={t("side.detail.limitations")}>
          <ul className="list-disc pl-5 space-y-1 text-fg-1">
            {tx.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </Section>
        <Section title={t("side.detail.landmarks")}>
          <div className="flex flex-wrap gap-1.5">
            {def.landmarks.map((id) => (
              <Badge key={id} tone="muted">
                {sideLandmarkText(id, lang).name}
              </Badge>
            ))}
          </div>
        </Section>
      </div>
      <div className="space-y-3">
        <div className="glass rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-fg-2">{t("side.detail.value")}</div>
          <div className="font-display text-3xl num mt-1">{formatSideValue(m.id, m.value)}</div>
          {m.valueSigma != null && <div className="text-xs text-fg-3">σ {def.unit === "ratio" ? m.valueSigma.toFixed(3) : m.valueSigma.toFixed(1)}</div>}
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-fg-2">{t("side.detail.index")}</div>
          <div className={cn("font-display text-3xl num mt-1", m.index == null && "text-fg-3")}>{m.index == null ? "—" : m.index.toFixed(0)}</div>
          {m.index != null && <Progress value={m.index} tone={scoreTone(m.index)} className="mt-2" animate={false} />}
          <div className="mt-2 text-xs text-fg-2">
            {m.value == null && m.missingLandmarks?.length ? t("side.missingPoints", { list: m.missingLandmarks.map((id) => sideLandmarkText(id, lang).name).join(", ") }) : m.index == null ? t("side.notScored") : m.inRange ? t("side.inRange") : `${t("side.detail.deviation")} ${m.deviation == null ? "" : formatSideValue(m.id, Math.abs(m.deviation))}`}
          </div>
        </div>
      </div>
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
