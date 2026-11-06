"use client";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AppShell } from "@/components/layout/app-shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AppShell>{children}</AppShell>
    </I18nProvider>
  );
}
