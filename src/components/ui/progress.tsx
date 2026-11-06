"use client";
import { cn } from "@/lib/utils";

const TONE_BG: Record<string, string> = {
  mint: "bg-mint",
  cyan: "bg-cyan",
  accent: "bg-accent",
  amber: "bg-amber",
  rose: "bg-rose",
  violet: "bg-violet",
  muted: "bg-fg-3",
};

export function Progress({ value, tone = "accent", className, animate = true }: { value: number | null | undefined; tone?: string; className?: string; animate?: boolean }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", TONE_BG[tone] ?? TONE_BG.accent, animate && "transition-[width] duration-700 ease-out")} style={{ width: `${v}%` }} />
    </div>
  );
}
