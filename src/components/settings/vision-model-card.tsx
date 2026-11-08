"use client";
/**
 * Vision-model status (shared by both editions). The server edition only shows the
 * operator configuration; the browser edition adds a form for the user's own key
 * (vision-model.static.tsx).
 */
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

export type VisionStatus = { configured: boolean; model: string | null; hint: string | null } | null;

export function useVisionStatus(): [VisionStatus, () => void] {
  const [status, setStatus] = useState<VisionStatus>(null);
  const refresh = () => void api.rubric().then((r) => setStatus(r.visualProvider)).catch(() => setStatus(null));
  useEffect(refresh, []);
  return [status, refresh];
}

export function VisionModelShell({ status, children }: { status: VisionStatus; children?: React.ReactNode }) {
  const { t } = useT();
  return (
    <Card data-testid="vision-model-card" data-configured={status?.configured ? "true" : "false"}>
      <CardHeader title={t("settings.vision.title")} subtitle={t("settings.vision.sub")} icon={<Eye size={18} />} />
      <CardBody className="space-y-3 text-sm">
        <div className={status?.configured ? "text-mint" : "text-fg-2"} data-testid="vision-model-status">
          {status?.configured ? t("settings.vision.active", { model: status.model ?? "" }) : t("settings.vision.inactive")}
        </div>
        {children}
        <p className="text-xs text-fg-3">{t("settings.vision.privacy")}</p>
      </CardBody>
    </Card>
  );
}
