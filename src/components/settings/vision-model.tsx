"use client";
/** Server edition: the vision model is configured by the operator (environment variables). */
import { useT } from "@/lib/i18n";
import { useVisionStatus, VisionModelShell } from "./vision-model-card";

export function VisionModelCard() {
  const { t } = useT();
  const [status] = useVisionStatus();
  return (
    <VisionModelShell status={status}>
      {!status?.configured && <p className="text-xs text-fg-2 font-mono">PSL_ARENA_VISION_PROVIDER=claude · ANTHROPIC_API_KEY=… · {t("settings.vision.optionalModel")} PSL_ARENA_VISION_MODEL</p>}
    </VisionModelShell>
  );
}
