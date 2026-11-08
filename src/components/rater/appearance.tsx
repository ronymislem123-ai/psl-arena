"use client";
/**
 * Descriptive appearance measures of a visual criterion (rubric 2.1): shown next to
 * the criterion, never scored (no published reference ranges exist).
 */
import type { AppearanceMeasure } from "@/engine/appearance";
import type { CriterionId } from "@/engine/psl/rubric";
import { useT } from "@/lib/i18n";

export function formatAppearance(m: AppearanceMeasure): string {
  if (m.value == null) return "—";
  return m.unit === "percent" ? `${m.value.toFixed(1)} %` : m.value.toFixed(2);
}

/** Compact one-line list for the criteria table. */
export function AppearanceInline({ measures, criterion }: { measures?: AppearanceMeasure[]; criterion: CriterionId }) {
  const { t } = useT();
  const list = (measures ?? []).filter((m) => m.criterion === criterion && m.value != null);
  if (!list.length) return null;
  return (
    <div className="mt-0.5 text-[11px] text-fg-3" data-testid={`appearance-${criterion}`}>
      {list.map((m) => `${t(`rater.result.appearance.${m.id}.name`)}: ${formatAppearance(m)}`).join(" · ")}
    </div>
  );
}

/** Full list with explanations for the criterion dialog. */
export function AppearanceDetail({ measures, criterion }: { measures?: AppearanceMeasure[]; criterion: CriterionId }) {
  const { t } = useT();
  const list = (measures ?? []).filter((m) => m.criterion === criterion);
  if (!list.length) return null;
  return (
    <div className="glass rounded-xl p-3 text-xs space-y-2" data-testid="appearance-detail">
      <div className="text-[11px] uppercase tracking-wider text-fg-2">{t("rater.result.appearanceTitle")}</div>
      {list.map((m) => (
        <div key={m.id}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-fg-1">{t(`rater.result.appearance.${m.id}.name`)}</span>
            <span className="shrink-0 font-mono num text-fg-0">{m.value == null ? t("rater.result.appearanceMissing") : formatAppearance(m)}</span>
          </div>
          <div className="text-fg-3">{t(`rater.result.appearance.${m.id}.desc`)}</div>
        </div>
      ))}
      <p className="text-fg-3 italic">{t("rater.result.appearanceNote")}</p>
    </div>
  );
}
