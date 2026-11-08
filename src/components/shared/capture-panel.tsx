"use client";
import { Camera } from "lucide-react";
import type { CaptureReport } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { BASIS_LABELS, CAPTURE_LABELS, captureText } from "@/lib/i18n/capture-texts";
import { cn } from "@/lib/utils";

const BASIS_TONE = { measured: "text-mint", derived: "text-cyan", inferred: "text-amber", undeterminable: "text-fg-3" } as const;

/** Capture pre-analysis: what kind of photo this is, each item with its basis (measured / derived / inferred / not determinable). */
export function CapturePanel({ capture, compact = false, className }: { capture: CaptureReport | undefined; compact?: boolean; className?: string }) {
  const { t, lang } = useT();
  if (!capture) return null;
  const items = compact ? capture.items.filter((i) => i.basis !== "undeterminable" && !["editing", "smoothing", "compression"].includes(i.id) ) : capture.items;
  return (
    <details className={cn("rounded-xl border border-line bg-bg-1/50 p-3 group", className)} open={!compact} data-testid="capture-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-wider text-fg-2">
        <span className="flex items-center gap-1.5"><Camera size={13} /> {t("capture.title")}</span>
        <span className="text-[10px] normal-case tracking-normal text-fg-3 group-open:hidden">{t("capture.show")}</span>
      </summary>
      <dl className="mt-2 grid gap-x-3 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
        {items.map((i) => (
          <div key={i.id} className="contents" data-testid={`capture-${i.id}`} data-value={i.value} data-basis={i.basis}>
            <dt className="text-fg-3">{CAPTURE_LABELS[lang][i.id]}</dt>
            <dd className="text-fg-1">
              {captureText(i, lang)} <span className={cn("ml-1 text-[10px] uppercase tracking-wide", BASIS_TONE[i.basis])}>· {BASIS_LABELS[lang][i.basis]}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-fg-3">{t("capture.note")}</p>
    </details>
  );
}
