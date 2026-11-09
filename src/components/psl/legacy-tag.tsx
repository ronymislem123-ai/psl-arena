"use client";
/**
 * Marks a rating of the old method (rubric 1.x/2.x, front + side profile) or an analysis
 * of engine 1.x/2.x (old rubric categories); renders nothing for 3.0+.
 */
import { Badge } from "@/components/ui/badge";
import { isFrontOnlyRubric } from "@/engine/psl/rubric";
import { useT } from "@/lib/i18n";

export function LegacyMethodTag({ rubricVersion, engineVersion, className }: { rubricVersion?: string; engineVersion?: string; className?: string }) {
  const { t } = useT();
  const v = rubricVersion ?? engineVersion ?? "";
  if (isFrontOnlyRubric(v)) return null;
  return (
    <Badge tone="amber" className={className} title={rubricVersion != null ? t("rater.result.legacyNote", { v }) : t("analysis.legacyMethod", { v })} data-testid="legacy-method">
      {t("rater.result.legacyShort")}
    </Badge>
  );
}
