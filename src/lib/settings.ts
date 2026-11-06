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
  void useSettings.persist.rehydrate();
}
