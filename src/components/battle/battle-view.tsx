"use client";
import { useState } from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/controls";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ui/score-ring";
import { PageHeader } from "@/components/layout/app-shell";
import { Arena, BattleSummaryLinks, type ArenaSide } from "./arena";
import { RATIO_BY_ID, RATIO_DEFINITIONS } from "@/engine/ratios/database";
import { formatT1, formatValue } from "@/engine/explain";
import { battleRoundLabel, battleSummary, verdictReason } from "@/lib/i18n/engine-text";
import { categoryText, ratioText } from "@/lib/i18n/ratio-texts";
import type { BattleResult, RatioId } from "@/engine/types";
import { useT } from "@/lib/i18n";
import { useSessionImage } from "@/lib/session-images";
import { cn, fmt } from "@/lib/utils";

export function BattleView({ battle, a: a0, b: b0, createdAt }: { battle: BattleResult; a: ArenaSide; b: ArenaSide; createdAt: string }) {
  const { t, lang } = useT();
  const [tab, setTab] = useState<"arena" | "summary" | "compare">("arena");
  const [finished, setFinished] = useState(false);
  const sessionA = useSessionImage(a0.analysisId);
  const sessionB = useSessionImage(b0.analysisId);
  const a: ArenaSide = { ...a0, imageSrc: a0.imageSrc ?? (a0.imageId ? null : sessionA) };
  const b: ArenaSide = { ...b0, imageSrc: b0.imageSrc ?? (b0.imageId ? null : sessionB) };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`${t("battle.arena")} · ${fmt.date(createdAt, lang)}`}
        title={
          <>
            <span className="text-[#9db6ff]">{a.label}</span> <span className="text-fg-3 font-normal">vs</span> <span className="text-[#c4b5fd]">{b.label}</span>
          </>
        }
        action={<Tabs tabs={[{ id: "arena", label: t("battle.arena") }, { id: "summary", label: t("battle.summary") }, { id: "compare", label: t("battle.compare") }]} value={tab} onChange={setTab} />}
      />
      {tab === "arena" && (
        <>
          <Arena battle={battle} a={a} b={b} onFinished={() => setFinished(true)} />
          {finished && (
            <div className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-sm text-fg-1">{battleSummary(battle, { a: a.label, b: b.label }, lang)}</p>
              <BattleSummaryLinks a={a} b={b} />
            </div>
          )}
        </>
      )}
      {tab === "summary" && <Summary battle={battle} a={a} b={b} />}
      {tab === "compare" && <Compare a={a} b={b} />}
    </div>
  );
}

function Summary({ battle, a, b }: { battle: BattleResult; a: ArenaSide; b: ArenaSide }) {
  const { t, lang } = useT();
  const verdictText = battle.verdict === "A" ? `${a.label} — ${t("battle.winner")}` : battle.verdict === "B" ? `${b.label} — ${t("battle.winner")}` : battle.verdict === "draw" ? t("battle.verdictDraw") : t("battle.verdictInconclusive");
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card strong>
        <CardHeader title={t("battle.reveal")} subtitle={verdictReason(battle, lang)} />
        <CardBody className="space-y-5">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <ScoreRing value={battle.overallA} size={120} tone={battle.verdict === "A" ? "mint" : "accent"} digits={1} label={a.label} animate={false} />
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-bold">{verdictText}</div>
              <div className="font-mono text-xs text-fg-3 mt-1">
                {t("battle.overallDiff")} {battle.diff == null ? "—" : fmt.signed(battle.diff, 1)} · {t("battle.margin")} ±{battle.margin.toFixed(1)}
              </div>
              <div className="font-mono text-xs text-fg-3">
                {t("battle.rounds")} {battle.roundWinsA} – {battle.roundWinsB} ({battle.roundDraws} {t("battle.draw").toLowerCase()})
              </div>
            </div>
            <div className="text-center">
              <ScoreRing value={battle.overallB} size={120} tone={battle.verdict === "B" ? "mint" : "violet"} digits={1} label={b.label} animate={false} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[a, b].map((s, i) => (
              <div key={i} className="rounded-xl border border-line bg-bg-1/50 p-3 space-y-1">
                <div className="font-medium text-fg-0 truncate">{s.label}</div>
                <div className="text-fg-2">
                  {t("battle.evaluable")}: <span className="num">{s.analysis.coverage.evaluable}/{s.analysis.coverage.total}</span>
                </div>
                <div className="text-fg-2">
                  {t("common.coverage")}: <span className="num">{fmt.pct(s.analysis.coverage.fraction)}</span> · {t("common.confidence")}: <span className="num">{fmt.pct(s.analysis.scores.confidence)}</span>
                </div>
                <div className="text-fg-2">
                  {t("common.quality")}: {t(`quality.${s.analysis.quality.level}`)} · σ {s.analysis.uncertainty?.overallSigma.toFixed(1) ?? "—"}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-fg-1">{battleSummary(battle, { a: a.label, b: b.label }, lang)}</p>
          <BattleSummaryLinks a={a} b={b} />
        </CardBody>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title={t("battle.rounds")} />
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {battle.rounds.map((r, i) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2 font-mono text-xs text-fg-3 w-8">{String(i + 1).padStart(2, "0")}</td>
                    <td className="py-2">{battleRoundLabel(r, lang)}</td>
                    <td className={cn("py-2 text-right num font-mono", r.winner === "A" && "text-mint")}>{fmt.score(r.a)}</td>
                    <td className={cn("py-2 text-right num font-mono", r.winner === "B" && "text-mint")}>{fmt.score(r.b)}</td>
                    <td className="py-2 text-right text-xs text-fg-3 font-mono">±{r.margin.toFixed(1)}</td>
                    <td className="py-2 text-right text-xs">
                      <Badge tone={r.winner === "draw" ? "cyan" : r.winner === "n/a" ? "muted" : "mint"}>{r.winner === "A" ? a.label : r.winner === "B" ? b.label : r.winner === "draw" ? t("battle.draw") : "n/a"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("battle.keyDifferences")} />
          <CardBody>
            {battle.keyDifferences.length === 0 ? (
              <div className="text-sm text-fg-3">—</div>
            ) : (
              <ul className="space-y-2">
                {battle.keyDifferences.map((k) => {
                  const def = RATIO_BY_ID[k.ratioId];
                  return (
                    <li key={k.ratioId} className="flex items-center gap-3 text-sm">
                      <Badge tone={k.favours === "A" ? "accent" : "violet"}>{k.favours === "A" ? a.label : b.label}</Badge>
                      <span className="font-medium">{def.abbreviation}</span>
                      <span className="text-fg-3 text-xs truncate flex-1">{ratioText(def.id, lang).name}</span>
                      <span className="font-mono text-xs num">
                        {formatValue(k.a, def.unit)} · {formatValue(k.b, def.unit)}
                      </span>
                      <span className={cn("font-mono text-xs num", k.delta > 0 ? "text-[#c4b5fd]" : "text-[#9db6ff]")}>{fmt.signed(k.delta)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Compare({ a, b }: { a: ArenaSide; b: ArenaSide }) {
  const { t, lang } = useT();
  const ra = Object.fromEntries(a.analysis.ratios.map((r) => [r.id, r]));
  const rb = Object.fromEntries(b.analysis.ratios.map((r) => [r.id, r]));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t("battle.categoryWins")} />
        <CardBody className="space-y-3">
          {a.analysis.categories.map((ca) => {
            const cb = b.analysis.categories.find((c) => c.id === ca.id)!;
            return (
              <div key={ca.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center gap-2 justify-end">
                  <span className="font-mono text-xs num w-8 text-right">{fmt.score(ca.index)}</span>
                  <div className="w-full max-w-[320px] flex justify-end">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${ca.index ?? 0}%` }} />
                  </div>
                </div>
                <div className="text-xs text-fg-2 w-28 text-center">{categoryText(ca.id, lang).label}</div>
                <div className="flex items-center gap-2">
                  <div className="w-full max-w-[320px]">
                    <div className="h-2 rounded-full bg-violet" style={{ width: `${cb.index ?? 0}%` }} />
                  </div>
                  <span className="font-mono text-xs num w-8">{fmt.score(cb.index)}</span>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-2 border-t border-line">
            <div className="text-right font-mono text-xs num">{fmt.score(a.analysis.symmetry.score)}</div>
            <div className="text-xs text-fg-2 w-28 text-center">{t("analysis.symmetryScore")}</div>
            <div className="font-mono text-xs num">{fmt.score(b.analysis.symmetry.score)}</div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("analysis.ratios")} subtitle={`${a.label} · ${b.label}`} />
        <CardBody className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">{t("analysis.columns.ratio")}</th>
                <th className="text-right py-2">{a.label}</th>
                <th className="text-right py-2">{b.label}</th>
                <th className="text-left py-2 pl-4">{t("analysis.columns.t1")}</th>
                <th className="text-right py-2">{t("battle.idxA")}</th>
                <th className="text-right py-2">{t("battle.idxB")}</th>
                <th className="text-right py-2">{t("battle.delta")}</th>
              </tr>
            </thead>
            <tbody>
              {RATIO_DEFINITIONS.map((def) => {
                const x = ra[def.id as RatioId];
                const y = rb[def.id as RatioId];
                const d = x.index != null && y.index != null ? y.index - x.index : null;
                return (
                  <tr key={def.id} className="border-t border-line">
                    <td className="py-1.5 font-mono text-fg-3">{def.number}</td>
                    <td className="py-1.5" title={ratioText(def.id, lang).name}>
                      <span className="font-medium">{def.abbreviation}</span> <Badge tone={statusTone(def.status)} className="ml-1 px-1 py-0 text-[9px]">{t(`analysis.status.${def.status}`)[0]}</Badge>
                    </td>
                    <td className={cn("py-1.5 text-right font-mono num", x.inT1 && "text-mint")}>{x.availability === "available" ? formatValue(x.value, def.unit) : "—"}</td>
                    <td className={cn("py-1.5 text-right font-mono num", y.inT1 && "text-mint")}>{y.availability === "available" ? formatValue(y.value, def.unit) : "—"}</td>
                    <td className="py-1.5 pl-4 text-fg-3 font-mono">{formatT1(def)}</td>
                    <td className="py-1.5 text-right w-20">
                      <Progress value={x.index} tone="accent" animate={false} />
                    </td>
                    <td className="py-1.5 text-right w-20">
                      <Progress value={y.index} tone="violet" animate={false} />
                    </td>
                    <td className={cn("py-1.5 text-right font-mono num", d == null ? "text-fg-3" : d > 0 ? "text-[#c4b5fd]" : d < 0 ? "text-[#9db6ff]" : "")}>{d == null ? "—" : fmt.signed(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
