"use client";
import { useSyncExternalStore } from "react";

const PREFIX = "psl-arena:img:";

/**
 * Keeps the just-analysed photos available for the current browser session so the
 * arena and analysis center can render them even when the user chose not to store
 * photos on the server. Nothing leaves the device; sessionStorage is cleared when
 * the tab closes.
 */
const INDEX = "psl-arena:img-index";
/** Most recent session photos kept (older ones fall back to placeholders). */
const KEEP = 8;

function readIndex(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(INDEX) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Drops the oldest session photos so that at most `keep` remain (sessionStorage holds only a few MB). */
export function freeSessionImages(keep = KEEP) {
  try {
    const idx = readIndex();
    while (idx.length > keep) sessionStorage.removeItem(PREFIX + idx.shift()!);
    sessionStorage.setItem(INDEX, JSON.stringify(idx));
  } catch {
    /* ignore */
  }
}

export function rememberSessionImage(analysisId: string, dataUrl: string) {
  const write = () => {
    sessionStorage.setItem(PREFIX + analysisId, dataUrl);
    const idx = readIndex().filter((x) => x !== analysisId);
    idx.push(analysisId);
    sessionStorage.setItem(INDEX, JSON.stringify(idx));
  };
  try {
    write();
    freeSessionImages();
  } catch {
    // quota exceeded: make room by dropping older photos, then try once more
    try {
      freeSessionImages(2);
      write();
    } catch {
      /* storage disabled or the photo alone is too large — the UI falls back to placeholders */
    }
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
