"use client";
/**
 * AI PSL Rater setup: rate a new frontal photo (in-browser detection, same
 * pipeline as battles) or a saved analysis; choose the scale, attach the latest
 * side view of the profile, set the minimum coverage, confirm consent.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanFace, ShieldCheck } from "lucide-react";
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
import { useRaterSetup } from "@/lib/battle-store";
import { useT } from "@/lib/i18n";
import { rememberSessionImage } from "@/lib/session-images";
import { useSettings } from "@/lib/settings";
import { warmUpLandmarker } from "@/lib/vision/landmarker";
import { buildAnalysisInput } from "@/lib/vision/pipeline";
import { fmt } from "@/lib/utils";
import type { AnalysisSummary, ProfileRow, SideAnalysisSummary } from "@/server/repos";
import type { ScaleSummary } from "@/server/repos-psl";
import { paths } from "@/lib/paths";

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

  useEffect(() => {
    warmUpLandmarker();
    s.initConfig({ captureDistance: settings.defaultCaptureDistance, includeReconstructed: settings.includeReconstructed, storeImages: settings.storeImagesByDefault });
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

  const rate = async () => {
    setBusy(true);
    setError(null);
    try {
      const common = { scaleId, minCoverage, consent: { rightsConfirmed: true as const, adultsConfirmed: true as const } };
      let res;
      if (mode === "upload") {
        const input = buildAnalysisInput(slot.prep!, slot.faceIndex, { includeReconstructed: s.config.includeReconstructed, captureDistance: s.config.captureDistance, uncertaintySamples: 40, seed: 20251106 }, { trichion: slot.trichion, trichionConfirmed: slot.trichionConfirmed, neck: slot.neck });
        res = await api.createRating({ ...common, newAnalysis: { profileLabel: slot.label.trim() || undefined, imageDataUrl: s.config.storeImages ? slot.prep!.image.dataUrl : undefined, storeImage: s.config.storeImages, input }, sideAnalysisId: null });
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
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
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
                <p className="text-xs text-fg-3">{t("rater.sideNone")} {t("rater.addSide")}: /side-view/new</p>
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
