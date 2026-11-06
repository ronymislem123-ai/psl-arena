"use client";
import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-4 py-2 cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg-0">{label}</div>
        {hint && <div className="text-xs text-fg-2 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors", checked ? "bg-accent border-accent" : "bg-white/10 border-line-strong")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4f7cff] rounded" />
      <span className="text-sm text-fg-1">{label}</span>
    </label>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("h-10 rounded-xl border border-line-strong bg-bg-2 px-3 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-accent/50", className)} {...props}>
      {children}
    </select>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full rounded-xl border border-line-strong bg-bg-2 px-3 text-sm text-fg-0 placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-accent/50", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wider text-fg-2">{label}</div>
      {children}
      {hint && <div className="text-xs text-fg-3">{hint}</div>}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative glass-strong w-full rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto scrollbar-thin", wide ? "sm:max-w-3xl" : "sm:max-w-xl")}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg-1/90 backdrop-blur px-5 py-3">
          <div className="font-display font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-2 hover:bg-white/10 hover:text-fg-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto scrollbar-thin rounded-xl border border-line bg-bg-1/60 p-1", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors", value === t.id ? "bg-white/10 text-fg-0 shadow-sm" : "text-fg-2 hover:text-fg-0")}
        >
          {t.label}
          {t.count != null && <span className="rounded-md bg-white/10 px-1.5 text-[10px] text-fg-2">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub, tone = "accent", icon }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string; icon?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-start gap-3">
      {icon && <div className={cn("mt-0.5 shrink-0", `text-${tone}`)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-fg-2">{label}</div>
        <div className="font-display text-2xl font-semibold num mt-1">{value}</div>
        {sub && <div className="text-xs text-fg-3 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-fg-2">{children}</div>;
}
