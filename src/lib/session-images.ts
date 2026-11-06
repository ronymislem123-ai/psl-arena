"use client";
import { useSyncExternalStore } from "react";

const PREFIX = "psl-arena:img:";

/**
 * Keeps the just-analysed photos available for the current browser session so the
 * arena and analysis center can render them even when the user chose not to store
 * photos on the server. Nothing leaves the device; sessionStorage is cleared when
 * the tab closes.
 */
export function rememberSessionImage(analysisId: string, dataUrl: string) {
  try {
    sessionStorage.setItem(PREFIX + analysisId, dataUrl);
  } catch {
    /* quota exceeded or storage disabled — the UI falls back to placeholders */
  }
}

export function readSessionImage(analysisId: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + analysisId);
  } catch {
    return null;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

/** Server snapshot is always null, so server and client markup match during hydration. */
export function useSessionImage(analysisId: string | null | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (analysisId ? readSessionImage(analysisId) : null),
    () => null,
  );
}
