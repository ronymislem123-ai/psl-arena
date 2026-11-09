"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Info, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, levelTone } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/controls";
import { LandmarkCanvas, LAYERS, type LayerId } from "@/components/viz/landmark-canvas";
import { CapturePanel } from "@/components/shared/capture-panel";
import { useBattleSetup, type SetupStore, type Side } from "@/lib/battle-store";
import { useT } from "@/lib/i18n";
import { issueText, metricText } from "@/lib/i18n/engine-text";
import { useSettings } from "@/lib/settings";
import { cn, fmt } from "@/lib/utils";

export function UploadSlot({ side, store = useBattleSetup, title: titleOverride }: { side: Side; store?: SetupStore; title?: string }) {
  const { t, lang } = useT();
  const slot = store((s) => s[side]);
  const { loadFile, clear, setLabel, setFaceIndex, setTrichion, confirmTrichion, resetTrichion, hideTrichion, setNeck, setNeckPlacing, setCorrecting, moveLandmark, setAxisAdjust, resetCorrections } = store();
  const showMeshDefault = useSettings((s) => s.showMeshByDefault);
  const [layer, setLayer] = useState<LayerId>("landmarks");
  const [showMesh, setShowMesh] = useState(showMeshDefault);
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void loadFile(side, f);
  };

  const title = titleOverride ?? (side === "a" ? t("common.person1") : t("common.person2"));
  const accent = side === "a" ? "text-accent" : "text-violet";

  if (slot.status === "empty" || slot.status === "loading" || slot.status === "error") {
    return (
      <div className="glass rounded-2xl p-5 flex flex-col" data-testid={`slot-${side}`} data-ready={hydrated ? "true" : "false"}>
        <div className="flex items-center justify-between mb-3">
          <div className={cn("font-display font-semibold tracking-wide", accent)}>{title}</div>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex-1 min-h-[300px] rounded-2xl border-2 border-dashed grid place-items-center text-center cursor-pointer transition-colors p-6",
            dragOver ? "border-accent bg-accent/10" : "border-line-strong hover:border-accent/50 hover:bg-white/3",
          )}
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFiles(e.target.files)} />
          {slot.status === "loading" ? (
            <div className="space-y-3">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
              <div className="text-sm text-fg-1">{t("upload.analyzing")}</div>
              <div className="text-xs text-fg-3">{t("upload.loadingModel")}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent">
                <ImagePlus size={26} />
              </div>
              <div className="font-medium">{t("upload.dropTitle")}</div>
              <div className="text-xs text-fg-3">{t("upload.dropSub")}</div>
              {slot.status === "error" && (
                <div className="mx-auto max-w-xs rounded-lg bg-rose-soft border border-rose/30 px-3 py-2 text-xs text-[#ff8fa3]">
                  {slot.error === "no-face" ? t("upload.noFace") : slot.error}
                </div>
              )}
            </div>
          )}
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-1 text-xs text-fg-3">
          <li className="font-mono uppercase tracking-wider text-fg-2 mb-1">{t("upload.guidelines")}</li>
          {["g1", "g2", "g3", "g4", "g5"].map((k) => (
            <li key={k} className="flex gap-2">
              <span className="text-cyan">•</span> {t(`upload.${k}`)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const prep = slot.prep!;
  const preview = slot.preview;
  const q = preview?.quality;
  const est = prep.hairline[slot.faceIndex];
  const hasTrichion = !!preview?.landmarks.find((l) => l.id === "trichion");
  const hairCovered = preview?.warningCodes?.find((w) => w.code === "hairlineCovered");
  const hairLow = preview?.warningCodes?.find((w) => w.code === "hairlineLow");
  const hairHidden = slot.trichion === null;
  const nCorrected = Object.keys(slot.corrections.landmarks ?? {}).length;

  return (
    <div className="glass rounded-2xl p-4 md:p-5 flex flex-col gap-4" data-testid={`slot-${side}`} data-ready="true" data-state={q ? (q.analyzable ? "analyzable" : "unusable") : "pending"}>
      <div className="flex items-center justify-between gap-3">
        <div className={cn("font-display font-semibold tracking-wide", accent)}>{title}</div>
        <div className="flex items-center gap-2">
          {q && (
            <Badge tone={levelTone(q.level)}>
              {q.analyzable ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {t(`quality.${q.level}`)}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} title={t("common.replace")}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clear(side)} title={t("common.remove")}>
            <Trash2 size={14} />
          </Button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input value={slot.label} onChange={(e) => setLabel(side, e.target.value)} placeholder={t("upload.labelPlaceholder")} aria-label={t("upload.label")} maxLength={60} />
        {prep.faces.length > 1 && (
          <Select value={slot.faceIndex} onChange={(e) => setFaceIndex(side, Number(e.target.value))} aria-label={t("upload.multipleFaces")}>
            {prep.faces.map((f, i) => (
              <option key={i} value={i}>
                {t("upload.faceN", { n: i + 1 })}
              </option>
            ))}
          </Select>
        )}
      </div>

      {preview && (
        <LandmarkCanvas
          imageSrc={prep.image.dataUrl}
          width={prep.image.width}
          height={prep.image.height}
          result={preview}
          layer={layer}
          showMesh={showMesh}
          edit={{
            trichion: true,
            neck: true,
            neckPlacing: slot.neckPlacing,
            onTrichionChange: (p) => setTrichion(side, p),
            onNeckChange: (pts) => setNeck(side, pts),
            landmarks: slot.correcting,
            onLandmarkMove: (id, p) => moveLandmark(side, id, p),
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={layer} onChange={(e) => setLayer(e.target.value as LayerId)} className="h-8 text-xs" aria-label={t("upload.layers")}>
          {LAYERS.map((l) => (
            <option key={l} value={l}>
              {t(`analysis.layers.${l}`)}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-fg-2">
          <input type="checkbox" checked={showMesh} onChange={(e) => setShowMesh(e.target.checked)} className="accent-[#4f7cff]" /> {t("analysis.layers.mesh")}
        </label>
      </div>

      {/* hairline */}
      <div className="rounded-xl border border-line bg-bg-1/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("upload.hairline")}</div>
          {slot.trichionConfirmed ? (
            <Badge tone="mint">
              <CheckCircle2 size={12} /> {t("upload.hairlineConfirmed")}
            </Badge>
          ) : hairHidden ? (
            <Badge tone="muted">{t("upload.hairlineHidden")}</Badge>
          ) : hairCovered ? (
            <Badge tone="amber" data-testid={`hairline-covered-${side}`}>
              <AlertTriangle size={12} /> {t("upload.hairlineCovered")}
            </Badge>
          ) : hasTrichion ? (
            <Badge tone="amber">{slot.trichion ? t("upload.hairlinePlaced") : t("upload.hairlineEstimated", { pct: ((est?.confidence ?? 0) * 100).toFixed(0) })}</Badge>
          ) : (
            <Badge tone="rose">
              <AlertTriangle size={12} /> {t("upload.hairlineMissing")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-fg-3">{t("upload.hairlineHint")}</p>
        {hairCovered && <p className="text-xs text-amber">{t("upload.hairlineCoveredNote", { share: hairCovered.params?.share ?? "?" })}</p>}
        {hairLow && <p className="text-xs text-amber">{t("upload.hairlineLowNote", { share: hairLow.params?.share ?? "?" })}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={slot.trichionConfirmed ? "secondary" : "outline"} onClick={() => confirmTrichion(side)} disabled={!hasTrichion || slot.trichionConfirmed}>
            {t("upload.hairlineConfirm")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => resetTrichion(side)} disabled={!est || slot.trichion === undefined}>
            {t("upload.hairlineReset")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => hideTrichion(side)} disabled={hairHidden} data-testid={`hairline-hide-${side}`}>
            {t("upload.hairlineHide")}
          </Button>
        </div>
      </div>

      {/* neck */}
      <div className="rounded-xl border border-line bg-bg-1/50 p-3 space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("upload.neck")}</div>
        <p className="text-xs text-fg-3">{t("upload.neckHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={slot.neckPlacing ? "primary" : "outline"} onClick={() => setNeckPlacing(side, !slot.neckPlacing)}>
            {t("upload.neckPlace")}
          </Button>
          {slot.neck && (
            <Button size="sm" variant="ghost" onClick={() => setNeck(side, null)}>
              {t("upload.neckClear")}
            </Button>
          )}
        </div>
      </div>

      {/* manual landmark / axis correction */}
      <div className="rounded-xl border border-line bg-bg-1/50 p-3 space-y-2" data-testid={`correct-${side}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("upload.correct")}</div>
          {nCorrected + (slot.corrections.axisAdjustDeg ? 1 : 0) > 0 && <Badge tone="rose">{t("upload.correctedN", { n: nCorrected })}{slot.corrections.axisAdjustDeg ? ` · ${slot.corrections.axisAdjustDeg > 0 ? "+" : ""}${slot.corrections.axisAdjustDeg.toFixed(1)}°` : ""}</Badge>}
        </div>
        <p className="text-xs text-fg-3">{t("upload.correctHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={slot.correcting ? "primary" : "outline"} onClick={() => setCorrecting(side, !slot.correcting)} data-testid={`correct-toggle-${side}`}>
            {slot.correcting ? t("upload.correctOff") : t("upload.correctOn")}
          </Button>
          {(nCorrected > 0 || !!slot.corrections.axisAdjustDeg) && (
            <Button size="sm" variant="ghost" onClick={() => resetCorrections(side)}>
              {t("upload.resetCorrections")}
            </Button>
          )}
        </div>
        {slot.correcting && (
          <label className="block text-xs text-fg-2">
            <span className="flex justify-between"><span>{t("upload.axisAdjust")}</span><span className="font-mono num">{(slot.corrections.axisAdjustDeg ?? 0).toFixed(1)}°</span></span>
            <input type="range" min={-15} max={15} step={0.5} value={slot.corrections.axisAdjustDeg ?? 0} onChange={(e) => setAxisAdjust(side, Number(e.target.value))} className="w-full accent-[#f0506e]" aria-label={t("upload.axisAdjust")} data-testid={`axis-${side}`} />
            <span className="text-[11px] text-fg-3">{t("upload.axisAdjustHint")}</span>
          </label>
        )}
      </div>

      {/* quality */}
      {q && (
        <div className="rounded-xl border border-line bg-bg-1/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("upload.qualityTitle")}</div>
            <div className="font-mono text-xs text-fg-2">{fmt.pct(q.score)}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {q.metrics.map((m) => (
              <div key={m.id} className="rounded-lg bg-white/3 px-2 py-1.5">
                <div className="text-[10px] text-fg-3 truncate" title={metricText(m, lang).label}>{metricText(m, lang).label}</div>
                <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
                  <span className="min-w-0 font-mono text-xs num">
                    {m.value}
                    {metricText(m, lang).unit && metricText(m, lang).unit.length <= 5 && <span className="text-fg-3"> {metricText(m, lang).unit}</span>}
                  </span>
                  <Badge tone={levelTone(m.level)} className="px-1 py-0 text-[9px]">
                    {t(`quality.${m.level}`)}
                  </Badge>
                </div>
                {metricText(m, lang).unit && metricText(m, lang).unit.length > 5 && <div className="mt-0.5 text-[10px] leading-tight text-fg-3">{metricText(m, lang).unit}</div>}
              </div>
            ))}
          </div>
          {q.issues.length > 0 && (
            <ul className="space-y-1 pt-1">
              {q.issues.map((i, k) => (
                <li key={k} className={cn("flex gap-2 text-xs", i.severity === "error" ? "text-[#ff8fa3]" : i.severity === "warning" ? "text-amber" : "text-fg-2")}>
                  {i.severity === "error" ? <XCircle size={14} className="shrink-0 mt-0.5" /> : i.severity === "warning" ? <AlertTriangle size={14} className="shrink-0 mt-0.5" /> : <Info size={14} className="shrink-0 mt-0.5" />}
                  <span>{issueText(i, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {q && <CapturePanel capture={q.capture} compact />}

      {/* preview score — never shown for unusable images (no seemingly precise values) */}
      {preview && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-bg-1/50 p-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("upload.preview")}</div>
            <div className="text-[11px] text-fg-3">{preview.quality.analyzable ? t("upload.previewSub") : t("upload.notReady")}</div>
            {preview.quality.analyzable && (
              <div className="text-[11px] text-fg-3 mt-1">
                {t("common.coverage")} {preview.coverage.evaluable}/{preview.coverage.total} · {t("common.confidence")} {fmt.pct(preview.scores.confidence)}
              </div>
            )}
          </div>
          <div className={cn("font-display text-3xl font-semibold num", !preview.quality.analyzable && "text-fg-3")}>{preview.quality.analyzable ? fmt.score(preview.scores.overall, 1) : "—"}</div>
        </div>
      )}
    </div>
  );
}
