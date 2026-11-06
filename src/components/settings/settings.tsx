"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, Toggle } from "@/components/ui/controls";
import { PageHeader } from "@/components/layout/app-shell";
import { BRAND } from "@/config/brand";
import { ENGINE_VERSION } from "@/engine/analysis";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { CaptureDistance } from "@/engine/types";

export function SettingsView() {
  const { t } = useT();
  const s = useSettings();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const deleteAll = async () => {
    if (!confirm(t("settings.deleteAllConfirm"))) return;
    await api.deleteAll();
    setMsg(t("settings.deleted"));
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("nav.settings")} title={t("settings.title")} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("settings.appearance")} />
          <CardBody className="space-y-2">
            <Field label={t("settings.language")}>
              <Select value={s.language} onChange={(e) => s.set({ language: e.target.value as "en" | "de" })} className="w-full">
                <option value="en">{t("settings.english")}</option>
                <option value="de">{t("settings.german")}</option>
              </Select>
            </Field>
            <Toggle checked={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} label={t("settings.reducedMotion")} hint={t("settings.reducedMotionHint")} />
            <Toggle checked={s.showMeshByDefault} onChange={(v) => s.set({ showMeshByDefault: v })} label={t("settings.showMesh")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.analysisOptions")} />
          <CardBody className="space-y-3">
            <Toggle checked={s.includeReconstructed} onChange={(v) => s.set({ includeReconstructed: v })} label={t("battle.includeReconstructed")} hint={t("battle.includeReconstructedHint")} />
            <Field label={t("battle.captureDistance")}>
              <Select value={s.defaultCaptureDistance} onChange={(e) => s.set({ defaultCaptureDistance: e.target.value as CaptureDistance })} className="w-full">
                <option value="unknown">{t("battle.captureUnknown")}</option>
                <option value="selfie">{t("battle.captureSelfie")}</option>
                <option value="standard">{t("battle.captureStandard")}</option>
              </Select>
            </Field>
            <Field label={t("settings.uncertaintySamples")}>
              <Select value={s.uncertaintySamples} onChange={(e) => s.set({ uncertaintySamples: Number(e.target.value) })} className="w-full">
                {[0, 20, 40, 80, 120].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.privacy")} icon={<ShieldCheck size={18} />} subtitle={t("settings.privacyNote")} />
          <CardBody className="space-y-3">
            <Toggle checked={s.storeImagesByDefault} onChange={(v) => s.set({ storeImagesByDefault: v })} label={t("battle.storeImages")} hint={t("battle.storeImagesHint")} />
            <div className="flex flex-wrap gap-2 pt-2">
              <a href="/api/data" download>
                <Button variant="outline" size="sm">
                  <Download size={14} /> {t("settings.exportData")}
                </Button>
              </a>
              <Button variant="danger" size="sm" onClick={deleteAll}>
                <Trash2 size={14} /> {t("settings.deleteAll")}
              </Button>
            </div>
            {msg && <div className="text-sm text-mint">{msg}</div>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.about")} />
          <CardBody className="text-sm text-fg-2 space-y-2">
            <div className="font-mono text-xs">
              {BRAND.name} v{BRAND.version} · engine {ENGINE_VERSION} · MediaPipe Face Landmarker (478 points) · runs in-browser
            </div>
            <p>{t("settings.ethics")}</p>
            <p className="text-xs text-fg-3">Reference ranges come from a community facial-harmony guide and are not validated beauty standards. See docs/RATIOS.md and docs/SCORING.md in the repository.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
