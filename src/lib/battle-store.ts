"use client";
import { create } from "zustand";
import { analyzeFace } from "@/engine/analysis";
import type { AnalysisConfig, AnalysisResult, CaptureDistance, Point } from "@/engine/types";
import { buildAnalysisInput, prepareImage, type PreparedImage } from "@/lib/vision/pipeline";
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
}

const emptySlot = (): SlotState => ({ status: "empty", prep: null, faceIndex: 0, label: "", trichion: undefined, trichionConfirmed: false, neck: null, neckPlacing: false, preview: null });

interface BattleSetup {
  a: SlotState;
  b: SlotState;
  config: { captureDistance: CaptureDistance; includeReconstructed: boolean; storeImages: boolean };
  consent: { rights: boolean; adults: boolean };
  submitting: boolean;
  submitError: string | null;
  loadFile: (side: Side, file: File) => Promise<void>;
  clear: (side: Side) => void;
  setLabel: (side: Side, label: string) => void;
  setFaceIndex: (side: Side, i: number) => void;
  setTrichion: (side: Side, p: Point) => void;
  confirmTrichion: (side: Side) => void;
  resetTrichion: (side: Side) => void;
  setNeck: (side: Side, pts: { right: Point; left: Point } | null) => void;
  setNeckPlacing: (side: Side, v: boolean) => void;
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
  return buildAnalysisInput(slot.prep, slot.faceIndex, engineConfig(cfg, samples), { trichion: slot.trichion, trichionConfirmed: slot.trichionConfirmed, neck: slot.neck });
}

export const useBattleSetup = create<BattleSetup>()((set, get) => ({
  a: emptySlot(),
  b: emptySlot(),
  config: { captureDistance: "unknown", includeReconstructed: true, storeImages: false },
  consent: { rights: false, adults: false },
  submitting: false,
  submitError: null,

  initConfig: (cfg) => set((s) => ({ config: { ...s.config, ...cfg } })),

  loadFile: async (side, file) => {
    set((s) => ({ [side]: { ...s[side], status: "loading", error: undefined, prep: null, preview: null, fileName: file.name } }));
    try {
      const prep = await prepareImage(file, file.name);
      if (prep.faces.length === 0) {
        set((s) => ({ [side]: { ...s[side], status: "error", error: "no-face", prep: null } }));
        return;
      }
      set((s) => ({ [side]: { ...s[side], status: "ready", prep, faceIndex: 0, trichion: undefined, trichionConfirmed: false, neck: null, neckPlacing: false, label: s[side].label || (side === "a" ? "Person 1" : "Person 2") } }));
      get().recompute(side);
    } catch (e) {
      set((s) => ({ [side]: { ...s[side], status: "error", error: e instanceof Error ? e.message : String(e), prep: null } }));
    }
  },

  clear: (side) => set({ [side]: emptySlot() }),
  setLabel: (side, label) => set((s) => ({ [side]: { ...s[side], label } })),
  setFaceIndex: (side, i) => {
    set((s) => ({ [side]: { ...s[side], faceIndex: i, trichion: undefined, trichionConfirmed: false, neck: null } }));
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
  setNeck: (side, pts) => {
    set((s) => ({ [side]: { ...s[side], neck: pts, neckPlacing: false } }));
    get().recompute(side);
  },
  setNeckPlacing: (side, v) => set((s) => ({ [side]: { ...s[side], neckPlacing: v } })),
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

  reset: () => set({ a: emptySlot(), b: emptySlot(), consent: { rights: false, adults: false }, submitting: false, submitError: null }),
}));
