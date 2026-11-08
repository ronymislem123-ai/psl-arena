"use client";
/**
 * AI PSL Rater setup: rate a new frontal photo (in-browser detection, same
 * pipeline as battles) plus an optional profile photo (automatic side view, no
 * manual points needed) or a saved analysis; choose the scale, set the minimum
 * coverage, confirm consent, and optionally allow the vision model for the
 * visual criteria (explicit consent to send the photo, per rating).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, ImagePlus, PenLine, ScanFace, ShieldCheck, XCircle } from "lucide-react";
import { UploadSlot } from "@/components/battle/upload-slot";
import { PageHeader } from "@/components/layout/app-shell";
import { ScaleBar } from "@/components/psl/tier-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Select, Tabs, Toggle } from "@/components/ui/controls";
import { DEFAULT_MIN_COVERAGE } from "@/engine/psl/rubric";
import { BUILTIN_SCALE_ID, type PslScale } from "@/engine/psl/scale";
import type { CaptureDistance } from "@/engine/types";
import { api } from "@/lib/api";
import { slotManual, useRaterSetup } from "@/lib/battle-store";
import { useT } from "@/lib/i18n";
import { rememberSessionImage } from "@/lib/session-images";
import { useSettings } from "@/lib/settings";
import { warmUpLandmarker } from "@/lib/vision/landmarker";
import { buildAnalysisInput } from "@/lib/vision/pipeline";
import { loadImageFile, type LoadedImage } from "@/lib/vision/image";
import { detectProfile, looksFrontal, warmUpSegmenter, type AutoProfileRun } from "@/lib/vision/profile";
import { SIDE_LANDMARK_ORDER } from "@/engine/side-view";
import { fmt } from "@/lib/utils";
import type { AnalysisSummary, ProfileRow, SideAnalysisSummary } from "@/server/repos";
import type { ScaleSummary } from "@/server/repos-psl";
import { paths } from "@/lib/paths";
import { criterionName } from "@/lib/i18n/psl-texts";
import type { CriterionId } from "@/engine/psl/rubric";

const SELF_CRITERIA = ["eyeShape", "lipShape", "cheekboneProjection", "jawlineDefinition"] as const satisfies readonly CriterionId[];
type SelfCriterion = (typeof SELF_CRITERIA)[number];

type Mode = "upload" | "existing";

export function RaterSetup({ scales, profiles, initialProfileId }: { scales: ScaleSummary[]; profiles: ProfileRow[]; initialProfileId?: string }) {
  const { t, lang } = useT();
  const router = useRouter();
  const s = useRaterSetup();
  const settings = useSettings();
  const [mode, setMode] = useState<Mode>(initialProfileId ? "existing" : "upload");
  const [scaleId, setScaleId] = useState(BUILTIN_SCALE_ID);
  const [scale, setScale] = useState<PslScale | null>(null);
  const [profileId, setProfileId] = useState(initialProfileId ?? profiles[0]?.id ?? "");
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [analysisId, setAnalysisId] = useState("");
  const [sides, setSides] = useState<SideAnalysisSummary[]>([]);
  const [sideChoice, setSideChoice] = useState<"latest" | "none">("latest");
  const [minCoverage, setMinCoverage] = useState(DEFAULT_MIN_COVERAGE);
  const [rights, setRights] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // optional profile photo → automatic side view
  const [sideImg, setSideImg] = useState<LoadedImage | null>(null);
  const [sideRun, setSideRun] = useState<AutoProfileRun | null>(null);
  const [sideBusy, setSideBusy] = useState(false);
  const [sideErr, setSideErr] = useState<string | null>(null);
  // vision model for the visual criteria
  const [vision, setVision] = useState<{ configured: boolean; model: string | null; hint: string | null } | null>(null);
  const [visualConsent, setVisualConsent] = useState(false);
  // optional self-assessment of the visual criteria (free alternative to the model)
  const [selfOn, setSelfOn] = useState(false);
  const [selfValues, setSelfValues] = useState<Partial<Record<SelfCriterion, number>>>({});

  useEffect(() => {
    api.rubric().then((r) => setVision(r.visualProvider)).catch(() => setVision(null));
  }, []);
  useEffect(() => {
    warmUpLandmarker();
    warmUpSegmenter();
    s.initConfig({ captureDistance: settings.defaultCaptureDistance, includeReconstructed: settings.includeReconstructed, storeImages: settings.storeImagesByDefault });
    // bring back the photo of this tab after a reload or a browser crash
    void s.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let alive = true;
    api.getScale(scaleId).then((r) => alive && setScale(r.scale)).catch(() => alive && setScale(null));
    return () => {
      alive = false;
    };
  }, [scaleId]);
  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    Promise.all([api.listAnalyses(profileId), api.listSideAnalyses(profileId)])
      .then(([a, sv]) => {
        if (!alive) return;
        const usable = a.analyses.filter((x) => x.analyzable);
        setAnalyses(usable);
        setAnalysisId(usable[0]?.id ?? "");
        setSides(sv.sideAnalyses.filter((x) => x.analyzable));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profileId]);

  const slot = s.a;
  const uploadReady = slot.status === "ready" && !!slot.preview?.quality.analyzable;
  const ready = (mode === "upload" ? uploadReady : !!analysisId) && rights && adult && !busy;
  const latestSide = sides[0];
  const sideUsable = !!sideRun?.result.ok && !looksFrontal(sideRun.quality);

  const onSideFile = async (f: File | undefined) => {
    if (!f) return;
    setSideBusy(true);
    setSideErr(null);
    setSideRun(null);
    try {
      const loaded = await loadImageFile(f, f.name);
      setSideImg(loaded);
      setSideRun(await detectProfile(loaded.canvas));
    } catch (e) {
      setSideErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSideBusy(false);
    }
  };

  const rate = async () => {
    setBusy(true);
    setError(null);
    try {
      const consentToModel = !!vision?.configured && visualConsent;
      const common = { scaleId, minCoverage, consent: { rightsConfirmed: true as const, adultsConfirmed: true as const }, visualConsent: consentToModel, lang, selfAssessment: selfOn && Object.keys(selfValues).length ? selfValues : null };
      let res;
      if (mode === "upload") {
        const input = buildAnalysisInput(slot.prep!, slot.faceIndex, { includeReconstructed: s.config.includeReconstructed, captureDistance: s.config.captureDistance, uncertaintySamples: 40, seed: 20251106 }, slotManual(slot));
        // automatic side view first, so that the rating includes the profile criteria
        let side: { id: string; profileId: string } | null = null;
        if (sideUsable && sideImg && sideRun) {
          const sr = await api.createSideAnalysis({
            profileLabel: slot.label.trim() || undefined,
            imageDataUrl: s.config.storeImages ? sideImg.dataUrl : undefined,
            storeImage: s.config.storeImages,
            consent: { rightsConfirmed: true, adultsConfirmed: true },
            imageWidth: sideImg.width,
            imageHeight: sideImg.height,
            points: sideRun.result.points,
            placement: "automatic",
            pointSources: sideRun.result.sources,
          });
          side = { id: sr.sideAnalysis.id, profileId: sr.sideAnalysis.profileId };
          rememberSessionImage(sr.sideAnalysis.id, sideImg.dataUrl);
        }
        res = await api.createRating({
          ...common,
          newAnalysis: { profileId: side?.profileId, profileLabel: side ? undefined : slot.label.trim() || undefined, imageDataUrl: s.config.storeImages ? slot.prep!.image.dataUrl : undefined, storeImage: s.config.storeImages, input },
          sideAnalysisId: side?.id ?? null,
          visualImageDataUrl: consentToModel ? slot.prep!.image.dataUrl : undefined,
        });
        if (res.rating.analysisId) rememberSessionImage(res.rating.analysisId, slot.prep!.image.dataUrl);
        s.reset();
      } else {
        res = await api.createRating({ ...common, analysisId, sideAnalysisId: sideChoice === "none" ? null : undefined, useLatestSide: sideChoice === "latest" });
      }
      router.push(paths.rating(res.rating.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const sideLabel = useMemo(() => (latestSide ? t("rater.sideLatest", { date: fmt.date(latestSide.createdAt, lang) }) : t("rater.sideNone")), [latestSide, lang, t]);

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.rater")} title={t("rater.title")} subtitle={t("rater.sub")} action={<Tabs tabs={[{ id: "upload", label: t("rater.modeUpload") }, { id: "existing", label: t("rater.modeExisting") }]} value={mode} onChange={(m) => setMode(m)} />} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {mode === "upload" ? (
            <UploadSlot side="a" store={useRaterSetup} title={t("rater.uploadLabel")} />
          ) : (
            <Card>
              <CardHeader title={t("rater.modeExisting")} />
              <CardBody className="space-y-3">
                <Field label={t("nav.profiles")}>
                  <Select value={profileId} onChange={(e) => setProfileId(e.target.value)} className="w-full" data-testid="rater-profile">
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("rater.chooseAnalysis")}>
                  {analyses.length ? (
                    <Select value={analysisId} onChange={(e) => setAnalysisId(e.target.value)} className="w-full" data-testid="rater-analysis">
                      {analyses.map((a) => (
                        <option key={a.id} value={a.id}>{fmt.date(a.createdAt, lang)} · {t("common.overall")} {fmt.score(a.overall, 1)} · {t("common.coverage")} {fmt.pct(a.coverageFraction)}</option>
                      ))}
                    </Select>
                  ) : (
                    <div className="text-sm text-fg-3">{t("rater.noAnalyses")}</div>
                  )}
                </Field>
                <Field label={t("rater.profileView")} hint={t("rater.profileViewHint")}>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" name="side" checked={sideChoice === "latest"} disabled={!latestSide} onChange={() => setSideChoice("latest")} className="accent-[#4f7cff]" /> {sideLabel}</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" name="side" checked={sideChoice === "none" || !latestSide} onChange={() => setSideChoice("none")} className="accent-[#4f7cff]" /> {t("rater.sideSkip")}</label>
                    <Link href={`/side-view/new`} className="text-xs text-accent underline underline-offset-2">{t("rater.addSide")} →</Link>
                  </div>
                </Field>
              </CardBody>
            </Card>
          )}
          {mode === "upload" && (
            <Card>
              <CardHeader title={t("battle.config")} />
              <CardBody className="space-y-3">
                <Field label={t("battle.captureDistance")}>
                  <Select value={s.config.captureDistance} onChange={(e) => s.setConfig({ captureDistance: e.target.value as CaptureDistance })} className="w-full">
                    <option value="unknown">{t("battle.captureUnknown")}</option>
                    <option value="selfie">{t("battle.captureSelfie")}</option>
                    <option value="standard">{t("battle.captureStandard")}</option>
                  </Select>
                </Field>
                <Toggle checked={s.config.includeReconstructed} onChange={(v) => s.setConfig({ includeReconstructed: v })} label={t("battle.includeReconstructed")} hint={t("battle.includeReconstructedHint")} />
                <Toggle checked={s.config.storeImages} onChange={(v) => s.setConfig({ storeImages: v })} label={t("battle.storeImages")} hint={t("battle.storeImagesHint")} />
              </CardBody>
            </Card>
          )}
          {mode === "upload" && (
            <Card data-testid="rater-side">
              <CardHeader title={t("rater.sidePhoto")} subtitle={t("rater.sidePhotoHint")} icon={<ImagePlus size={18} />} />
              <CardBody className="space-y-2 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-xs hover:bg-white/5">
                  <ImagePlus size={14} /> {sideImg ? t("common.replace") : t("rater.sideChoose")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void onSideFile(e.target.files?.[0])} data-testid="rater-side-input" />
                </label>
                {sideBusy && <div className="flex items-center gap-2 text-fg-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" /> {t("side.auto.running")}</div>}
                {sideErr && <div className="text-[#ff8fa3]">{sideErr}</div>}
                {sideImg && sideRun && (
                  <div className="flex gap-3" data-testid="rater-side-state" data-state={sideUsable ? "ok" : "failed"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sideImg.dataUrl} alt="" className="h-20 w-16 rounded-md object-cover" />
                    <div className="space-y-1 text-xs">
                      {sideUsable ? (
                        <div className="flex items-center gap-1 text-mint"><CheckCircle2 size={14} /> {t("side.auto.ok", { n: Object.keys(sideRun.result.points).length, total: SIDE_LANDMARK_ORDER.length })}</div>
                      ) : looksFrontal(sideRun.quality) ? (
                        <div className="flex items-center gap-1 text-[#ff8fa3]"><XCircle size={14} /> {t("side.auto.frontal", { deg: Math.round(sideRun.quality.frontalFaceYawDeg ?? 0) })}</div>
                      ) : (
                        <div className="flex items-center gap-1 text-[#ff8fa3]"><XCircle size={14} /> {t("side.auto.failed")}: {sideRun.result.issues.filter((i) => i.severity === "error").map((i) => t(`side.auto.issue.${i.code}`)).join(" ")}</div>
                      )}
                      {sideUsable && <div className="text-fg-3">{t("rater.sideAutoNote")}</div>}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card strong>
            <CardHeader title={t("rater.scale")} subtitle={t("rater.scaleHint")} />
            <CardBody className="space-y-3">
              <Select value={scaleId} onChange={(e) => setScaleId(e.target.value)} className="w-full" data-testid="rater-scale">
                {scales.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}{sc.builtIn ? ` (${t("scales.builtIn")})` : ""} · {t("scales.tierCount", { n: sc.tierCount })}</option>
                ))}
              </Select>
              {scale && <ScaleBar tiers={scale.tiers} rangeMin={scale.rangeMin} rangeMax={scale.rangeMax} />}
              <Field label={`${t("rater.minCoverage")}: ${Math.round(minCoverage * 100)} %`} hint={t("rater.minCoverageHint")}>
                <input type="range" min={50} max={95} step={5} value={Math.round(minCoverage * 100)} onChange={(e) => setMinCoverage(Number(e.target.value) / 100)} className="w-full accent-[#4f7cff]" data-testid="rater-min-coverage" />
              </Field>
            </CardBody>
          </Card>
          <Card data-testid="rater-vision" data-configured={vision?.configured ? "true" : "false"}>
            <CardHeader title={t("rater.vision.title")} subtitle={t("rater.vision.sub")} icon={<Eye size={18} />} />
            <CardBody className="space-y-2 text-xs">
              {vision?.configured ? (
                <>
                  <Checkbox checked={visualConsent} onChange={setVisualConsent} label={t("rater.vision.consent", { model: vision.model ?? "" })} />
                  <p className="text-fg-3">{t("rater.vision.privacy")}</p>
                </>
              ) : (
                <p className="text-fg-2">{t(vision?.hint === "browserKey" ? "rater.vision.setupBrowser" : vision?.hint === "missingKey" ? "rater.vision.setupKey" : "rater.vision.setupServer")} <Link href="/settings" className="text-accent underline underline-offset-2">{t("rater.vision.toSettings")}</Link></p>
              )}
            </CardBody>
          </Card>
          <Card data-testid="rater-self">
            <CardHeader title={t("rater.self.title")} subtitle={t("rater.self.sub")} icon={<PenLine size={18} />} />
            <CardBody className="space-y-3 text-xs">
              <Toggle checked={selfOn} onChange={setSelfOn} label={t("rater.self.enable")} />
              {selfOn && (
                <>
                  {SELF_CRITERIA.map((c) => {
                    const v = selfValues[c];
                    return (
                      <div key={c} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-fg-1 text-sm min-w-0">{criterionName(c, lang)}</span>
                          <span className="shrink-0 font-mono num text-fg-0" data-testid={`self-value-${c}`}>{v == null ? t("rater.self.skip") : `${fmt.score(v, 1)} / 10`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={10} step={0.5} value={v ?? 5} onChange={(e) => setSelfValues((o) => ({ ...o, [c]: Number(e.target.value) }))} className={`min-w-0 flex-1 accent-[#f0506e] ${v == null ? "opacity-40" : ""}`} aria-label={criterionName(c, lang)} data-testid={`self-${c}`} />
                          {v != null && (
                            <button type="button" className="shrink-0 text-fg-3 underline underline-offset-2 hover:text-fg-1" onClick={() => setSelfValues((o) => { const n = { ...o }; delete n[c]; return n; })}>{t("rater.self.skip")}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-fg-3">{t("rater.self.note")}</p>
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("battle.consentTitle")} icon={<ShieldCheck size={18} />} />
            <CardBody className="space-y-2">
              <Checkbox checked={rights} onChange={setRights} label={t("side.consentRights")} />
              <Checkbox checked={adult} onChange={setAdult} label={t("side.consentAdult")} />
              <p className="text-xs text-fg-3 pt-1">{t("settings.ethics")}</p>
              {error && <div className="rounded-lg bg-rose-soft border border-rose/30 px-3 py-2 text-xs text-[#ff8fa3]" role="alert">{error}</div>}
              {!ready && !busy && <div className="text-xs text-fg-3">{t("rater.missing")}</div>}
              <Button className="w-full mt-2" size="lg" disabled={!ready} loading={busy} onClick={rate} data-testid="rate-button">
                <ScanFace size={18} /> {busy ? t("rater.rating") : t("rater.rate")}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
