import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type Tone = "accent" | "cyan" | "violet" | "rose" | "mint" | "amber" | "muted";

const TONES: Record<Tone, string> = {
  accent: "bg-accent-soft text-[#9db6ff] border-accent/30",
  cyan: "bg-cyan-soft text-cyan border-cyan/30",
  violet: "bg-violet-soft text-[#c4b5fd] border-violet/30",
  rose: "bg-rose-soft text-[#ff8fa3] border-rose/30",
  mint: "bg-mint-soft text-mint border-mint/30",
  amber: "bg-amber-soft text-amber border-amber/30",
  muted: "bg-white/5 text-fg-2 border-line",
};

export function Badge({ tone = "muted", className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", TONES[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function levelTone(level: string): Tone {
  switch (level) {
    case "good":
      return "mint";
    case "acceptable":
      return "cyan";
    case "poor":
      return "amber";
    case "unusable":
      return "rose";
    default:
      return "muted";
  }
}

export function statusTone(status: string): Tone {
  return status === "defined" ? "mint" : status === "reconstructed" ? "amber" : "muted";
}
