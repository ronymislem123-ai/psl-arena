"use client";
/** Create or edit (draft) a tournament: participants, format, categories/weights, scale. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { FaceThumb } from "@/components/shared/face-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/controls";
import { formatPsl } from "@/engine/psl/rating";
import { CRITERIA, type CriterionId } from "@/engine/psl/rubric";
import { BUILTIN_SCALE_ID } from "@/engine/psl/scale";
import { DEFAULT_CATEGORIES, DEFAULT_TOURNAMENT_CONFIG } from "@/engine/tournament/categories";
import type { TournamentCategory, TournamentConfig, TournamentFormat } from "@/engine/tournament/types";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { categoryName, criterionName, areaName } from "@/lib/i18n/psl-texts";
import { fmt } from "@/lib/utils";
import type { RatingSummary, ScaleSummary, TournamentRecord } from "@/server/repos-psl";
import { paths } from "@/lib/paths";

interface Part {
  profileId: string;
  ratingId: string;
  displayName: string;
  imageId: string | null;
  score: number | null;
  date: string;
}

export function TournamentWizard({ latest, scales, existing }: { latest: RatingSummary[]; scales: ScaleSummary[]; existing?: TournamentRecord }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [config, setConfig] = useState<TournamentConfig>(existing?.config ?? { ...DEFAULT_TOURNAMENT_CONFIG, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, criteria: [...c.criteria] })) });
  const [scaleId, setScaleId] = useState(existing?.scaleSnapshot.scaleId ?? BUILTIN_SCALE_ID);
  const [parts, setParts] = useState<Part[]>(() =>
    existing
      ? existing.participants.map((p) => ({ profileId: p.profileId ?? "", ratingId: p.ratingId ?? "", displayName: p.displayName, imageId: p.imageId, score: p.rating.score, date: "" }))
      : [],
  );
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customCriteria, setCustomCriteria] = useState<CriterionId[]>([]);

  const available = useMemo(() => latest.filter((r) => r.score != null && !parts.some((p) => p.profileId === r.profileId)), [latest, parts]);
  const weightSum = config.categories.reduce((s, c) => s + Math.max(0, c.weight), 0);
  const setCfg = (patch: Partial<TournamentConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const patchCategory = (id: string, patch: Partial<TournamentCategory>) => setCfg({ categories: config.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const add = () => {
    const r = latest.find((x) => x.profileId === pick) ?? available[0];
    if (!r) return;
    setParts((p) => [...p, { profileId: r.profileId, ratingId: r.id, displayName: r.profileLabel, imageId: r.profileImageId, score: r.score, date: r.createdAt }]);
    setPick("");
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= parts.length) return;
    const next = [...parts];
    [next[i], next[j]] = [next[j], next[i]];
    setParts(next);
  };
  const addCustom = () => {
    if (!customName.trim() || !customCriteria.length) return;
    const id = `custom_${Date.now().toString(36)}`;
    setCfg({ categories: [...config.categories, { id, name: customName.trim(), criteria: customCriteria.map((c) => ({ id: c, weight: 1 })), weight: 0 }] });
    setCustomName("");
    setCustomCriteria([]);
  };
  const ready = name.trim().length > 0 && parts.length >= 2 && config.categories.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description, config, scaleId, participants: parts.map((p) => ({ profileId: p.profileId, ratingId: p.ratingId || undefined, displayName: p.displayName })) };
      const res = existing ? await api.updateTournament(existing.id, payload) : await api.createTournament(payload);
      router.push(paths.tournament(res.tournament.id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.tournaments")} title={existing ? existing.name : t("tournaments.newTournament")} subtitle={t("tournaments.draftHint")} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("tournaments.name")} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label={t("tournaments.name")}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="tournament-name" /></Field>
              <Field label={t("tournaments.scale")}>
                <Select value={scaleId} onChange={(e) => setScaleId(e.target.value)} className="w-full">
                  {scales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2"><Field label={t("tournaments.description")}><Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field></div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`${t("tournaments.participants")} (${parts.length})`} subtitle={t("tournaments.unratedHint")} />
            <CardBody className="space-y-3">
              <div className="flex gap-2">
                <Select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1" aria-label={t("tournaments.pickProfile")} data-testid="participant-pick">
                  <option value="">{t("tournaments.pickProfile")}…</option>
                  {available.map((r) => <option key={r.profileId} value={r.profileId}>{r.profileLabel} · {formatPsl(r.score)} · {t("tournaments.rated", { date: fmt.date(r.createdAt, lang) })}</option>)}
                </Select>
                <Button variant="outline" onClick={add} disabled={!available.length} data-testid="participant-add"><Plus size={14} /> {t("tournaments.addParticipant")}</Button>
              </div>
              {!latest.length && <p className="text-xs text-amber">{t("tournaments.noRatedProfiles")}</p>}
              {parts.length < 2 && <p className="text-xs text-fg-3">{t("tournaments.needTwo")}</p>}
              <ul className="divide-y divide-line" data-testid="participants">
                {parts.map((p, i) => (
                  <li key={p.profileId} className="flex items-center gap-2 py-2">
                    <span className="w-6 font-mono text-xs text-fg-3">{i + 1}</span>
                    <FaceThumb imageId={p.imageId} label={p.displayName} size={32} />
                    <Input value={p.displayName} onChange={(e) => setParts((ps) => ps.map((x, k) => (k === i ? { ...x, displayName: e.target.value } : x)))} className="h-8 flex-1" maxLength={60} aria-label={t("tournaments.displayName")} />
                    <span className="font-mono text-sm num w-12 text-right">{formatPsl(p.score)}</span>
                    {config.seeding === "manual" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === parts.length - 1}><ArrowDown size={14} /></Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setParts((ps) => ps.filter((_, k) => k !== i))} title={t("tournaments.removeParticipant")}><Trash2 size={14} /></Button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("tournaments.format")} subtitle={t(`tournaments.formatHint.${config.format}`)} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label={t("tournaments.format")}>
                <Select value={config.format} onChange={(e) => setCfg({ format: e.target.value as TournamentFormat })} className="w-full" data-testid="tournament-format">
                  {(["ranking", "category", "knockout", "group"] as TournamentFormat[]).map((f) => <option key={f} value={f}>{t(`tournaments.formats.${f}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("tournaments.seeding")}>
                <Select value={config.seeding} onChange={(e) => setCfg({ seeding: e.target.value as TournamentConfig["seeding"] })} className="w-full">
                  {(["rating", "random", "manual"] as const).map((s) => <option key={s} value={s}>{t(`tournaments.seedings.${s}`)}</option>)}
                </Select>
              </Field>
              {(config.format === "knockout" || config.format === "group") && (
                <Field label={t("tournaments.winnerMethod")}>
                  <Select value={config.winnerMethod} onChange={(e) => setCfg({ winnerMethod: e.target.value as TournamentConfig["winnerMethod"] })} className="w-full">
                    <option value="weighted">{t("tournaments.winnerMethods.weighted")}</option>
                    <option value="knockout">{t("tournaments.winnerMethods.knockout")}</option>
                  </Select>
                </Field>
              )}
              {config.format === "group" && (
                <>
                  <Field label={t("tournaments.groupSize")}><Input type="number" min={2} max={16} value={config.groupSize} onChange={(e) => setCfg({ groupSize: Number(e.target.value) })} /></Field>
                  <Field label={t("tournaments.qualify")}><Input type="number" min={1} max={config.groupSize} value={config.qualifyPerGroup} onChange={(e) => setCfg({ qualifyPerGroup: Number(e.target.value) })} /></Field>
                </>
              )}
              <Field label={t("tournaments.decisive")}>
                <Select value={config.decisiveCategoryId} onChange={(e) => setCfg({ decisiveCategoryId: e.target.value })} className="w-full">
                  {config.categories.map((c) => <option key={c.id} value={c.id}>{categoryName(c.id, c.name, lang)}</option>)}
                </Select>
              </Field>
              <Field label={t("tournaments.tieEpsilon")}><Input type="number" step="0.01" min={0} max={1} value={config.tieEpsilon} onChange={(e) => setCfg({ tieEpsilon: Number(e.target.value) })} /></Field>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={`${t("tournaments.categories")} & ${t("tournaments.weights")}`} subtitle={t("tournaments.categoryWeightHint")} action={<Button size="sm" variant="ghost" onClick={() => setCfg({ categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, criteria: [...c.criteria] })), decisiveCategoryId: "overallFace" })}>{t("tournaments.resetCategories")}</Button>} />
            <CardBody className="space-y-2">
              <p className="text-xs text-fg-3">{t("tournaments.weightSum", { sum: Number(weightSum.toFixed(2)) })}</p>
              <ul className="divide-y divide-line" data-testid="categories">
                {config.categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{categoryName(c.id, c.name, lang)}</div>
                      <div className="text-[11px] text-fg-3 truncate">{c.overall ? t("tournaments.overallFace") : c.area ? `${t("tournaments.rubricCategory")}: ${areaName(c.area, lang)}` : c.criteria.map((x) => criterionName(x.id, lang)).join(", ")}</div>
                    </div>
                    <Input type="number" min={0} max={1000} value={c.weight} onChange={(e) => patchCategory(c.id, { weight: Number(e.target.value) })} className="h-8 w-20 font-mono" aria-label={t("tournaments.weights")} />
                    <span className="w-11 shrink-0 whitespace-nowrap text-right text-xs text-fg-3">{weightSum > 0 ? `${Math.round((Math.max(0, c.weight) / weightSum) * 100)} %` : "—"}</span>
                    {!c.builtIn && <Button size="sm" variant="ghost" onClick={() => setCfg({ categories: config.categories.filter((x) => x.id !== c.id), decisiveCategoryId: config.decisiveCategoryId === c.id ? config.categories[0].id : config.decisiveCategoryId })}><Trash2 size={14} /></Button>}
                    {c.builtIn && config.categories.length > 1 && <Button size="sm" variant="ghost" onClick={() => setCfg({ categories: config.categories.filter((x) => x.id !== c.id), decisiveCategoryId: config.decisiveCategoryId === c.id ? config.categories.find((x) => x.id !== c.id)!.id : config.decisiveCategoryId })} title={t("tournaments.removeCategory")}><Trash2 size={14} /></Button>}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-dashed border-line p-3 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{t("tournaments.addCategory")}</div>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={t("tournaments.categoryName")} maxLength={60} className="h-8" />
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto scrollbar-thin">
                  {CRITERIA.map((c) => {
                    const on = customCriteria.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => setCustomCriteria((cs) => (on ? cs.filter((x) => x !== c.id) : [...cs, c.id]))} className={`rounded-md border px-1.5 py-0.5 text-[11px] ${on ? "border-accent/60 bg-accent/20 text-fg-0" : "border-line text-fg-2"}`}>
                        {criterionName(c.id, lang)}
                      </button>
                    );
                  })}
                </div>
                <Button size="sm" variant="outline" onClick={addCustom} disabled={!customName.trim() || !customCriteria.length}><Plus size={14} /> {t("tournaments.addCategory")}</Button>
              </div>
            </CardBody>
          </Card>
          <Card strong>
            <CardBody className="pt-5 space-y-2">
              {error && <div className="rounded-lg bg-rose-soft border border-rose/30 px-3 py-2 text-xs text-[#ff8fa3]" role="alert">{error}</div>}
              <div className="flex flex-wrap gap-2">
                <Badge tone="cyan">{t(`tournaments.formats.${config.format}`)}</Badge>
                <Badge tone="muted">{t("tournaments.nParticipants", { n: parts.length })}</Badge>
                <Badge tone="muted">{t("tournaments.nCategories", { n: config.categories.length })}</Badge>
              </div>
              <Button className="w-full" size="lg" disabled={!ready} loading={busy} onClick={submit} data-testid="tournament-create">
                <Trophy size={18} /> {existing ? t("tournaments.saveDraft") : busy ? t("tournaments.creating") : t("tournaments.create")}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
