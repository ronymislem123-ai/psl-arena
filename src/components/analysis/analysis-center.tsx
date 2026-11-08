"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Badge, levelTone, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, Empty, Select, Tabs } from "@/components/ui/controls";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ui/score-ring";
import { PageHeader } from "@/components/layout/app-shell";
import { LandmarkCanvas, LAYERS, type LayerId } from "@/components/viz/landmark-canvas";
import { ADDITIONAL_BY_ID, RATIO_BY_ID, RATIO_DEFINITIONS } from "@/engine/ratios/database";
import { formatT1, formatValue } from "@/engine/explain";
import { additionalNote, featureGroupLabel, featureLabel, featureNote, featureSummary, issueText, landmarkDisplayLabel, localizedExplanation, metricText, sourceText, symmetryMetricLabel, symmetryNote, unavailableText, warningTexts } from "@/lib/i18n/engine-text";
import { additionalText, categoryText, landmarkNote, ratioText } from "@/lib/i18n/ratio-texts";
import type { AnalysisResult, FeatureObservation, RatioResult, SemanticLandmark } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useSessionImage } from "@/lib/session-images";
import { imageUrl } from "@/lib/api";
import { cn, fmt, scoreLabel, scoreTone } from "@/lib/utils";
import { paths } from "@/lib/paths";
import { ApiLink } from "@/components/shared/api-link";

type Tab = "overview" | "ratios" | "landmarks" | "symmetry" | "features" | "quality";

export function AnalysisCenter({ result, label, imageId, imageSrc, createdAt, analysisId, profileId, width, height }: { result: AnalysisResult; label: string; imageId: string | null; imageSrc?: string | null; createdAt: string; analysisId: string; profileId: string; width: number; height: number }) {
  const { t, lang } = useT();
  const [tab, setTab] = useState<Tab>("overview");
  const sessionSrc = useSessionImage(analysisId);
  const src = imageSrc ?? imageUrl(imageId) ?? sessionSrc;
  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`${t("analysis.title")} · ${fmt.date(createdAt, lang)} · ${t("common.engine")} ${result.engineVersion}`}
        title={label}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <Badge tone={levelTone(result.quality.level)}>{t("common.quality")}: {t(`quality.${result.quality.level}`)}</Badge>
            <Badge tone="cyan">{t("common.coverage")}: {result.coverage.evaluable}/{result.coverage.total}</Badge>
            <Badge tone="accent">{t("common.confidence")}: {fmt.pct(result.scores.confidence)}</Badge>
            <Link href={paths.profile(profileId)} className="text-xs text-fg-2 hover:text-fg-0 underline underline-offset-2">{t("nav.profiles")} →</Link>
            <Link href={`/compare?mode=analyses&analyses=${analysisId}`} className="text-xs text-fg-2 hover:text-fg-0 underline underline-offset-2">{t("compareAnalyses.title")} →</Link>
          </span>
        }
        action={
          <Tabs
            tabs={[
              { id: "overview", label: t("analysis.overview") },
              { id: "ratios", label: t("analysis.ratios") },
              { id: "landmarks", label: t("analysis.landmarks") },
              { id: "symmetry", label: t("analysis.symmetry") },
              { id: "features", label: t("analysis.features") },
              { id: "quality", label: t("analysis.quality") },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />
      {tab === "overview" && <Overview result={result} src={src} width={width} height={height} />}
      {tab === "ratios" && <RatioTable result={result} src={src} width={width} height={height} />}
      {tab === "landmarks" && <Landmarks result={result} src={src} width={width} height={height} />}
      {tab === "symmetry" && <Symmetry result={result} src={src} width={width} height={height} />}
      {tab === "features" && <Features result={result} />}
      {tab === "quality" && <Quality result={result} analysisId={analysisId} />}
    </div>
  );
}

function ImagePanel({ result, src, width, height, layer, showMesh, onSelect, selectedId }: { result: AnalysisResult; src: string | null; width: number; height: number; layer: LayerId; showMesh?: boolean; onSelect?: (l: SemanticLandmark | null) => void; selectedId?: SemanticLandmark["id"] | null }) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <LandmarkCanvas imageSrc={src} width={width} height={height} result={result} layer={layer} showMesh={showMesh} onSelect={onSelect} selectedId={selectedId} />
      {!src && (
        <div className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-xs text-fg-3">
          {t("profiles.noImage")} — {t("analysis.wireframe")}. {t("battle.storeImagesHint")}
        </div>
      )}
    </div>
  );
}

function Overview({ result, src, width, height }: { result: AnalysisResult; src: string | null; width: number; height: number }) {
  const { t, lang } = useT();
  const s = result.scores;
  const warnings = warningTexts(result, lang);
  const inT1 = result.ratios.filter((r) => r.inT1).map((r) => RATIO_BY_ID[r.id]);
  const notable = result.ratios.filter((r) => r.availability === "available" && r.inT1 === false && (r.index ?? 100) < 50).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).slice(0, 8);
  const uncertain = result.ratios.filter((r) => r.availability === "available" && r.uncertain);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        <Card strong>
          <CardBody className="pt-5">
            <ImagePanel result={result} src={src} width={width} height={height} layer="ratios" />
          </CardBody>
        </Card>
        {warnings.length > 0 && (
          <Card>
            <CardHeader title={t("analysis.warnings")} icon={<AlertTriangle size={18} className="text-amber" />} />
            <CardBody>
              <ul className="space-y-1.5 text-sm text-fg-1">
                {warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
      <div className="space-y-5">
        <Card strong>
          <CardBody className="pt-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing value={s.overall} size={160} stroke={10} label={t("analysis.overall")} digits={1} />
              <div className="flex-1 w-full space-y-3">
                <div className="font-display text-xl font-semibold">{scoreLabel(s.overall, t)}</div>
                <div className="text-xs text-fg-3">
                  {t("analysis.overallFormula")} · σ {result.uncertainty?.overallSigma.toFixed(1) ?? "—"}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [t("analysis.harmony"), s.harmony],
                    [t("analysis.proportion"), s.proportion],
                    [t("analysis.structure"), s.structure],
                    [t("analysis.symmetryScore"), s.symmetry],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-xl border border-line bg-bg-1/50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-fg-3">{l}</div>
                      <div className="font-display text-2xl font-semibold num">{fmt.score(v as number | null, 1)}</div>
                      <Progress value={v as number | null} tone={scoreTone(v as number | null)} className="mt-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("analysis.overview")} subtitle={t("analysis.categoryIndices")} />
          <CardBody className="space-y-2.5">
            {result.categories.map((c) => (
              <div key={c.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                <div className="text-sm">{categoryText(c.id, lang).label}</div>
                <Progress value={c.index} tone={scoreTone(c.index)} />
                <div className="text-right font-mono text-xs num w-24 text-fg-2">
                  {fmt.score(c.index)} <span className="text-fg-3">· {c.coverage.available}/{c.coverage.total}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("analysis.original")} subtitle={t("analysis.originalNote")} />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={t("analysis.t1Count")} value={`${result.original.t1Count}/${result.original.evaluableCount}`} />
              <Stat label={t("analysis.points")} value={`${result.original.pointsFromT1}/${result.original.theoreticalMax}`} />
              <Stat label={t("analysis.coverageAdjusted")} value={result.original.coverageAdjustedT1Percent == null ? "—" : `${result.original.coverageAdjustedT1Percent.toFixed(0)} %`} />
              <Stat label={t("analysis.originalPercent")} value={result.original.originalPercent == null ? t("analysis.notComputable") : `${result.original.originalPercent.toFixed(0)} %`} />
            </div>
            <p className="mt-3 text-xs text-fg-3">{result.original.originalPercentNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="mint">{t("analysis.evaluable")}: {result.coverage.evaluable}</Badge>
              <Badge tone="amber">{t("analysis.unavailable")}: {result.coverage.unavailable}</Badge>
              <Badge tone="muted">{t("analysis.incomplete")}: {result.coverage.incomplete}</Badge>
              <Badge tone="rose">{t("analysis.uncertain")}: {result.coverage.uncertain}</Badge>
              {result.coverage.excluded > 0 && <Badge tone="violet">{t("analysis.excluded")}: {result.coverage.excluded}</Badge>}
            </div>
          </CardBody>
        </Card>
        <div className="grid gap-5 md:grid-cols-3">
          <ListCard title={t("analysis.strengths")} items={inT1.map((d) => `${d.abbreviation} · ${ratioText(d.id, lang).name}`)} tone="mint" />
          <ListCard title={t("analysis.notable")} items={notable.map((r) => `${RATIO_BY_ID[r.id].abbreviation} ${formatValue(r.value, RATIO_BY_ID[r.id].unit)} (T1 ${formatT1(RATIO_BY_ID[r.id])})`)} tone="amber" />
          <ListCard title={t("analysis.uncertainAreas")} items={uncertain.map((r) => `${RATIO_BY_ID[r.id].abbreviation} · ${fmt.pct(r.confidence)}`)} tone="rose" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-1/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="font-display text-lg font-semibold num">{value}</div>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "mint" | "amber" | "rose" }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {items.length === 0 ? (
          <div className="text-sm text-fg-3">—</div>
        ) : (
          <ul className="space-y-1 text-xs text-fg-1 max-h-48 overflow-y-auto scrollbar-thin">
            {items.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className={`text-${tone}`}>•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function RatioTable({ result, src, width, height }: { result: AnalysisResult; src: string | null; width: number; height: number }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState<RatioResult | null>(null);
  const [filter, setFilter] = useState<"all" | "available" | "t1" | "outside" | "unavailable">("all");
  const rows = result.ratios.filter((r) => {
    if (filter === "available") return r.availability === "available";
    if (filter === "t1") return r.inT1 === true;
    if (filter === "outside") return r.inT1 === false;
    if (filter === "unavailable") return r.availability !== "available";
    return true;
  });
  const def = open ? RATIO_BY_ID[open.id] : null;
  const expl = open ? localizedExplanation(open, result.landmarks, lang) : null;
  return (
    <Card>
      <CardHeader
        title={t("analysis.ratios")}
        action={
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-8 text-xs">
            <option value="all">{t("analysis.all")}</option>
            <option value="available">{t("analysis.evaluable")}</option>
            <option value="t1">T1</option>
            <option value="outside">{t("analysis.outsideT1")}</option>
            <option value="unavailable">{t("analysis.unavailable")}</option>
          </Select>
        }
      />
      <CardBody className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="text-left py-2 w-8">{t("analysis.columns.nr")}</th>
              <th className="text-left py-2">{t("analysis.columns.ratio")}</th>
              <th className="text-right py-2">{t("analysis.columns.value")}</th>
              <th className="text-left py-2 pl-4">{t("analysis.columns.t1")}</th>
              <th className="text-left py-2 pl-4">{t("analysis.columns.tier")}</th>
              <th className="text-left py-2 pl-4 w-32">{t("analysis.columns.index")}</th>
              <th className="text-right py-2">{t("analysis.columns.confidence")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = RATIO_BY_ID[r.id];
              const avail = r.availability === "available";
              return (
                <tr key={r.id} className="border-t border-line hover:bg-white/3 cursor-pointer" onClick={() => setOpen(r)} title={avail ? undefined : unavailableText(r, lang)}>
                  <td className="py-2 font-mono text-xs text-fg-3">{d.number}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.abbreviation}</span>
                      <span className="text-xs text-fg-3 hidden md:inline truncate max-w-[220px]">{ratioText(d.id, lang).name}</span>
                      <Badge tone={statusTone(d.status)} className="px-1 py-0 text-[9px]">{t(`analysis.status.${d.status}`)}</Badge>
                    </div>
                  </td>
                  <td className={cn("py-2 text-right font-mono num", r.inT1 && "text-mint", !avail && "text-fg-3")}>
                    {avail ? formatValue(r.value, d.unit) : "—"}
                    {r.valueSigma != null && avail && <span className="text-fg-3 text-[10px]"> ±{formatValue(r.valueSigma, d.unit)}</span>}
                  </td>
                  <td className="py-2 pl-4 font-mono text-xs text-fg-2">{formatT1(d)}</td>
                  <td className="py-2 pl-4">
                    {avail ? r.tier ? <Badge tone="mint">{r.tier} +{r.tierPoints}</Badge> : <Badge tone="amber">{t("analysis.outsideT1")}</Badge> : <Badge tone="muted">{r.availability === "excluded" ? t("analysis.excluded") : "n/a"}</Badge>}
                  </td>
                  <td className="py-2 pl-4">
                    <div className="flex items-center gap-2">
                      <Progress value={r.index} tone={scoreTone(r.index)} animate={false} className="w-20" />
                      <span className="font-mono text-xs num w-7 text-right">{fmt.score(r.index)}</span>
                    </div>
                  </td>
                  <td className={cn("py-2 text-right font-mono text-xs num", r.uncertain && avail && "text-amber")}>{avail ? fmt.pct(r.confidence) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={def ? `${def.abbreviation} — ${ratioText(def.id, lang).name}` : ""} wide>
        {open && def && expl && (
          <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={statusTone(def.status)}>{t(`analysis.status.${def.status}`)}</Badge>
                <Badge tone="cyan">{categoryText(def.category, lang).label}</Badge>
                {open.availability === "available" && (open.tier ? <Badge tone="mint">{open.tier} · +{open.tierPoints}</Badge> : <Badge tone="amber">{t("analysis.outsideT1")} · {t("analysis.tierUndetermined")}</Badge>)}
              </div>
              <Row k={t("analysis.detail.what")} v={expl.what} />
              <Row k={t("analysis.detail.how")} v={expl.how} />
              <Row k={t("analysis.detail.target")} v={expl.target} />
              <Row k={t("analysis.detail.measured")} v={expl.measured} />
              <Row k={t("analysis.detail.values")} v={<span className="font-mono text-xs break-words">{expl.formulaWithValues}</span>} />
              <Row k={t("analysis.detail.reliability")} v={expl.reliability} />
              <Row k={t("analysis.detail.points")} v={expl.points} />
              <Row k={t("analysis.detail.index")} v={expl.index} />
              <Row
                k={t("analysis.detail.limitations")}
                v={
                  <ul className="list-disc pl-4 space-y-0.5">
                    {expl.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                }
              />
              <Row k={t("analysis.detail.landmarks")} v={expl.landmarkLabels.join(", ") || "—"} />
              <div className="text-[11px] text-fg-3">{sourceText(lang)}</div>
            </div>
            <div>
              {src ? <LandmarkCanvas imageSrc={src} width={width} height={height} result={result} layer={layerForCategory(def.category)} highlight={def.landmarks} compact /> : <Empty>{t("profiles.noImage")}</Empty>}
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function layerForCategory(c: string): LayerId {
  return c === "eyeArea" ? "eyes" : c === "midface" ? "midface" : c === "nose" ? "nose" : c === "lips" ? "mouth" : c === "jawline" ? "jaw" : c === "lowerThird" ? "mouth" : "thirds";
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{k}</div>
      <div className="text-fg-1 mt-0.5">{v}</div>
    </div>
  );
}

function Landmarks({ result, src, width, height }: { result: AnalysisResult; src: string | null; width: number; height: number }) {
  const { t, lang } = useT();
  const showMeshDefault = useSettings((s) => s.showMeshByDefault);
  const [layer, setLayer] = useState<LayerId>("landmarks");
  const [showMesh, setShowMesh] = useState(showMeshDefault);
  const [sel, setSel] = useState<SemanticLandmark | null>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card strong>
        <CardHeader
          title={t("analysis.landmarks")}
          action={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-fg-2">
                <input type="checkbox" checked={showMesh} onChange={(e) => setShowMesh(e.target.checked)} className="accent-[#4f7cff]" /> {t("analysis.layers.mesh")}
              </label>
              <Select value={layer} onChange={(e) => setLayer(e.target.value as LayerId)} className="h-8 text-xs">
                {LAYERS.map((l) => (
                  <option key={l} value={l}>
                    {t(`analysis.layers.${l}`)}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <CardBody>
          <ImagePanel result={result} src={src} width={width} height={height} layer={layer} showMesh={showMesh} onSelect={setSel} selectedId={sel?.id ?? null} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={sel ? landmarkDisplayLabel(sel, lang) : t("analysis.landmarks")} subtitle={sel ? `${sel.source} · ${sel.precision} · ${fmt.pct(sel.confidence)}${landmarkNote(sel.noteCode, lang, sel.note) ? ` · ${landmarkNote(sel.noteCode, lang, sel.note)}` : ""}` : `${result.landmarks.length} ${t("analysis.semanticLandmarks")} · ${t("analysis.roll")} ${result.mesh.rollDeg.toFixed(1)}°`} />
        <CardBody>
          <div className="max-h-[520px] overflow-y-auto scrollbar-thin divide-y divide-line">
            {result.landmarks.map((l) => (
              <button key={l.id} onClick={() => setSel(l)} className={cn("w-full text-left py-2 flex items-center justify-between gap-2 text-xs hover:bg-white/3 px-1 -mx-1 rounded", sel?.id === l.id && "bg-accent/10")}>
                <span className="truncate">
                  {landmarkDisplayLabel(l, lang)} <span className="text-fg-3">· {l.region}</span>
                </span>
                <span className="font-mono text-fg-3 shrink-0">
                  {l.raw.x.toFixed(0)},{l.raw.y.toFixed(0)} · {l.source[0]}/{l.precision[0]} · {fmt.pct(l.confidence)}
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Symmetry({ result, src, width, height }: { result: AnalysisResult; src: string | null; width: number; height: number }) {
  const { t, lang } = useT();
  const s = result.symmetry;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card strong>
        <CardBody className="pt-5">
          <ImagePanel result={result} src={src} width={width} height={height} layer="symmetry" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("analysis.symmetry")} subtitle={symmetryNote(s, lang)} action={<ScoreRing value={s.score} size={72} stroke={6} animate={false} />} />
        <CardBody className="space-y-2">
          <div className="text-xs text-fg-3 mb-2">
            {t("common.confidence")} {fmt.pct(s.confidence)} · σ {s.sigma?.toFixed(1) ?? "—"}
          </div>
          {s.metrics.map((m) => (
            <div key={m.id} className="grid grid-cols-[1fr_auto_80px] items-center gap-3 text-sm">
              <div className="truncate">{symmetryMetricLabel(m, lang)}</div>
              <div className="font-mono text-xs text-fg-2 num">
                {m.unit === "deg" ? `${m.value.toFixed(1)}°` : m.unit === "percent" ? `${m.value.toFixed(1)} %` : `${(m.value * 100).toFixed(1)} % IPD`} <span className="text-fg-3">/ {t("analysis.tolerance")} {m.unit === "deg" ? `${m.tolerance}°` : m.unit === "percent" ? `${m.tolerance} %` : `${(m.tolerance * 100).toFixed(0)} %`}</span>
              </div>
              <Progress value={m.score} tone={scoreTone(m.score)} animate={false} />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function Features({ result }: { result: AnalysisResult }) {
  const { t, lang } = useT();
  const groups: FeatureObservation["group"][] = ["eyesBrows", "midface", "jawChin", "noseLips", "overall"];
  const kindTone = (k: string) => (k === "measured" ? "mint" : k === "approximate" ? "cyan" : k === "visual-estimate" ? "amber" : "muted");
  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-2">{t("analysis.featuresIntro")}</p>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g}>
            <CardHeader title={featureGroupLabel(g, lang)} />
            <CardBody>
              <ul className="divide-y divide-line">
                {result.features.filter((f) => f.group === g).map((f) => {
                  const note = featureNote(f, lang);
                  return (
                    <li key={f.id} className="py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm">{featureLabel(f, lang)}</div>
                        <div className="text-xs text-fg-2">{featureSummary(f, lang, result.symmetry.metrics)}</div>
                        {note && <div className="text-[11px] text-fg-3">{note}</div>}
                      </div>
                      <Badge tone={kindTone(f.kind)}>{t(`analysis.kinds.${f.kind}`)}</Badge>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardHeader title={t("analysis.additional")} subtitle={t("analysis.additionalSub")} />
          <CardBody>
            <ul className="divide-y divide-line">
              {result.additional.map((m) => {
                const d = ADDITIONAL_BY_ID[m.id];
                const tx = additionalText(m.id, lang);
                return (
                  <li key={m.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{tx.name}</div>
                      <Badge tone={m.availability === "available" ? "cyan" : "muted"}>{m.availability === "available" ? (d.status === "measurable" ? t("analysis.measuredTag") : t("analysis.rawOnly")) : t("analysis.unavailableTag")}</Badge>
                    </div>
                    <div className="text-xs text-fg-2 mt-0.5">{additionalNote(m, lang)}</div>
                    {tx.referenceValue && <div className="text-[11px] text-fg-3">{t("analysis.reference")}: {tx.referenceValue}</div>}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Quality({ result, analysisId }: { result: AnalysisResult; analysisId: string }) {
  const { t, lang } = useT();
  const q = result.quality;
  const u = result.uncertainty;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title={t("analysis.quality")} action={<Badge tone={levelTone(q.level)}>{t(`quality.${q.level}`)} · {fmt.pct(q.score)}</Badge>} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {q.metrics.map((m) => {
              const mt = metricText(m, lang);
              return (
                <div key={m.id} className="rounded-xl border border-line bg-bg-1/50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-fg-3">{mt.label}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono num">
                      {m.value} <span className="text-fg-3 text-xs">{mt.unit}</span>
                    </span>
                    <Badge tone={levelTone(m.level)}>{t(`quality.${m.level}`)}</Badge>
                  </div>
                  <div className="text-[10px] text-fg-3 mt-1">{mt.hint}</div>
                </div>
              );
            })}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-fg-3 mb-1">{t("analysis.pose")} / {t("analysis.expression")}</div>
            <div className="text-sm text-fg-1 font-mono num">
              {t("analysis.poseLine", { yaw: q.pose.yaw.toFixed(1), pitch: q.pose.pitch.toFixed(1), roll: q.pose.roll.toFixed(1), neutral: (q.expression.neutrality * 100).toFixed(0), smile: (q.expression.smile * 100).toFixed(0), jaw: (q.expression.jawOpen * 100).toFixed(0), blink: (q.expression.blink * 100).toFixed(0) })}
            </div>
          </div>
          {q.issues.length > 0 && (
            <ul className="space-y-1.5">
              {q.issues.map((i, k) => (
                <li key={k} className={cn("flex gap-2 text-sm", i.severity === "error" ? "text-[#ff8fa3]" : i.severity === "warning" ? "text-amber" : "text-fg-2")}>
                  {i.severity === "error" ? <XCircle size={16} className="shrink-0 mt-0.5" /> : i.severity === "warning" ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <Info size={16} className="shrink-0 mt-0.5" />}
                  <span>{issueText(i, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title={t("analysis.uncertainty")} subtitle={u ? t("analysis.uncertaintyMethod") : t("analysis.uncertaintyNote")} />
          <CardBody>
            {u ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Stat label={t("analysis.sigmaOverall")} value={u.overallSigma.toFixed(2)} />
                <Stat label={t("analysis.sigmaProportion")} value={u.proportionSigma.toFixed(2)} />
                <Stat label={t("analysis.sigmaHarmony")} value={u.harmonySigma.toFixed(2)} />
                <Stat label={t("analysis.sigmaSymmetry")} value={u.symmetrySigma.toFixed(2)} />
                <Stat label={t("analysis.samples")} value={String(u.samples)} />
                <Stat label={t("analysis.jitter")} value={u.jitterPx.toFixed(2)} />
                {result.categories.map((c) => (
                  <Stat key={c.id} label={`σ ${categoryText(c.id, lang).label}`} value={c.sigma?.toFixed(2) ?? "—"} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-fg-3">{t("analysis.uncertaintyDisabled")}</div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("analysis.configuration")} />
          <CardBody className="text-sm text-fg-1 font-mono space-y-1">
            <div>includeReconstructed = {String(result.config.includeReconstructed)}</div>
            <div>captureDistance = {result.config.captureDistance}</div>
            <div>uncertaintySamples = {result.config.uncertaintySamples} · seed = {result.config.seed}</div>
            <div>engine = {result.engineVersion} · id = {analysisId}</div>
            <div className="pt-2">
              <ApiLink href={`/api/analyses/${analysisId}`} newTab>
                <Button variant="outline" size="sm">{t("analysis.rawJson")}</Button>
              </ApiLink>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function useRatioIndex(result: AnalysisResult) {
  return useMemo(() => Object.fromEntries(result.ratios.map((r) => [r.id, r])), [result.ratios]);
}
export { RATIO_DEFINITIONS };
