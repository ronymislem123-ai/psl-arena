"use client";
/** Interactive knockout bracket drawn as SVG (zoomable, scrollable; works on phones by horizontal scroll). */
import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roundName } from "@/engine/tournament/engine";
import type { Bracket, Match } from "@/engine/tournament/types";
import { useT } from "@/lib/i18n";

const BOX_W = 200;
const BOX_H = 56;
const COL_GAP = 70;
const ROW_GAP = 22;

export function BracketView({ bracket, names, onMatch, onDecide }: { bracket: Bracket; names: Map<string, string>; onMatch?: (m: Match) => void; onDecide?: (m: Match, winnerId: string) => void }) {
  const { t } = useT();
  const [zoom, setZoom] = useState(1);
  const rounds = bracket.rounds;
  const n0 = rounds[0].length;
  const height = n0 * (BOX_H + ROW_GAP);
  const width = rounds.length * (BOX_W + COL_GAP);
  const yOf = (r: number, i: number): number => {
    if (r === 0) return i * (BOX_H + ROW_GAP) + ROW_GAP / 2;
    return (yOf(r - 1, i * 2) + yOf(r - 1, i * 2 + 1)) / 2;
  };
  const label = (id: string | null) => (id ? names.get(id) ?? id : "—");
  const trunc = (s: string, n = 20) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  return (
    <div className="space-y-2" data-testid="bracket">
      <div className="flex items-center gap-2 print:hidden">
        <span className="text-xs text-fg-3">{t("tournaments.zoom")}</span>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><ZoomOut size={14} /></Button>
        <span className="font-mono text-xs w-10 text-center">{Math.round(zoom * 100)} %</span>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}><ZoomIn size={14} /></Button>
      </div>
      <div className="overflow-auto rounded-xl border border-line bg-bg-1/40 p-3 max-h-[70vh]">
        <svg width={width * zoom} height={(height + 30) * zoom} viewBox={`0 0 ${width} ${height + 30}`} className="font-sans">
          {rounds.map((rs, r) => (
            <g key={r}>
              <text x={r * (BOX_W + COL_GAP) + BOX_W / 2} y={14} textAnchor="middle" fontSize={11} fill="#7a818f" style={{ textTransform: "uppercase", letterSpacing: 2 }}>
                {(() => {
                  const name = roundName(r, rounds.length);
                  return name === "round" ? t("tournaments.rounds.round", { n: r + 1 }) : t(`tournaments.rounds.${name}`);
                })()}
              </text>
              {rs.map((m, i) => {
                const x = r * (BOX_W + COL_GAP);
                const y = yOf(r, i) + 24;
                const winnerA = m.winner && m.winner === m.a;
                const winnerB = m.winner && m.winner === m.b;
                const tied = m.status === "tied";
                return (
                  <g key={m.id} onClick={() => onMatch?.(m)} style={{ cursor: onMatch ? "pointer" : "default" }} data-testid={`match-${m.id}`} data-status={m.status}>
                    <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={10} fill="#12151b" stroke={tied ? "#f5b547" : m.status === "decided" || m.status === "manual" ? "#34d39966" : "#ffffff26"} />
                    <rect x={x} y={y} width={BOX_W} height={BOX_H / 2} rx={10} fill={winnerA ? "#34d39918" : "transparent"} />
                    <rect x={x} y={y + BOX_H / 2} width={BOX_W} height={BOX_H / 2} rx={10} fill={winnerB ? "#34d39918" : "transparent"} />
                    <line x1={x + 8} y1={y + BOX_H / 2} x2={x + BOX_W - 8} y2={y + BOX_H / 2} stroke="#ffffff14" />
                    <text x={x + 10} y={y + 19} fontSize={12} fill={winnerA ? "#34d399" : m.a ? "#eef0f3" : "#4b5160"} fontWeight={winnerA ? 600 : 400}>{trunc(label(m.a))}</text>
                    <text x={x + BOX_W - 10} y={y + 19} fontSize={11} textAnchor="end" fill="#b4bac6" fontFamily="ui-monospace, monospace">{m.scoreA != null ? m.scoreA.toFixed(2) : m.status === "bye" ? t("tournaments.bye") : ""}</text>
                    <text x={x + 10} y={y + 19 + BOX_H / 2} fontSize={12} fill={winnerB ? "#34d399" : m.b ? "#eef0f3" : "#4b5160"} fontWeight={winnerB ? 600 : 400}>{trunc(label(m.b))}</text>
                    <text x={x + BOX_W - 10} y={y + 19 + BOX_H / 2} fontSize={11} textAnchor="end" fill="#b4bac6" fontFamily="ui-monospace, monospace">{m.scoreB != null ? m.scoreB.toFixed(2) : ""}</text>
                    {tied && <text x={x + BOX_W / 2} y={y + BOX_H + 12} fontSize={10} textAnchor="middle" fill="#f5b547">{t("tournaments.tied")}</text>}
                    {r < rounds.length - 1 && (
                      <path d={`M${x + BOX_W},${y + BOX_H / 2} h${COL_GAP / 2} V${yOf(r + 1, Math.floor(i / 2)) + 24 + BOX_H / 2} h${COL_GAP / 2}`} fill="none" stroke="#ffffff33" strokeWidth={1.2} />
                    )}
                    {tied && onDecide && (
                      <g>
                        <rect x={x + 4} y={y + 2} width={14} height={14} rx={4} fill="#f5b54733" stroke="#f5b547" onClick={(e) => { e.stopPropagation(); onDecide(m, m.a!); }} style={{ cursor: "pointer" }} />
                        <rect x={x + 4} y={y + BOX_H / 2 + 2} width={14} height={14} rx={4} fill="#f5b54733" stroke="#f5b547" onClick={(e) => { e.stopPropagation(); onDecide(m, m.b!); }} style={{ cursor: "pointer" }} />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
          {bracket.championId && (
            <text x={(rounds.length - 1) * (BOX_W + COL_GAP) + BOX_W / 2} y={yOf(rounds.length - 1, 0) + 24 + BOX_H + 18} textAnchor="middle" fontSize={12} fill="#f5b547" fontWeight={600}>
              🏆 {label(bracket.championId)}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
