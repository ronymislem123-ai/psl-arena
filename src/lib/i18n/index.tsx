"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { de } from "./de";
import { en, type Dict } from "./en";
import { IS_STATIC } from "@/lib/base-path";

/** Texts that describe the server app and read differently in the browser edition. */
const STATIC_OVERRIDES: Record<string, string> = {
  "dashboard.sub": "browser.dashboardSub",
  "battle.storeImagesHint": "browser.storeImagesHint",
  "side.storeImageHint": "browser.storeImageHint",
  "settings.privacyNote": "browser.privacyNote",
};

export type Lang = "en" | "de";
const DICTS: Record<Lang, Dict> = { en, de };

type TFn = (key: string, vars?: Record<string, string | number>) => string;
const Ctx = createContext<{ t: TFn; lang: Lang; dict: Dict }>({ t: (k) => k, lang: "en", dict: en });

function lookup(dict: Dict, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSettings((s) => s.language);
  const value = useMemo(() => {
    const dict = DICTS[lang] ?? en;
    const t: TFn = (rawKey, vars) => {
      const key = (IS_STATIC && STATIC_OVERRIDES[rawKey]) || rawKey;
      let s = lookup(dict, key) ?? lookup(en, key) ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    };
    return { t, lang, dict };
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}
