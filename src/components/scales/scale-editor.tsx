"use client";
/**
 * Scale editor: meta data, tier list with linked bounds, validation, reference
 * images and a live preview in five views. Bounds of neighbouring tiers are
 * linked so editing never creates gaps by accident.
 */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Copy, Download, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { ScaleViews, SCALE_VIEWS, type ScaleView } from "@/components/scales/scale-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Tabs } from "@/components/ui/controls";
import { assignTier, formatTierRange, newTierId, roundBound, TIER_PALETTE, validateScale, type PslScale, type PslTier } from "@/engine/psl/scale";
import { api, imageUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { scaleIssueText } from "@/lib/i18n/psl-texts";
import { loadImageFile } from "@/lib/vision/image";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/paths";
import { ApiLink } from "@/components/shared/api-link";

type Draft = Pick<PslScale, "name" | "description" | "rangeMin" | "rangeMax" | "tiers">;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function ScaleEditor({ scale, mode, justSaved = false }: { scale: PslScale; mode: "new" | "edit" | "view"; justSaved?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const readOnly = mode === "view";
  const [draft, setDraft] = useState<Draft>(() => clone({ name: scale.name, description: scale.description, rangeMin: scale.rangeMin, rangeMax: scale.rangeMax, tiers: scale.tiers }));
  const [saved, setSaved] = useState<Draft>(() => clone(draft));
  const [scaleId, setScaleId] = useState<string | null>(mode === "new" ? null : scale.id);
  const [view, setView] = useState<ScaleView>("list");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(justSaved ? t("scales.saved") : null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testValue, setTestValue] = useState("5.5");
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageTier, setImageTier] = useState<string | null>(null);

  const issues = useMemo(() => validateScale(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const sorted = useMemo(() => [...draft.tiers].sort((a, b) => a.order - b.order), [draft.tiers]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setTiers = (tiers: PslTier[]) => update({ tiers: tiers.map((tier, i) => ({ ...tier, order: i })) });
  const patchTier = (id: string, patch: Partial<PslTier>) => setTiers(sorted.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)));
  const setBound = (index: number, which: "min" | "max", raw: string) => {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const next = sorted.map((tier) => ({ ...tier }));
    next[index][which] = roundBound(v);
    if (which === "max" && next[index + 1]) next[index + 1].min = roundBound(v);
    if (which === "min" && next[index - 1]) next[index - 1].max = roundBound(v);
    setTiers(next);
  };
  const addTier = (afterIndex: number) => {
    const ref = sorted[afterIndex];
    const next = sorted.map((tier) => ({ ...tier }));
    const mid = ref ? roundBound((ref.min + ref.max) / 2) : draft.rangeMin;
    const tier: PslTier = { id: newTierId(next), name: `Tier ${next.length + 1}`, short: "", group: ref?.group ?? null, min: mid, max: ref ? ref.max : draft.rangeMax, order: afterIndex + 1, description: "", color: TIER_PALETTE[next.length % TIER_PALETTE.length], percentile: null, images: [], notes: "" };
    if (ref) next[afterIndex].max = mid;
    next.splice(afterIndex + 1, 0, tier);
    setTiers(next);
    setExpanded(tier.id);
  };
  const duplicateTier = (index: number) => {
    const ref = sorted[index];
    const next = sorted.map((tier) => ({ ...tier }));
    const mid = roundBound((ref.min + ref.max) / 2);
    next[index].max = mid;
    next.splice(index + 1, 0, { ...clone(ref), id: newTierId(next), name: `${ref.name} (copy)`, min: mid, images: [] });
    setTiers(next);
  };
  const removeTier = (index: number) => {
    if (sorted.length <= 1) return;
    const next = sorted.map((tier) => ({ ...tier }));
    const [gone] = next.splice(index, 1);
    // the neighbour absorbs the freed range so the scale stays gap-free
    if (next[index]) next[index].min = gone.min;
    else next[index - 1].max = gone.max;
    setTiers(next);
  };
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = sorted.map((tier) => ({ ...tier }));
    // swap identities but keep the value ranges in place
    const a = next[index];
    const b = next[j];
    const ra = { min: a.min, max: a.max };
    const rb = { min: b.min, max: b.max };
    next[index] = { ...b, min: ra.min, max: ra.max };
    next[j] = { ...a, min: rb.min, max: rb.max };
    setTiers(next);
  };
  const distribute = () => {
    const n = sorted.length;
    const span = draft.rangeMax - draft.rangeMin;
    setTiers(sorted.map((tier, i) => ({ ...tier, min: roundBound(draft.rangeMin + (span * i) / n), max: roundBound(draft.rangeMin + (span * (i + 1)) / n) })));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { name: draft.name, description: draft.description, rangeMin: draft.rangeMin, rangeMax: draft.rangeMax, tiers: sorted };
      const res = scaleId ? await api.updateScale(scaleId, payload) : await api.createScale(payload);
      const s = res.scale;
      const next = clone({ name: s.name, description: s.description, rangeMin: s.rangeMin, rangeMax: s.rangeMax, tiers: s.tiers });
      setDraft(next);
      setSaved(next);
      setMessage(t("scales.saved"));
      if (!scaleId) {
        setScaleId(s.id);
        router.replace(paths.scale(s.id, { saved: true }));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const pickImage = (tierId: string) => {
    setImageTier(tierId);
    fileRef.current?.click();
  };
  const onImageFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !imageTier || !scaleId) return;
    setError(null);
    try {
      const img = await loadImageFile(f, f.name);
      const res = await api.addTierImage(scaleId, { tierId: imageTier, imageDataUrl: img.dataUrl, width: img.width, height: img.height, caption: "" });
      const s = res.scale;
      const next = clone({ name: s.name, description: s.description, rangeMin: s.rangeMin, rangeMax: s.rangeMax, tiers: s.tiers });
      setDraft(next);
      setSaved(next);
      setExpanded(imageTier);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const moveImage = (tierId: string, imageId: string, toTierId: string) => {
    const next = sorted.map((tier) => ({ ...tier, images: [...tier.images] }));
    const from = next.find((x) => x.id === tierId)!;
    const idx = from.images.findIndex((i) => i.imageId === imageId);
    const [img] = from.images.splice(idx, 1);
    next.find((x) => x.id === toTierId)!.images.push(img);
    setTiers(next);
  };
  const reorderImage = (tierId: string, index: number, dir: -1 | 1) => {
    const next = sorted.map((tier) => ({ ...tier, images: [...tier.images] }));
    const imgs = next.find((x) => x.id === tierId)!.images;
    const j = index + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[index], imgs[j]] = [imgs[j], imgs[index]];
    setTiers(next);
  };

  const testNum = Number(testValue.replace(",", "."));
  const testTier = Number.isFinite(testNum) && issues.length === 0 ? assignTier(draft, testNum) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t("navPsl.scales")}
        title={mode === "new" ? t("scales.newScale") : draft.name || scale.name}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            {scale.builtIn && <Badge tone="violet">{t("scales.builtIn")}</Badge>}
            <Badge tone="muted">{t("scales.version")} {scale.version}</Badge>
            <Badge tone="cyan">{t("scales.tierCount", { n: draft.tiers.length })}</Badge>
            {dirty && !readOnly && <Badge tone="amber">{t("scales.unsaved")}</Badge>}
            {readOnly && <span className="text-xs text-fg-3">{t("scales.readOnly")}</span>}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {scaleId && (
              <ApiLink href={`/api/scales/${scaleId}/export`}>
                <Button variant="outline" size="sm"><Download size={14} /> {t("scales.export")}</Button>
              </ApiLink>
            )}
            {scaleId && (
              <Button variant="outline" size="sm" onClick={async () => { const r = await api.duplicateScale(scaleId); router.push(paths.scale(r.scale.id)); router.refresh(); }} data-testid="scale-duplicate">
                <Copy size={14} /> {t("scales.duplicate")}
              </Button>
            )}
            {!readOnly && (
              <Button size="sm" onClick={save} disabled={issues.length > 0 || !dirty} loading={saving} data-testid="scale-save">
                <Save size={14} /> {t("scales.save")}
              </Button>
            )}
          </div>
        }
      />
      {(message || error) && (
        <div className={cn("rounded-xl border px-4 py-2 text-sm", error ? "border-rose/40 bg-rose-soft text-[#ff8fa3]" : "border-mint/40 bg-mint-soft text-mint")} role={error ? "alert" : "status"}>
          {error ?? message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("scales.name")} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label={t("scales.name")}>
                <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} maxLength={80} disabled={readOnly} data-testid="scale-name" />
              </Field>
              <Field label={t("scales.range")}>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.5" value={draft.rangeMin} onChange={(e) => update({ rangeMin: Number(e.target.value) })} disabled={readOnly} aria-label={t("scales.rangeMin")} />
                  <span className="text-fg-3">–</span>
                  <Input type="number" step="0.5" value={draft.rangeMax} onChange={(e) => update({ rangeMax: Number(e.target.value) })} disabled={readOnly} aria-label={t("scales.rangeMax")} />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("scales.description")}>
                  <textarea value={draft.description} onChange={(e) => update({ description: e.target.value })} maxLength={1000} disabled={readOnly} rows={2} className="w-full rounded-xl border border-line-strong bg-bg-2 px-3 py-2 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-accent/50" />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("scales.tiers")}
              subtitle={t("scales.rulesText")}
              action={
                !readOnly && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={distribute}>{t("scales.distribute")}</Button>
                    <Button size="sm" variant="outline" onClick={() => addTier(sorted.length - 1)} data-testid="tier-add"><Plus size={14} /> {t("scales.addTier")}</Button>
                  </div>
                )
              }
            />
            <CardBody className="space-y-2">
              {[...sorted].reverse().map((tier) => {
                const index = sorted.indexOf(tier);
                const open = expanded === tier.id;
                const tierIssues = issues.filter((i) => i.tierId === tier.id);
                return (
                  <div key={tier.id} className={cn("rounded-xl border bg-bg-1/40", tierIssues.length ? "border-rose/50" : "border-line")} data-testid={`tier-row-${tier.id}`}>
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-2 sm:grid-cols-[auto_1.4fr_0.6fr_0.9fr_0.9fr_auto]">
                      <input type="color" value={tier.color} onChange={(e) => patchTier(tier.id, { color: e.target.value })} disabled={readOnly} className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent" aria-label={t("scales.color")} />
                      <Input value={tier.name} onChange={(e) => patchTier(tier.id, { name: e.target.value })} disabled={readOnly} className="h-8" aria-label={t("scales.tierName")} maxLength={60} />
                      <Input value={tier.short} onChange={(e) => patchTier(tier.id, { short: e.target.value })} disabled={readOnly} className="h-8 hidden sm:block" placeholder={t("scales.short")} aria-label={t("scales.short")} maxLength={20} />
                      <Input type="number" step="0.01" value={tier.min} onChange={(e) => setBound(index, "min", e.target.value)} disabled={readOnly} className="h-8 hidden sm:block font-mono" aria-label={t("scales.min")} />
                      <Input type="number" step="0.01" value={tier.max} onChange={(e) => setBound(index, "max", e.target.value)} disabled={readOnly} className="h-8 hidden sm:block font-mono" aria-label={t("scales.max")} />
                      <div className="flex items-center gap-0.5">
                        <span className="sm:hidden font-mono text-[11px] text-fg-2 mr-1">{formatTierRange(tier)}</span>
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : tier.id)} aria-expanded={open} data-testid={`tier-expand-${tier.id}`}>{open ? "−" : "+"}</Button>
                        {!readOnly && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => move(index, 1)} title={t("scales.moveUp")} disabled={index === sorted.length - 1}><ArrowUp size={14} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => move(index, -1)} title={t("scales.moveDown")} disabled={index === 0}><ArrowDown size={14} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => duplicateTier(index)} title={t("scales.duplicateTier")}><Copy size={14} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => removeTier(index)} title={t("scales.removeTier")} disabled={sorted.length <= 1} data-testid={`tier-remove-${tier.id}`}><Trash2 size={14} /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    {open && (
                      <div className="border-t border-line px-3 py-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:hidden grid grid-cols-2 gap-2">
                          <Field label={t("scales.min")}><Input type="number" step="0.01" value={tier.min} onChange={(e) => setBound(index, "min", e.target.value)} disabled={readOnly} className="font-mono" /></Field>
                          <Field label={t("scales.max")}><Input type="number" step="0.01" value={tier.max} onChange={(e) => setBound(index, "max", e.target.value)} disabled={readOnly} className="font-mono" /></Field>
                        </div>
                        <Field label={t("scales.group")} hint={t("scales.groupHint")}><Input value={tier.group ?? ""} onChange={(e) => patchTier(tier.id, { group: e.target.value || null })} disabled={readOnly} maxLength={60} /></Field>
                        <Field label={t("scales.percentile")}><Input value={tier.percentile ?? ""} onChange={(e) => patchTier(tier.id, { percentile: e.target.value || null })} disabled={readOnly} maxLength={60} placeholder="e.g. top 2 %" /></Field>
                        <div className="sm:col-span-2">
                          <Field label={t("scales.tierDescription")}>
                            <textarea value={tier.description} onChange={(e) => patchTier(tier.id, { description: e.target.value })} disabled={readOnly} rows={2} maxLength={600} className="w-full rounded-xl border border-line-strong bg-bg-2 px-3 py-2 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-accent/50" />
                          </Field>
                        </div>
                        <div className="sm:col-span-2">
                          <Field label={t("scales.notes")}><Input value={tier.notes} onChange={(e) => patchTier(tier.id, { notes: e.target.value })} disabled={readOnly} maxLength={1000} /></Field>
                        </div>
                        <div className="sm:col-span-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("scales.images")} <span className="text-fg-3 normal-case">({tier.images.length}/12)</span></div>
                            {!readOnly && (
                              <Button size="sm" variant="outline" onClick={() => pickImage(tier.id)} disabled={!scaleId || dirty || tier.images.length >= 12} title={!scaleId || dirty ? t("scales.imagesSaveFirst") : t("scales.imageLimit")} data-testid={`tier-image-add-${tier.id}`}>
                                <ImagePlus size={14} /> {t("scales.addImage")}
                              </Button>
                            )}
                          </div>
                          {(!scaleId || dirty) && !readOnly && <div className="text-[11px] text-fg-3">{t("scales.imagesSaveFirst")}</div>}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {tier.images.map((img, k) => (
                              <div key={img.imageId} className="flex gap-2 rounded-lg border border-line p-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imageUrl(img.imageId) ?? ""} alt={img.caption} className="h-16 w-16 rounded-md object-cover border border-line" />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <Input value={img.caption} onChange={(e) => patchTier(tier.id, { images: tier.images.map((x) => (x.imageId === img.imageId ? { ...x, caption: e.target.value } : x)) })} disabled={readOnly} className="h-8 text-xs" placeholder={t("scales.caption")} maxLength={200} />
                                  {!readOnly && (
                                    <div className="flex items-center gap-1">
                                      <Select value={tier.id} onChange={(e) => moveImage(tier.id, img.imageId, e.target.value)} className="h-7 text-[11px] flex-1" aria-label={t("scales.moveImage")}>
                                        {sorted.map((x) => (
                                          <option key={x.id} value={x.id}>{x.name}</option>
                                        ))}
                                      </Select>
                                      <Button size="sm" variant="ghost" onClick={() => reorderImage(tier.id, k, -1)} disabled={k === 0}>←</Button>
                                      <Button size="sm" variant="ghost" onClick={() => reorderImage(tier.id, k, 1)} disabled={k === tier.images.length - 1}>→</Button>
                                      <Button size="sm" variant="ghost" onClick={() => patchTier(tier.id, { images: tier.images.filter((x) => x.imageId !== img.imageId) })} title={t("scales.removeImage")}><X size={14} /></Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {tierIssues.length > 0 && (
                          <ul className="sm:col-span-2 text-xs text-[#ff8fa3] space-y-0.5">
                            {tierIssues.map((i, k) => <li key={k}>• {scaleIssueText(i, t)}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onImageFile(e.target.files)} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6 self-start">
          <Card strong data-testid="scale-validation" data-valid={issues.length === 0 ? "true" : "false"}>
            <CardHeader title={t("scales.validation")} icon={issues.length === 0 ? <CheckCircle2 size={18} className="text-mint" /> : <AlertTriangle size={18} className="text-rose" />} />
            <CardBody>
              {issues.length === 0 ? (
                <p className="text-sm text-mint">{t("scales.valid", { min: draft.rangeMin, max: draft.rangeMax })}</p>
              ) : (
                <>
                  <p className="text-sm text-fg-1 mb-2">{t("scales.invalid")}</p>
                  <ul className="space-y-1 text-sm text-[#ff8fa3]">
                    {issues.map((i, k) => (
                      <li key={k} className="flex gap-2"><span>•</span>{scaleIssueText(i, t)}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Input value={testValue} onChange={(e) => setTestValue(e.target.value)} className="h-8 w-28 font-mono" aria-label={t("scales.assignTest")} data-testid="scale-test-value" />
                <span className="text-xs text-fg-2" data-testid="scale-test-result">
                  {Number.isFinite(testNum) ? t("scales.assignResult", { value: testNum.toFixed(2), tier: testTier ? `${testTier.name} (${formatTierRange(testTier)})` : t("scales.outsideScale") }) : "—"}
                </span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("scales.preview")} action={<Tabs tabs={SCALE_VIEWS.map((v) => ({ id: v, label: t(`scales.views.${v}`) }))} value={view} onChange={setView} />} />
            <CardBody>
              <ScaleViews scale={{ ...draft, tiers: sorted }} view={view} value={Number.isFinite(testNum) ? testNum : null} />
            </CardBody>
          </Card>
          <div className="text-xs text-fg-3"><Link href="/scales" className="underline underline-offset-2 hover:text-fg-0">← {t("navPsl.scales")}</Link></div>
        </div>
      </div>
    </div>
  );
}
