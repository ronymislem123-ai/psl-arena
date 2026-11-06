"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-[#6a90ff] shadow-glow border border-transparent",
  secondary: "bg-bg-3 text-fg-0 hover:bg-bg-4 border border-line-strong",
  ghost: "bg-transparent text-fg-1 hover:text-fg-0 hover:bg-white/5 border border-transparent",
  outline: "bg-transparent text-fg-0 border border-line-strong hover:border-accent/60 hover:bg-accent/10",
  danger: "bg-rose/15 text-rose border border-rose/30 hover:bg-rose/25",
};
const SIZES: Record<Size, string> = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2.5" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 select-none whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});
