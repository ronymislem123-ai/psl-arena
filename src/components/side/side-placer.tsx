"use client";
/**
 * New side-view analysis: upload a profile photo, place the 16 landmarks under
 * guidance (loupe, drag, arrow-key nudging), choose the profile, consent, save.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eraser, ImagePlus, Info, RefreshCw, Undo2, XCircle, ZoomIn } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Select, Toggle } from "@/components/ui/controls";
import { SideCanvas } from "@/components/side/side-canvas";
import { analyzeSideView, SIDE_LANDMARK_ORDER, type SideLandmarkId, type SidePoints } from "@/engine/side-view";
import type { Point } from "@/engine/types";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { SIDE_ISSUE_TEXTS, sideLandmarkText } from "@/lib/i18n/side-texts";
import { rememberSessionImage } from "@/lib/session-images";
import { useSettings } from "@/lib/settings";
import { loadImageFile, type LoadedImage } from "@/lib/vision/image";
import { cn, fmt } from "@/lib/utils";
import type { ProfileRow } from "@/server/repos";
import { paths } from "@/lib/paths";

const TOTAL = SIDE_LANDMARK_ORDER.length;

export function SidePlacer() {
  const { t, lang } = useT();
  const router = useRouter();
  const storeDefault = useSettings((s) => s.storeImagesByDefault);
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPointsState] = useState<Partial<SidePoints>>({});
  // mirror of the latest points for handlers that fire faster than React re-renders (dragging)
  const pointsRef = useRef<Partial<SidePoints>>({});
  const setPoints = (next: Partial<SidePoints>) => {
    pointsRef.current = next;
    setPointsState(next);
  };
  const [history, setHistory] = useState<SideLandmarkId[]>([]);
  const [current, setCurrent] = useState<SideLandmarkId | null>(SIDE_LANDMARK_ORDER[0]);
  const [selected, setSelected] = useState<SideLandmarkId | null>(null);
  const [loupe, setLoupe] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileId, setProfileId] = useState<string>("new");
  const [label, setLabel] = useState("");
  const [storeOverride, setStoreOverride] = useState<boolean | null>(null);
  const storeImage = storeOverride ?? storeDefault;
  const [rights, setRights] = useState(false);
  const [adult, setAdult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setHydrated(true));
    api
      .listProfiles()
      .then((r) => setProfiles(r.profiles))
      .catch(() => {});
    return () => cancelAnimationFrame(id);
  }, []);

  const onFiles = useCallback(async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadImageFile(f, f.name);
      setImg(loaded);
      setPoints({});
      setHistory([]);
      setCurrent(SIDE_LANDMARK_ORDER[0]);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const nextUnplaced = (pts: Partial<SidePoints>, after?: SideLandmarkId): SideLandmarkId | null => {
    const start = after ? SIDE_LANDMARK_ORDER.indexOf(after) + 1 : 0;
    for (let k = 0; k < TOTAL; k++) {
      const id = SIDE_LANDMARK_ORDER[(start + k) % TOTAL];
      if (!pts[id]) return id;
    }
    return null;
  };

  const place = (id: SideLandmarkId, p: Point) => {
    const wasPlaced = !!pointsRef.current[id];
    const next = { ...pointsRef.current, [id]: p };
    setPoints(next);
    if (!wasPlaced) {
      setHistory((h) => [...h, id]);
      setCurrent(nextUnplaced(next, id));
      setSelected(id);
    }
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    const next = { ...pointsRef.current };
    delete next[last];
    setPoints(next);
    setCurrent(last);
    setSelected(null);
  };
  const reset = () => {
    setPoints({});
    setHistory([]);
    setCurrent(SIDE_LANDMARK_ORDER[0]);
    setSelected(null);
  };
  const chooseStep = (id: SideLandmarkId) => {
    setCurrent(id);
    setSelected(points[id] ? id : null);
  };

  const placedCount = SIDE_LANDMARK_ORDER.filter((id) => points[id]).length;
  const allPlaced = placedCount === TOTAL;
  const preview = useMemo(() => (allPlaced ? analyzeSideView(points as SidePoints, { uncertaintySamples: 24 }) : null), [allPlaced, points]);
  const canSave = !!img && allPlaced && !!preview?.analyzable && rights && adult && !saving;

  const save = async () => {
    if (!img || !allPlaced) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.createSideAnalysis({
        profileId: profileId === "new" ? undefined : profileId,
        profileLabel: profileId === "new" ? label.trim() || undefined : undefined,
        imageDataUrl: storeImage ? img.dataUrl : undefined,
        storeImage,
        consent: { rightsConfirmed: true, adultsConfirmed: true },
        imageWidth: img.width,
        imageHeight: img.height,
        points: points as SidePoints,
      });
      rememberSessionImage(res.sideAnalysis.id, img.dataUrl);
      router.push(paths.sideView(res.sideAnalysis.id));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const currentText = current ? sideLandmarkText(current, lang) : null;

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("nav.sideView")} title={t("side.newTitle")} subtitle={t("side.newSub")} />
      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* left: image / placement */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 md:p-5" data-testid="side-upload" data-ready={hydrated ? "true" : "false"}>
            {!img ? (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void onFiles(e.dataTransfer.files);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={cn("min-h-[340px] rounded-2xl border-2 border-dashed grid place-items-center text-center cursor-pointer transition-colors p-6", dragOver ? "border-accent bg-accent/10" : "border-line-strong hover:border-accent/50 hover:bg-white/3")}
                  data-testid="side-dropzone"
                >
                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
                  {loading ? (
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
                  ) : (
                    <div className="space-y-3">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent">
                        <ImagePlus size={26} />
                      </div>
                      <div className="font-medium">{t("side.dropTitle")}</div>
                      <div className="text-xs text-fg-3 max-w-sm mx-auto">{t("side.dropSub")}</div>
                      {error && <div className="mx-auto max-w-xs rounded-lg bg-rose-soft border border-rose/30 px-3 py-2 text-xs text-[#ff8fa3]">{error}</div>}
                    </div>
                  )}
                </div>
                <ul className="mt-4 grid grid-cols-1 gap-1 text-xs text-fg-3">
                  <li className="font-mono uppercase tracking-wider text-fg-2 mb-1">{t("upload.guidelines")}</li>
                  {["g1", "g2", "g3", "g4", "g5"].map((k) => (
                    <li key={k} className="flex gap-2">
                      <span className="text-cyan">•</span> {t(`side.${k}`)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={allPlaced ? "mint" : "accent"} data-testid="side-placed">
                      {allPlaced ? <CheckCircle2 size={12} /> : null} {t("side.placed", { n: placedCount, total: TOTAL })}
                    </Badge>
                    {preview && (
                      <Badge tone="cyan">
                        {t("side.facing")}: {t(preview.facing === "left" ? "side.facingLeft" : "side.facingRight")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant={loupe ? "secondary" : "ghost"} onClick={() => setLoupe((v) => !v)} title={t("side.loupe")} aria-pressed={loupe}>
                      <ZoomIn size={14} /> {t("side.loupe")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={undo} disabled={history.length === 0} title={t("side.undo")} data-testid="side-undo">
                      <Undo2 size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={reset} disabled={placedCount === 0} title={t("side.reset")} data-testid="side-reset">
                      <Eraser size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()} title={t("common.replace")}>
                      <RefreshCw size={14} />
                    </Button>
                    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
                  </div>
                </div>
                <SideCanvas src={img.dataUrl} width={img.width} height={img.height} points={points} result={preview} loupe={loupe} edit={{ current, selected, onPlace: place, onSelect: (id) => setSelected(id) }} />
                <p className="text-[11px] text-fg-3">{t("side.nudge")}</p>
              </div>
            )}
          </div>

          {preview && (
            <Card data-testid="side-preview" data-state={preview.analyzable ? "analyzable" : "unusable"}>
              <CardHeader title={t("side.preview")} subtitle={preview.analyzable ? t("side.previewSub") : t("side.notUsable")} />
              <CardBody>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-fg-2">
                    {t("side.score")} · {preview.scoredCount} {t("side.scored")}
                  </div>
                  <div className={cn("font-display text-3xl font-semibold num", !preview.analyzable && "text-fg-3")}>{preview.analyzable ? fmt.score(preview.score, 1) : "—"}</div>
                </div>
                {preview.issues.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {preview.issues.map((i) => (
                      <li key={i.code} className={cn("flex gap-2 text-xs", i.severity === "error" ? "text-[#ff8fa3]" : "text-amber")}>
                        {i.severity === "error" ? <XCircle size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                        <span>{SIDE_ISSUE_TEXTS[lang][i.code]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* right: steps, profile, consent */}
        <div className="space-y-4">
          <Card strong>
            <CardBody className="pt-5">
              {currentText ? (
                <div data-testid="side-current" data-landmark={current ?? ""}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan/80">{t("side.hintTitle")}</div>
                  <div className="mt-1 font-display text-xl font-semibold">{t("side.placing", { name: currentText.name })}</div>
                  <p className="mt-1 text-sm text-fg-1">{currentText.hint}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-mint" data-testid="side-current" data-landmark="">
                  <CheckCircle2 size={16} /> {t("side.allPlaced")}
                </div>
              )}
              <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1" data-testid="side-steps">
                {SIDE_LANDMARK_ORDER.map((id, i) => {
                  const done = !!points[id];
                  const isCur = current === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => chooseStep(id)}
                        disabled={!img}
                        data-testid={`side-step-${id}`}
                        data-done={done ? "true" : "false"}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors border",
                          isCur ? "border-accent/50 bg-accent/10 text-fg-0" : "border-transparent hover:bg-white/5 text-fg-1",
                          selected === id && "ring-1 ring-mint/60",
                        )}
                      >
                        <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px]", done ? "bg-mint/20 text-mint" : "bg-white/10 text-fg-2")}>{done ? "✓" : i + 1}</span>
                        <span className="truncate">{sideLandmarkText(id, lang).name}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("side.profile")} />
            <CardBody className="space-y-3">
              <Select value={profileId} onChange={(e) => setProfileId(e.target.value)} aria-label={t("side.profile")} className="w-full" data-testid="side-profile-select">
                <option value="new">{t("side.newProfile")}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
              {profileId === "new" && <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("upload.labelPlaceholder")} aria-label={t("side.label")} maxLength={60} data-testid="side-label" />}
              <Toggle checked={storeImage} onChange={setStoreOverride} label={t("side.storeImage")} hint={t("side.storeImageHint")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("battle.consentTitle")} />
            <CardBody className="space-y-1">
              <Checkbox checked={rights} onChange={setRights} label={t("side.consentRights")} />
              <Checkbox checked={adult} onChange={setAdult} label={t("side.consentAdult")} />
              {!canSave && !saving && (
                <div className="flex items-start gap-2 pt-2 text-xs text-fg-3">
                  <Info size={14} className="mt-0.5 shrink-0" /> {t("side.missing")}
                </div>
              )}
              {saveError && (
                <div className="mt-2 rounded-lg bg-rose-soft border border-rose/30 px-3 py-2 text-xs text-[#ff8fa3]" role="alert">
                  {saveError}
                </div>
              )}
              <Button className="mt-3 w-full" size="lg" onClick={save} disabled={!canSave} loading={saving} data-testid="side-save">
                {saving ? t("side.saving") : t("side.save")}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
