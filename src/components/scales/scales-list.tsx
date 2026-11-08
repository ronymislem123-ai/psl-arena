"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, GitCompare, Plus, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { ScaleBar } from "@/components/psl/tier-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import type { PslScale } from "@/engine/psl/scale";
import type { ScaleSummary } from "@/server/repos-psl";
import { paths } from "@/lib/paths";
import { ApiLink } from "@/components/shared/api-link";

export function ScalesList({ scales, full }: { scales: ScaleSummary[]; full: Record<string, PslScale> }) {
  const { t, lang } = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const del = async (s: ScaleSummary) => {
    if (!confirm(t("scales.deleteConfirm"))) return;
    await api.deleteScale(s.id);
    router.refresh();
  };
  const dup = async (s: ScaleSummary) => {
    const r = await api.duplicateScale(s.id, s.builtIn ? t("scales.restoreDefault") : undefined);
    router.push(paths.scale(r.scale.id));
    router.refresh();
  };
  const onImport = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    try {
      const data = JSON.parse(await f.text());
      const r = await api.importScale(data);
      router.push(paths.scale(r.scale.id));
      router.refresh();
    } catch (e) {
      setError(t("scales.importFailed", { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t("navPsl.scales")}
        title={t("scales.title")}
        subtitle={t("scales.sub")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/scales/compare"><Button variant="outline"><GitCompare size={16} /> {t("scales.compare")}</Button></Link>
            <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="scale-import"><Upload size={16} /> {t("scales.import")}</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files)} data-testid="scale-import-input" />
            <Link href="/scales/new"><Button data-testid="scale-new"><Plus size={16} /> {t("scales.newScale")}</Button></Link>
          </div>
        }
      />
      {error && <div className="rounded-xl border border-rose/40 bg-rose-soft px-4 py-2 text-sm text-[#ff8fa3]" role="alert">{error}</div>}
      <p className="text-xs text-fg-3">{t("scales.importHint")}</p>
      <div className="grid gap-4 md:grid-cols-2" data-testid="scales-list">
        {scales.map((s) => {
          const f = full[s.id];
          return (
            <Card key={s.id} className="p-4 space-y-3" data-testid={`scale-card-${s.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={paths.scale(s.id)} className="font-display text-lg font-semibold hover:text-accent truncate block">{s.name}</Link>
                  <div className="text-xs text-fg-3">{t("scales.tierCount", { n: s.tierCount })} · {t("scales.imageCount", { n: s.imageCount })} · {t("scales.version")} {s.version} · {fmt.date(s.updatedAt, lang)}</div>
                </div>
                {s.builtIn ? <Badge tone="violet">{t("scales.builtIn")}</Badge> : s.isTemplate ? <Badge tone="cyan">{t("scales.template")}</Badge> : null}
              </div>
              {f && <ScaleBar tiers={f.tiers} rangeMin={f.rangeMin} rangeMax={f.rangeMax} compact labels={false} />}
              <p className="text-xs text-fg-2 line-clamp-2">{s.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={paths.scale(s.id)}><Button size="sm" variant="outline">{s.builtIn ? t("scales.view") : t("scales.edit")}</Button></Link>
                <Button size="sm" variant="ghost" onClick={() => dup(s)} title={t("scales.duplicate")}><Copy size={14} /> {s.builtIn ? t("scales.restoreDefault") : t("scales.duplicate")}</Button>
                <ApiLink href={`/api/scales/${s.id}/export`}><Button size="sm" variant="ghost" title={t("scales.export")}><Download size={14} /></Button></ApiLink>
                {!s.builtIn && <Button size="sm" variant="ghost" onClick={() => del(s)} title={t("scales.delete")}><Trash2 size={14} /></Button>}
              </div>
            </Card>
          );
        })}
      </div>
      {scales.length <= 1 && <Empty>{t("scales.empty")}</Empty>}
    </div>
  );
}

export function ScaleCompare({ scales }: { scales: PslScale[] }) {
  const { t } = useT();
  const min = Math.min(...scales.map((s) => s.rangeMin));
  const max = Math.max(...scales.map((s) => s.rangeMax));
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.scales")} title={t("scales.compare")} subtitle={t("scales.compareSub")} />
      <Card className="p-5 space-y-5">
        {scales.map((s) => (
          <div key={s.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <Link href={paths.scale(s.id)} className="font-medium hover:text-accent">{s.name}</Link>
              <span className="font-mono text-xs text-fg-3">{s.rangeMin}–{s.rangeMax} · {t("scales.tierCount", { n: s.tiers.length })}</span>
            </div>
            <div style={{ marginLeft: `${((s.rangeMin - min) / (max - min)) * 100}%`, width: `${((s.rangeMax - s.rangeMin) / (max - min)) * 100}%` }}>
              <ScaleBar tiers={s.tiers} rangeMin={s.rangeMin} rangeMax={s.rangeMax} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
