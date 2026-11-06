import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, strong, children, ...props }: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div className={cn(strong ? "glass-strong" : "glass", "rounded-2xl", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-3", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="mt-0.5 text-cyan shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight text-fg-0">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-fg-2">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function SectionTitle({ children, className, kicker }: { children: ReactNode; className?: string; kicker?: ReactNode }) {
  return (
    <div className={cn("mb-4", className)}>
      {kicker && <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan/80 mb-1">{kicker}</div>}
      <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight">{children}</h2>
    </div>
  );
}
