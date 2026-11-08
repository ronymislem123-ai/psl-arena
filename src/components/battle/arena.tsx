"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, RotateCcw, SkipForward, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreRing, useCountUp } from "@/components/ui/score-ring";
import { FaceThumb } from "@/components/shared/face-thumb";
import { useT } from "@/lib/i18n";
import { battleRoundLabel, verdictReason } from "@/lib/i18n/engine-text";
import { useSettings } from "@/lib/settings";
import { cn, fmt } from "@/lib/utils";
import { imageUrl } from "@/lib/api";
import type { AnalysisResult, BattleResult, BattleRound } from "@/engine/types";
import { paths } from "@/lib/paths";

export interface ArenaSide {
  label: string;
  imageId: string | null;
  imageSrc?: string | null;
  analysis: AnalysisResult;
  analysisId: string;
}

type Phase = "intro" | "scan" | "rounds" | "reveal" | "done";

const INTRO_MS = 2200;
const SCAN_MS = 1800;
const ROUND_MS = 2600;
const REVEAL_MS = 2600;

export function Arena({ battle, a, b, onFinished }: { battle: BattleResult; a: ArenaSide; b: ArenaSide; onFinished?: () => void }) {
  const { t } = useT();
  const reduced = useSettings((s) => s.reducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced ? "done" : "intro");
  const [round, setRound] = useState(0);
  const rounds = battle.rounds;

  const advance = useCallback(() => {
    setPhase((p) => {
      if (p === "intro") return "scan";
      if (p === "scan") return "rounds";
      if (p === "rounds") {
        if (round < rounds.length - 1) {
          setRound((r) => r + 1);
          return "rounds";
        }
        return "reveal";
      }
      if (p === "reveal") return "done";
      return p;
    });
  }, [round, rounds.length]);

  useEffect(() => {
    if (phase === "done") {
      onFinished?.();
      return;
    }
    const ms = phase === "intro" ? INTRO_MS : phase === "scan" ? SCAN_MS : phase === "rounds" ? ROUND_MS : REVEAL_MS;
    const id = setTimeout(advance, ms);
    return () => clearTimeout(id);
  }, [phase, round, advance, onFinished]);

  const skip = () => {
    setPhase("done");
  };
  const replay = () => {
    setRound(0);
    setPhase("intro");
  };

  const winsA = rounds.slice(0, phase === "rounds" ? round + 1 : rounds.length).filter((r) => r.winner === "A").length;
  const winsB = rounds.slice(0, phase === "rounds" ? round + 1 : rounds.length).filter((r) => r.winner === "B").length;

  return (
    <div className="relative overflow-hidden rounded-3xl glass-strong">
      <div className="absolute inset-0 hud-grid opacity-30 pointer-events-none" />
      <div className={cn("absolute -left-32 top-10 h-80 w-80 rounded-full blur-3xl pointer-events-none transition-opacity duration-1000", battle.verdict === "A" && phase === "done" ? "bg-mint/25 opacity-100" : "bg-accent/15 opacity-60")} />
      <div className={cn("absolute -right-32 top-10 h-80 w-80 rounded-full blur-3xl pointer-events-none transition-opacity duration-1000", battle.verdict === "B" && phase === "done" ? "bg-mint/25 opacity-100" : "bg-violet/15 opacity-60")} />

      {/* top bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-line">
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.25em] text-cyan/80">
          <Swords size={14} /> {t("battle.arena")} · {phase === "rounds" ? `${t("battle.round")} ${String(round + 1).padStart(2, "0")}/${rounds.length}` : phase === "done" ? t("battle.done") : phase === "intro" ? t("battle.phaseIntro") : phase === "scan" ? t("battle.phaseScan") : t("battle.phaseReveal")}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="font-mono text-xs text-fg-2 num">
            {winsA} – {winsB}
          </div>
          {phase !== "done" ? (
            <>
              <Button size="sm" variant="ghost" onClick={advance} title={t("common.next")}>
                <ChevronRight size={14} />
              </Button>
              <Button size="sm" variant="outline" onClick={skip}>
                <SkipForward size={14} /> {t("battle.showSummary")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={replay}>
              <RotateCcw size={14} /> {t("common.replay")}
            </Button>
          )}
        </div>
      </div>

      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 md:gap-6 px-3 md:px-8 py-6 md:py-10 items-start">
        <Fighter side="A" s={a} phase={phase} verdict={battle.verdict} />
        <div className="flex flex-col items-center justify-start pt-6 md:pt-16 min-w-[64px] md:min-w-[120px]">
          <AnimatePresence mode="wait">
            {(phase === "intro" || phase === "scan") && (
              <motion.div key="vs" initial={{ scale: 0.4, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 1.6, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="font-display text-4xl md:text-7xl font-black tracking-widest text-glow">
                {t("battle.intro")}
              </motion.div>
            )}
            {phase === "rounds" && <RoundCenter key={`r${round}`} round={rounds[round]} index={round} />}
            {(phase === "reveal" || phase === "done") && <Reveal key="reveal" battle={battle} a={a} b={b} phase={phase} />}
          </AnimatePresence>
        </div>
        <Fighter side="B" s={b} phase={phase} verdict={battle.verdict} />
      </div>

      {phase === "rounds" && (
        <div className="relative px-4 md:px-8 pb-6">
          <RoundBars round={rounds[round]} labelA={a.label} labelB={b.label} />
        </div>
      )}
      {phase === "done" && (
        <div className="relative px-4 md:px-8 pb-6 grid gap-2 md:grid-cols-3">
          {rounds.map((r, i) => (
            <MiniRound key={r.id} r={r} index={i} labelA={a.label} labelB={b.label} />
          ))}
        </div>
      )}
      {phase === "scan" && (
        <div className="relative px-6 pb-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-cyan/80 animate-pulse-soft">{t("battle.initializing")}…</div>
      )}
    </div>
  );
}

function Fighter({ side, s, phase, verdict }: { side: "A" | "B"; s: ArenaSide; phase: Phase; verdict: BattleResult["verdict"] }) {
  const won = phase === "done" && verdict === side;
  const src = s.imageSrc ?? imageUrl(s.imageId);
  const dir = side === "A" ? -1 : 1;
  const { t } = useT();
  return (
    <motion.div initial={{ x: dir * 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} className={cn("flex w-full max-w-[300px] flex-col items-center gap-3", side === "A" ? "justify-self-end" : "justify-self-start")}>
      <div className={cn("relative rounded-2xl overflow-hidden border-2 transition-all duration-700", won ? "border-mint shadow-[0_0_60px_-10px_#34d39999]" : side === "A" ? "border-accent/50" : "border-violet/50")} style={{ width: "100%", aspectRatio: "3/4" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={s.label} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center bg-bg-3">
            <FaceThumb size={96} />
          </div>
        )}
        {phase === "scan" && (
          <>
            <div className="scan-line" />
            <ScanDots />
          </>
        )}
        {won && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-mint text-bg-0 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
            <Trophy size={12} /> {t("battle.winner")}
          </div>
        )}
      </div>
      <div className="w-full min-w-0 text-center">
        <div className={cn("font-display font-semibold text-base md:text-lg truncate", side === "A" ? "text-[#9db6ff]" : "text-[#c4b5fd]")}>{s.label}</div>
        <div className="font-mono text-[11px] text-fg-3">
          {side === "A" ? t("common.person1") : t("common.person2")} · {t("common.coverage")} {s.analysis.coverage.evaluable}/{s.analysis.coverage.total}
        </div>
      </div>
    </motion.div>
  );
}

function ScanDots() {
  const dots = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: 15 + ((i * 37) % 70), y: 10 + ((i * 53) % 80), d: (i % 10) * 0.12 })), []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dots.map((d, i) => (
        <motion.span key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0.6], scale: 1 }} transition={{ delay: d.d, duration: 0.6 }} className="absolute h-1 w-1 rounded-full bg-cyan shadow-[0_0_6px_#22d3ee]" style={{ left: `${d.x}%`, top: `${d.y}%` }} />
      ))}
    </div>
  );
}

function RoundCenter({ round, index }: { round: BattleRound; index: number }) {
  const { t, lang } = useT();
  const va = useCountUp(round.a, 1100);
  const vb = useCountUp(round.b, 1100);
  return (
    <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.4 }} className="text-center">
      <div className="font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] text-cyan/80">
        {t("battle.round")} {String(index + 1).padStart(2, "0")}
      </div>
      <div className="mt-1 font-display text-lg md:text-2xl font-bold uppercase tracking-wide">{battleRoundLabel(round, lang)}</div>
      <div className="mt-4 flex items-center justify-center gap-3 md:gap-6">
        <span className={cn("font-display text-3xl md:text-5xl font-bold num", round.winner === "A" ? "text-mint text-glow" : "text-[#9db6ff]")}>{va == null ? "—" : va.toFixed(0)}</span>
        <span className="text-fg-3">:</span>
        <span className={cn("font-display text-3xl md:text-5xl font-bold num", round.winner === "B" ? "text-mint text-glow" : "text-[#c4b5fd]")}>{vb == null ? "—" : vb.toFixed(0)}</span>
      </div>
      <div className="mt-2 font-mono text-[10px] text-fg-3">
        ±{round.margin.toFixed(1)} {round.winner === "draw" ? `· ${t("battle.draw")}` : round.winner === "n/a" ? "· n/a" : ""}
      </div>
    </motion.div>
  );
}

function RoundBars({ round, labelA, labelB }: { round: BattleRound; labelA: string; labelB: string }) {
  const a = round.a ?? 0;
  const b = round.b ?? 0;
  return (
    <div className="grid grid-cols-2 gap-2 items-center">
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-fg-2 truncate">{labelA}</span>
        <div className="h-2.5 w-full max-w-[420px] rounded-full bg-white/8 overflow-hidden flex justify-end">
          <motion.div initial={{ width: 0 }} animate={{ width: `${a}%` }} transition={{ duration: 1, ease: "easeOut" }} className={cn("h-full rounded-full", round.winner === "A" ? "bg-mint" : "bg-accent")} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-full max-w-[420px] rounded-full bg-white/8 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${b}%` }} transition={{ duration: 1, ease: "easeOut" }} className={cn("h-full rounded-full", round.winner === "B" ? "bg-mint" : "bg-violet")} />
        </div>
        <span className="text-xs text-fg-2 truncate">{labelB}</span>
      </div>
    </div>
  );
}

function MiniRound({ r, index, labelA, labelB }: { r: BattleRound; index: number; labelA: string; labelB: string }) {
  const { t, lang } = useT();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-1/50 px-3 py-2">
      <div className="font-mono text-[10px] text-fg-3 w-6">{String(index + 1).padStart(2, "0")}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{battleRoundLabel(r, lang)}</div>
        <div className="text-[10px] text-fg-3 truncate">
          {r.winner === "A" ? labelA : r.winner === "B" ? labelB : r.winner === "draw" ? t("battle.draw") : "n/a"} · ±{r.margin.toFixed(1)}
        </div>
      </div>
      <div className="font-mono text-xs num">
        <span className={r.winner === "A" ? "text-mint" : "text-fg-1"}>{fmt.score(r.a)}</span>
        <span className="text-fg-3"> : </span>
        <span className={r.winner === "B" ? "text-mint" : "text-fg-1"}>{fmt.score(r.b)}</span>
      </div>
    </div>
  );
}

function Reveal({ battle, a, b, phase }: { battle: BattleResult; a: ArenaSide; b: ArenaSide; phase: Phase }) {
  const { t, lang } = useT();
  const title = battle.verdict === "A" ? a.label : battle.verdict === "B" ? b.label : battle.verdict === "draw" ? t("battle.verdictDraw") : t("battle.verdictInconclusive");
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 18 }} className="text-center relative">
      {phase === "done" && (battle.verdict === "A" || battle.verdict === "B") && <Particles />}
      <div className="font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] text-cyan/80">{t("battle.reveal")}</div>
      <div className="mt-3 flex items-center justify-center gap-3 md:gap-5">
        <ScoreRing value={battle.overallA} size={84} stroke={7} tone={battle.verdict === "A" ? "mint" : "accent"} digits={1} />
        <ScoreRing value={battle.overallB} size={84} stroke={7} tone={battle.verdict === "B" ? "mint" : "violet"} digits={1} />
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className={cn("mt-4 font-display text-xl md:text-3xl font-bold tracking-tight", battle.verdict === "A" || battle.verdict === "B" ? "text-mint text-glow" : battle.verdict === "draw" ? "text-cyan" : "text-amber")}>
        {battle.verdict === "A" || battle.verdict === "B" ? (
          <>
            <Trophy className="inline mr-2 -mt-1" size={22} />
            {title}
          </>
        ) : (
          title
        )}
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="mt-2 text-xs text-fg-2 max-w-xs mx-auto">
        {verdictReason(battle, lang)}
      </motion.div>
    </motion.div>
  );
}

function Particles() {
  const parts = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2, r: 60 + ((i * 29) % 90), s: 2 + (i % 3), c: ["#34d399", "#22d3ee", "#4f7cff", "#eef0f3"][i % 4] })), []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: Math.cos(p.a) * p.r, y: Math.sin(p.a) * p.r, opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, delay: 0.1 + (i % 5) * 0.08, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: p.s, height: p.s, background: p.c, boxShadow: `0 0 8px ${p.c}` }}
        />
      ))}
    </div>
  );
}

export function BattleSummaryLinks({ a, b }: { a: ArenaSide; b: ArenaSide }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={paths.analysis(a.analysisId)}>
        <Button variant="outline" size="sm">
          {t("common.viewAnalysis")}: {a.label}
        </Button>
      </Link>
      <Link href={paths.analysis(b.analysisId)}>
        <Button variant="outline" size="sm">
          {t("common.viewAnalysis")}: {b.label}
        </Button>
      </Link>
      <Link href="/battle/new">
        <Button size="sm">
          <Swords size={14} /> {t("battle.startNew")}
        </Button>
      </Link>
    </div>
  );
}
