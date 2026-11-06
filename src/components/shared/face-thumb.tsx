"use client";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageUrl } from "@/lib/api";

export function FaceThumb({ imageId, label, size = 56, className, src }: { imageId?: string | null; label?: string; size?: number; className?: string; src?: string | null }) {
  const url = src ?? imageUrl(imageId);
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-line bg-bg-3", className)} style={{ width: size, height: size }} title={label}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label ?? ""} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-fg-3">
          <UserRound size={size * 0.45} />
        </div>
      )}
    </div>
  );
}

export function VerdictBadge({ verdict, labelA, labelB, className }: { verdict: string; labelA: string; labelB: string; className?: string }) {
  const text = verdict === "A" ? `${labelA} wins` : verdict === "B" ? `${labelB} wins` : verdict === "draw" ? "Draw" : "Inconclusive";
  const tone = verdict === "A" || verdict === "B" ? "bg-mint-soft text-mint border-mint/30" : verdict === "draw" ? "bg-cyan-soft text-cyan border-cyan/30" : "bg-amber-soft text-amber border-amber/30";
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium", tone, className)}>{text}</span>;
}
