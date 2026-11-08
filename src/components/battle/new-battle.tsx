"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Select, Toggle } from "@/components/ui/controls";
import { PageHeader } from "@/components/layout/app-shell";
import { UploadSlot } from "./upload-slot";
import { useBattleSetup } from "@/lib/battle-store";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { warmUpLandmarker } from "@/lib/vision/landmarker";
import type { CaptureDistance } from "@/engine/types";
import { paths } from "@/lib/paths";

export function NewBattle() {
  const { t } = useT();
  const router = useRouter();
  const s = useBattleSetup();
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    warmUpLandmarker();
    s.initConfig({ captureDistance: settings.defaultCaptureDistance, includeReconstructed: settings.includeReconstructed, storeImages: settings.storeImagesByDefault });
    // bring back the photos of this tab after a reload or a browser crash
    void s.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = s.a.status === "ready" && s.b.status === "ready" && !!s.a.preview?.quality.analyzable && !!s.b.preview?.quality.analyzable && s.consent.rights && s.consent.adults;

  const start = async () => {
    setError(null);
    try {
      const id = await s.start();
      s.reset();
      router.push(paths.battle(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader kicker="Battle setup" title={t("battle.newTitle")} subtitle={t("battle.newSub")} />
      {s.restored && (
        <div className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm text-fg-1" data-testid="setup-restored">
          {t("battle.restored")}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
        <UploadSlot side="a" />
        <div className="hidden lg:flex items-center justify-center">
          <div className="font-display text-4xl font-bold text-fg-3 tracking-widest select-none">VS</div>
        </div>
        <UploadSlot side="b" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("battle.config")} />
          <CardBody className="space-y-4">
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
        <Card>
          <CardHeader title={t("battle.consentTitle")} icon={<ShieldCheck size={18} />} />
          <CardBody className="space-y-2">
            <Checkbox checked={s.consent.rights} onChange={(v) => s.setConsent({ rights: v })} label={t("battle.consentRights")} />
            <Checkbox checked={s.consent.adults} onChange={(v) => s.setConsent({ adults: v })} label={t("battle.consentAdults")} />
            <p className="text-xs text-fg-3 pt-2">{t("settings.ethics")}</p>
          </CardBody>
        </Card>
      </div>

      <div className="glass-strong rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-fg-2">{ready ? "" : t("battle.missing")}{error && <span className="text-[#ff8fa3]"> {error}</span>}</div>
        <Button size="lg" disabled={!ready} loading={s.submitting} onClick={start} data-testid="start-battle">
          <Swords size={18} /> {s.submitting ? t("battle.starting") : t("battle.start")}
        </Button>
      </div>
    </div>
  );
}
