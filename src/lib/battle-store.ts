"use client";
import { create } from "zustand";
import { analyzeFace } from "@/engine/analysis";
import type { AnalysisConfig, AnalysisCorrections, AnalysisResult, CaptureDistance, Point, SemanticLandmarkId } from "@/engine/types";
import { buildAnalysisInput, prepareImage, type PreparedImage } from "@/lib/vision/pipeline";
import { dataUrlToBlob } from "@/lib/vision/image";
import { clearSetup, loadSetup, saveSetup, type SavedSetup, type SavedSlot } from "@/lib/setup-persist";
import { api } from "@/lib/api";
import { rememberSessionImage } from "@/lib/session-images";

export type Side = "a" | "b";

export interface SlotState {
  status: "empty" | "loading" | "ready" | "error";
  error?: string;
  prep: PreparedImage | null;
  faceIndex: number;
  label: string;
  /** undefined = use estimate; null = none; Point = user-set */
  trichion: Point | null | undefined;
  trichionConfirmed: boolean;
  neck: { right: Point; left: Point } | null;
  neckPlacing: boolean;
  preview: AnalysisResult | null;
  fileName?: string;
  /** engine 2.0: manual landmark / reference-axis corrections */
  corrections: AnalysisCorrections;
  correcting: boolean;
}

const noCorrections = (): AnalysisCorrections => ({ landmarks: {}, axisAdjustDeg: 0 });
const emptySlot = (): SlotState => ({ status: "empty", prep: null, faceIndex: 0, label: "", trichion: undefined, trichionConfirmed: false, neck: null, neckPlacing: false, preview: null, corrections: noCorrections(), correcting: false });

/** Manual adjustments of a slot in the form the input builder expects. */
export function slotManual(slot: SlotState) {
  return { trichion: slot.trichion, trichionConfirmed: slot.trichionConfirmed, neck: slot.neck, corrections: slot.corrections };
}

interface BattleSetup {
  a: SlotState;
  b: SlotState;
  config: { captureDistance: CaptureDistance; includeReconstructed: boolean; storeImages: boolean };
  consent: { rights: boolean; adults: boolean };
  submitting: boolean;
  submitError: string | null;
  /** set when the photos were brought back after a reload (crash-safe setup) */
  restored: boolean;
  /** re-loads the photos saved in this tab's session (after a reload or a browser crash) */
  restore: () => Promise<void>;
  loadFile: (side: Side, file: File) => Promise<void>;
  clear: (side: Side) => void;
  setLabel: (side: Side, label: string) => void;
  setFaceIndex: (side: Side, i: number) => void;
  setTrichion: (side: Side, p: Point) => void;
  confirmTrichion: (side: Side) => void;
  resetTrichion: (side: Side) => void;
  /** the hairline is hidden (fringe, hat): use no hairline at all */
  hideTrichion: (side: Side) => void;
  setNeck: (side: Side, pts: { right: Point; left: Point } | null) => void;
  setNeckPlacing: (side: Side, v: boolean) => void;
  setCorrecting: (side: Side, v: boolean) => void;
  moveLandmark: (side: Side, id: SemanticLandmarkId, p: Point) => void;
  setAxisAdjust: (side: Side, deg: number) => void;
  resetCorrections: (side: Side) => void;
  setConfig: (patch: Partial<BattleSetup["config"]>) => void;
  setConsent: (patch: Partial<BattleSetup["consent"]>) => void;
  initConfig: (cfg: Partial<BattleSetup["config"]>) => void;
  recompute: (side: Side) => void;
  start: () => Promise<string>;
  reset: () => void;
}

function engineConfig(cfg: BattleSetup["config"], samples: number): AnalysisConfig {
  return { includeReconstructed: cfg.includeReconstructed, captureDistance: cfg.captureDistance, uncertaintySamples: samples, seed: 20251106 };
}

function buildInput(slot: SlotState, cfg: BattleSetup["config"], samples: number) {
  if (!slot.prep) throw new Error("No image");
  return buildAnalysisInput(slot.prep, slot.faceIndex, engineConfig(cfg, samples), slotManual(slot));
}

/**
 * Photo preparation (full-size decode + face detection) runs one at a time: picking
 * both photos quickly would otherwise hold two full-resolution decodes and two
 * detections in memory at once, which is what pushes phone browsers over their
 * memory limit.
 */
let prepQueue: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = prepQueue.then(fn, fn);
  prepQueue = run.catch(() => undefined);
  return run;
}

function toSaved(slot: SlotState): SavedSlot | undefined {
  if (!slot.prep) return undefined;
  return {
    dataUrl: slot.prep.image.dataUrl,
    fileName: slot.fileName,
    label: slot.label,
    faceIndex: slot.faceIndex,
    trichion: slot.trichion ?? null,
    trichionSet: slot.trichion !== undefined,
    trichionConfirmed: slot.trichionConfirmed,
    neck: slot.neck,
    corrections: slot.corrections,
  };
}

export function createSetupStore(persistKey?: string) {
  // every user action that replaces a slot bumps its generation; a restore that started
  // earlier must not overwrite a photo the user picked while it was loading
  const gen = { a: 0, b: 0 };
  const store = create<BattleSetup>()((set, get) => ({
  a: emptySlot(),
  b: emptySlot(),
  config: { captureDistance: "unknown", includeReconstructed: true, storeImages: false },
  consent: { rights: false, adults: false },
  submitting: false,
  submitError: null,
  restored: false,

  restore: async () => {
    if (!persistKey || typeof window === "undefined") return;
    const saved = loadSetup(persistKey);
    if (!saved) return;
    for (const side of ["a", "b"] as const) {
      const sv = saved[side];
      if (!sv || get()[side].status !== "empty") continue;
      const g = ++gen[side];
      set((s) => ({ [side]: { ...s[side], status: "loading", fileName: sv.fileName } }));
      try {
        const blob = await dataUrlToBlob(sv.dataUrl);
        const prep = await queued(() => prepareImage(blob, sv.fileName ?? "photo.jpg"));
        if (gen[side] !== g || get()[side].status !== "loading") continue; // replaced or cleared meanwhile
        if (prep.faces.length === 0) {
          set((s) => ({ [side]: { ...s[side], status: "error", error: "no-face", prep: null } }));
          continue;
        }
        set((s) => ({
          [side]: {
            ...s[side],
            status: "ready",
            prep,
            faceIndex: Math.min(Math.max(0, sv.faceIndex), prep.faces.length - 1),
            label: s[side].label || sv.label,
            trichion: sv.trichionSet ? sv.trichion : undefined,
            trichionConfirmed: sv.trichionConfirmed,
            neck: sv.neck,
            neckPlacing: false,
            corrections: sv.corrections ?? noCorrections(),
            correcting: false,
          },
          restored: true,
        }));
        get().recompute(side);
      } catch (e) {
        if (gen[side] !== g) continue;
        set((s) => ({ [side]: { ...s[side], status: "error", error: e instanceof Error ? e.message : String(e), prep: null } }));
      }
    }
  },

  initConfig: (cfg) => set((s) => ({ config: { ...s.config, ...cfg } })),

  loadFile: async (side, file) => {
    const g = ++gen[side];
    set((s) => ({ [side]: { ...s[side], status: "loading", error: undefined, prep: null, preview: null, fileName: file.name } }));
    try {
      const prep = await queued(() => prepareImage(file, file.name));
      if (gen[side] !== g || get()[side].status !== "loading") return; // superseded by a newer pick
      if (prep.faces.length === 0) {
        set((s) => ({ [side]: { ...s[side], status: "error", error: "no-face", prep: null } }));
        return;
      }
      set((s) => ({ [side]: { ...s[side], status: "ready", prep, faceIndex: 0, trichion: undefined, trichionConfirmed: false, neck: null, neckPlacing: false, corrections: noCorrections(), correcting: false, label: s[side].label || (side === "a" ? "Person 1" : "Person 2") } }));
      get().recompute(side);
    } catch (e) {
      if (gen[side] !== g) return;
      set((s) => ({ [side]: { ...s[side], status: "error", error: e instanceof Error ? e.message : String(e), prep: null } }));
    }
  },

  clear: (side) => {
    gen[side]++;
    set({ [side]: emptySlot() });
  },
  setLabel: (side, label) => set((s) => ({ [side]: { ...s[side], label } })),
  setFaceIndex: (side, i) => {
    set((s) => ({ [side]: { ...s[side], faceIndex: i, trichion: undefined, trichionConfirmed: false, neck: null, corrections: noCorrections(), correcting: false } }));
    get().recompute(side);
  },
  setTrichion: (side, p) => {
    set((s) => ({ [side]: { ...s[side], trichion: p, trichionConfirmed: false } }));
    get().recompute(side);
  },
  confirmTrichion: (side) => {
    const slot = get()[side];
    const p = slot.trichion ?? slot.prep?.hairline[slot.faceIndex]?.point ?? null;
    if (!p) return;
    set((s) => ({ [side]: { ...s[side], trichion: p, trichionConfirmed: true } }));
    get().recompute(side);
  },
  resetTrichion: (side) => {
    set((s) => ({ [side]: { ...s[side], trichion: undefined, trichionConfirmed: false } }));
    get().recompute(side);
  },
  hideTrichion: (side) => {
    set((s) => ({ [side]: { ...s[side], trichion: null, trichionConfirmed: false } }));
    get().recompute(side);
  },
  setNeck: (side, pts) => {
    set((s) => ({ [side]: { ...s[side], neck: pts, neckPlacing: false } }));
    get().recompute(side);
  },
  setNeckPlacing: (side, v) => set((s) => ({ [side]: { ...s[side], neckPlacing: v } })),
  setCorrecting: (side, v) => set((s) => ({ [side]: { ...s[side], correcting: v, neckPlacing: v ? false : s[side].neckPlacing } })),
  moveLandmark: (side, id, p) => {
    set((s) => ({ [side]: { ...s[side], corrections: { ...s[side].corrections, landmarks: { ...s[side].corrections.landmarks, [id]: p } } } }));
    get().recompute(side);
  },
  setAxisAdjust: (side, deg) => {
    set((s) => ({ [side]: { ...s[side], corrections: { ...s[side].corrections, axisAdjustDeg: deg } } }));
    get().recompute(side);
  },
  resetCorrections: (side) => {
    set((s) => ({ [side]: { ...s[side], corrections: noCorrections() } }));
    get().recompute(side);
  },
  setConfig: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }));
    get().recompute("a");
    get().recompute("b");
  },
  setConsent: (patch) => set((s) => ({ consent: { ...s.consent, ...patch } })),

  recompute: (side) => {
    const slot = get()[side];
    if (!slot.prep) return;
    try {
      const input = buildInput(slot, get().config, 0);
      const preview = analyzeFace(input);
      set((s) => ({ [side]: { ...s[side], preview } }));
    } catch (e) {
      console.error(e);
    }
  },

  start: async () => {
    const { a, b, config, consent } = get();
    if (!a.prep || !b.prep) throw new Error("Both images required");
    if (!consent.rights || !consent.adults) throw new Error("Consent required");
    set({ submitting: true, submitError: null });
    try {
      const mk = (slot: SlotState) =>
        api.createAnalysis({
          profileLabel: slot.label.trim() || undefined,
          imageDataUrl: config.storeImages ? slot.prep!.image.dataUrl : undefined,
          storeImage: config.storeImages,
          consent: { rightsConfirmed: true, adultsConfirmed: true },
          input: buildInput(slot, config, 40),
        });
      const [ra, rb] = await Promise.all([mk(a), mk(b)]);
      rememberSessionImage(ra.analysis.id, a.prep.image.dataUrl);
      rememberSessionImage(rb.analysis.id, b.prep.image.dataUrl);
      const { battle } = await api.createBattle(ra.analysis.id, rb.analysis.id);
      set({ submitting: false });
      return battle.id;
    } catch (e) {
      set({ submitting: false, submitError: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  reset: () => {
    gen.a++;
    gen.b++;
    set({ a: emptySlot(), b: emptySlot(), consent: { rights: false, adults: false }, submitting: false, submitError: null, restored: false });
    // forget the saved setup right away: the debounced save may never run if the page is left quickly
    if (persistKey && typeof window !== "undefined") clearSetup(persistKey);
  },
  }));

  if (persistKey && typeof window !== "undefined") {
    let timer: ReturnType<typeof setTimeout> | null = null;
    store.subscribe((s, prev) => {
      if (s.a === prev.a && s.b === prev.b) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const cur = store.getState();
        const before = loadSetup(persistKey);
        const next: SavedSetup = { v: 1 };
        for (const side of ["a", "b"] as const) {
          const slot = cur[side];
          // a slot that is (re)loading keeps its saved photo until the new one is ready
          const keep = slot.status === "loading" ? before?.[side] : undefined;
          const v = toSaved(slot) ?? keep;
          if (v) next[side] = v;
        }
        if (next.a || next.b) saveSetup(persistKey, next);
        else clearSetup(persistKey);
      }, 300);
    });
  }
  return store;
}

export type SetupStore = ReturnType<typeof createSetupStore>;

/** Shared store of the two-person battle setup (crash-safe: survives a reload of the tab). */
export const useBattleSetup = createSetupStore("battle");

/** Separate store for the single-photo rater (slot "a" only). */
export const useRaterSetup = createSetupStore("rater");
