"use client";
import "@/lib/dom-guard";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AppShell, type ShellUser } from "@/components/layout/app-shell";

export function Providers({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  return (
    <I18nProvider>
      <AppShell user={user}>{children}</AppShell>
    </I18nProvider>
  );
}
