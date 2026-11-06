"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Clock3, LayoutDashboard, LogOut, Settings, Swords, UserRound, Users, Zap } from "lucide-react";
import { BRAND } from "@/config/brand";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { rehydrateSettings, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export interface ShellUser {
  email: string;
  name: string;
}

const NAV = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/battle/new", key: "nav.newBattle", icon: Swords },
  { href: "/profiles", key: "nav.profiles", icon: Users },
  { href: "/history", key: "nav.history", icon: Clock3 },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

const BARE_PREFIXES = ["/login", "/signup", "/reset"];

export function AppShell({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useSettings((s) => s.reducedMotion);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    rehydrateSettings();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const logout = async () => {
    setSigningOut(true);
    try {
      await api.logout();
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  if (bare) return <div className="min-h-dvh">{children}</div>;

  return (
    <div className="min-h-dvh flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-bg-1/70 backdrop-blur-xl sticky top-0 h-dvh">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-line">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent">
            <Zap size={16} />
          </span>
          <span className="font-display font-bold tracking-[0.12em] text-sm">{BRAND.name}</span>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                isActive(n.href) ? "bg-accent/15 text-fg-0 border border-accent/30" : "text-fg-2 hover:text-fg-0 hover:bg-white/5 border border-transparent",
              )}
            >
              <n.icon size={17} />
              {t(n.key)}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="px-3 py-3 border-t border-line">
            <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet/20 text-[#c4b5fd]">
                <UserRound size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-[11px] text-fg-3 truncate">{user.email}</div>
              </div>
              <button onClick={logout} disabled={signingOut} className="rounded-lg p-1.5 text-fg-2 hover:bg-white/10 hover:text-fg-0" title={t("auth.logout")} aria-label={t("auth.logout")} data-testid="logout">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
        <div className="px-5 py-3 border-t border-line text-[11px] text-fg-3 font-mono">v{BRAND.version} · engine local</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-line bg-bg-1/80 backdrop-blur-xl pt-[env(safe-area-inset-top)] box-content">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent">
              <Zap size={14} />
            </span>
            <span className="font-display font-bold tracking-[0.12em] text-sm">{BRAND.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/battle/new" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white">
              {t("nav.newBattle")}
            </Link>
            {user && (
              <button onClick={logout} disabled={signingOut} className="rounded-lg p-1.5 text-fg-2 hover:bg-white/10" aria-label={t("auth.logout")}>
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-10 max-w-[1500px] w-full mx-auto">{children}</main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-line bg-bg-1/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px]", isActive(n.href) ? "text-accent" : "text-fg-2")}>
              <n.icon size={18} />
              {t(n.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, kicker, action }: { title: ReactNode; subtitle?: ReactNode; kicker?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        {kicker && <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan/80 mb-1.5">{kicker}</div>}
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-fg-2 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
