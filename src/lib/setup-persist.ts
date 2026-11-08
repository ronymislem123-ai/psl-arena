"use client";
/**
 * Crash-safe battle / rater setup: the chosen photos (the app's own ≤ 1600 px
 * JPEG copy) and the manual adjustments are kept in sessionStorage, so that a
 * reload — including the automatic reload after a mobile browser killed the tab —
 * brings the selection back instead of starting from zero. sessionStorage stays on
 * this device, belongs to this tab and is cleared when the tab closes; it is
 * cleared as soon as the battle/rating has been started or the photos removed.
 */
import type { AnalysisCorrections, Point } from "@/engine/types";
import { freeSessionImages } from "@/lib/session-images";

export interface SavedSlot {
  dataUrl: string;
  fileName?: string;
  label: string;
  faceIndex: number;
  /** undefined (use estimate) is stored as `trichionSet: false` */
  trichion: Point | null;
  trichionSet: boolean;
  trichionConfirmed: boolean;
  neck: { right: Point; left: Point } | null;
  corrections: AnalysisCorrections;
}

export interface SavedSetup {
  v: 1;
  a?: SavedSlot;
  b?: SavedSlot;
}

const KEY = (name: string) => `psl-arena:setup:${name}`;

export function loadSetup(name: string): SavedSetup | null {
  try {
    const raw = sessionStorage.getItem(KEY(name));
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedSetup;
    return v && v.v === 1 ? v : null;
  } catch {
    return null;
  }
}

export function saveSetup(name: string, setup: SavedSetup): boolean {
  try {
    if (!setup.a && !setup.b) {
      sessionStorage.removeItem(KEY(name));
      return true;
    }
    sessionStorage.setItem(KEY(name), JSON.stringify(setup));
    return true;
  } catch {
    // quota exceeded: older session photos of finished battles are less important than the current setup
    try {
      freeSessionImages(2);
      sessionStorage.setItem(KEY(name), JSON.stringify(setup));
      return true;
    } catch {
      /* still too large: fall through */
    }
    // keep at least the smaller slot
    try {
      const slots = (["a", "b"] as const).filter((k) => setup[k]).sort((x, y) => setup[x]!.dataUrl.length - setup[y]!.dataUrl.length);
      if (slots.length === 2) {
        sessionStorage.setItem(KEY(name), JSON.stringify({ v: 1, [slots[0]]: setup[slots[0]] }));
        return false;
      }
    } catch {
      /* give up silently: restoring is a convenience */
    }
    try {
      sessionStorage.removeItem(KEY(name));
    } catch {
      /* ignore */
    }
    return false;
  }
}

export function clearSetup(name: string) {
  try {
    sessionStorage.removeItem(KEY(name));
  } catch {
    /* ignore */
  }
}
