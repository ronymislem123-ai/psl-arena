"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CaptureDistance } from "@/engine/types";

export interface SettingsState {
  language: "en" | "de";
  reducedMotion: boolean;
  showMeshByDefault: boolean;
  includeReconstructed: boolean;
  defaultCaptureDistance: CaptureDistance;
  storeImagesByDefault: boolean;
  uncertaintySamples: number;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: "en",
      reducedMotion: false,
      showMeshByDefault: false,
      includeReconstructed: true,
      defaultCaptureDistance: "unknown",
      storeImagesByDefault: false,
      uncertaintySamples: 40,
      set: (patch) => set(patch),
    }),
    { name: "psl-arena-settings", skipHydration: true },
  ),
);

/** Rehydrate persisted settings after mount to avoid server/client markup mismatches. */
export function rehydrateSettings() {
  let firstVisit = false;
  try {
    firstVisit = localStorage.getItem("psl-arena-settings") === null;
  } catch {
    /* storage blocked: keep the default */
  }
  void Promise.resolve(useSettings.persist.rehydrate()).then(() => {
    // first visit: follow the browser language, so a German browser gets the app's own
    // German texts instead of offering to machine-translate the page (which breaks React)
    if (firstVisit && typeof navigator !== "undefined" && (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase().startsWith("de")) {
      useSettings.getState().set({ language: "de" });
    }
  });
}
