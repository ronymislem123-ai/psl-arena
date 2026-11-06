"use client";
import { useEffect, useState } from "react";
import { cn, scoreTone } from "@/lib/utils";
import { useSettings } from "@/lib/settings";

const TONE_STROKE: Record<string, string> = {
  mint: "#34d399",
  cyan: "#22d3ee",
  accent: "#4f7cff",
  amber: "#f5b547",
  rose: "#f0506e",
  muted: "#4b5160",
  violet: "#8b5cf6",
};

export function useCountUp(target: number | null | undefined, duration = 1200, enabled = true): number | null {
  const reduced = useSettings((s) => s.reducedMotion);
  const animate = enabled && !reduced && target != null;
  const [animated, setAnimated] = useState<{ target: number; value: number } | null>(null);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    const goal = target as number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated({ target: goal, value: goal * eased });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, animate]);
  if (!animate) return target ?? null;
  return animated && animated.target === target ? animated.value : 0;
}

export function ScoreRing({
  value,
  size = 120,
  stroke = 8,
  label,
  sublabel,
  tone,
  animate = true,
  className,
  digits = 0,
}: {
  value: number | null | undefined;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: string;
  animate?: boolean;
  className?: string;
  digits?: number;
}) {
  const shown = useCountUp(value ?? null, 1200, animate);
  const t = tone ?? scoreTone(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = shown == null ? 0 : Math.max(0, Math.min(1, shown / 100));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff12" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={TONE_STROKE[t]}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ filter: `drop-shadow(0 0 6px ${TONE_STROKE[t]}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display font-semibold num leading-none" style={{ fontSize: size * 0.27 }}>
          {shown == null ? "—" : shown.toFixed(digits)}
        </div>
        {label && <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-fg-2">{label}</div>}
        {sublabel && <div className="text-[10px] text-fg-3">{sublabel}</div>}
      </div>
    </div>
  );
}
