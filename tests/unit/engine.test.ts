import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { RATIO_BY_ID } from "@/engine/ratios/database";
import { inputFromFixture, loadFixture } from "./helpers";

const frontal = ["obama", "astronaut", "ai-face", "biden"];

describe("engine on real landmark fixtures", () => {
  for (const name of frontal) {
    it(`analyses ${name} end to end`, () => {
      const res = analyzeFace(inputFromFixture(loadFixture(name)));
      expect(res.landmarks.length).toBeGreaterThan(40);
      expect(res.ratios).toHaveLength(42);
      const available = res.ratios.filter((r) => r.availability === "available");
      // 42 − 6 incomplete − NW (no neck points) = 35 evaluable when the hairline is given
      expect(available.length).toBe(35);
      expect(res.coverage.evaluable).toBe(35);
      expect(res.coverage.incomplete).toBe(6);
      expect(res.original.originalPercent).toBeNull();
      expect(res.original.pointsFromT1).toBe(res.original.t1Count * 10);
      if (res.quality.analyzable) {
        expect(res.scores.overall).not.toBeNull();
        expect(res.scores.overall!).toBeGreaterThan(0);
        expect(res.scores.overall!).toBeLessThanOrEqual(100);
      } else {
        // engine 3.1: an unusable photo fails the quality control — no overall result
        expect(res.qc!.status).toBe("failed");
        expect(res.qc!.checks.find((c) => c.id === "imageQuality")!.status).toBe("fail");
        expect(res.scores.overall).toBeNull();
        expect(res.scores.rubric!.categories.eye).not.toBeNull(); // the parts stay visible for transparency
      }
      // plausibility of a few anthropometric ratios
      const v = (id: keyof typeof RATIO_BY_ID) => res.ratios.find((r) => r.id === id)!.value!;
      expect(v("ESR")).toBeGreaterThan(38);
      expect(v("ESR")).toBeLessThan(55);
      expect(v("BIG")).toBeGreaterThan(70);
      expect(v("BIG")).toBeLessThan(100);
      expect(v("N_H")).toBeGreaterThan(1.0);
      expect(v("N_H")).toBeLessThan(2.2);
      expect(v("EME")).toBeGreaterThan(35);
      expect(v("EME")).toBeLessThan(65);
      expect(v("GS")).toBeGreaterThan(120);
      expect(v("GS")).toBeLessThan(175);
      expect(res.symmetry.score).not.toBeNull();
      expect(res.uncertainty!.overallSigma).toBeGreaterThan(0);
      expect(res.features.length).toBeGreaterThan(30);
      expect(res.additional).toHaveLength(10);
      // rubric 2.1: eyelid position measured from the iris and the lid contours (mm via the iris diameter)
      const mrd1 = res.additional.find((a) => a.id === "MRD1")!;
      const ssi = res.additional.find((a) => a.id === "SSI")!;
      expect(mrd1.availability).toBe("available");
      expect(mrd1.value!).toBeGreaterThan(1.5);
      expect(mrd1.value!).toBeLessThan(6.5);
      expect(ssi.value!).toBeGreaterThan(-5);
      expect(ssi.value!).toBeLessThan(2);
    });
  }

  it("is deterministic for identical input", () => {
    const f = loadFixture("ai-face");
    const a = analyzeFace(inputFromFixture(f));
    const b = analyzeFace(inputFromFixture(f));
    expect(a.scores).toEqual(b.scores);
    expect(a.uncertainty).toEqual(b.uncertainty);
  });

  it("detects a smile and reduces mouth-related confidence", () => {
    const res = analyzeFace(inputFromFixture(loadFixture("obama")));
    expect(res.quality.expression.smile).toBeGreaterThan(0.6);
    expect(res.quality.issues.some((i) => i.code === "expression")).toBe(true);
    const mouth = res.ratios.find((r) => r.id === "M_IPD")!;
    const eyesp = res.ratios.find((r) => r.id === "ESR")!;
    expect(mouth.confidence).toBeLessThan(eyesp.confidence);
  });

  it("rejects a strongly turned head", () => {
    const res = analyzeFace(inputFromFixture(loadFixture("ai-upper")));
    expect(Math.abs(res.quality.pose.yaw)).toBeGreaterThan(25);
    expect(res.quality.analyzable).toBe(false);
    expect(res.quality.issues.some((i) => i.code === "yaw" && i.severity === "error")).toBe(true);
  });

  it("normalises a rotated head (roll) before measuring", () => {
    const res = analyzeFace(inputFromFixture(loadFixture("mp-portrait-rot")));
    expect(Math.abs(res.mesh.rollDeg)).toBeGreaterThan(60);
    const pr = res.landmarks.find((l) => l.id === "pupil_R")!;
    const pl = res.landmarks.find((l) => l.id === "pupil_L")!;
    expect(Math.abs(pr.aligned.y - pl.aligned.y)).toBeLessThan(1e-6);
  });

  it("marks hairline ratios unavailable without a trichion and never invents them", () => {
    const res = analyzeFace(inputFromFixture(loadFixture("ai-face"), { trichion: null }));
    for (const id of ["TFWHR", "LFF", "FT_U", "FT_M", "FT_L", "FWHF"] as const) {
      const r = res.ratios.find((x) => x.id === id)!;
      expect(r.availability).toBe("unavailable");
      expect(r.value).toBeNull();
      expect(r.unavailableReason).toMatch(/Hairline/);
    }
    expect(res.coverage.evaluable).toBe(29);
    expect(res.quality.issues.some((i) => i.code === "hairline-not-found")).toBe(true);
  });

  it("enables NW only with manual neck points", () => {
    const f = loadFixture("ai-face");
    const without = analyzeFace(inputFromFixture(f));
    expect(without.ratios.find((r) => r.id === "NW")!.availability).toBe("unavailable");
    const mesh = f.mesh.map(([x, y]) => ({ x, y }));
    const menton = mesh[152];
    const withNeck = analyzeFace(inputFromFixture(f, { neck: { right: { x: menton.x - 60, y: menton.y + 40 }, left: { x: menton.x + 60, y: menton.y + 40 }, source: "manual" } }));
    const nw = withNeck.ratios.find((r) => r.id === "NW")!;
    expect(nw.availability).toBe("available");
    expect(nw.value).toBeGreaterThan(50);
  });

  it("excludes reconstructed ratios when configured", () => {
    const f = loadFixture("ai-face");
    const res = analyzeFace(inputFromFixture(f, { config: { includeReconstructed: false, captureDistance: "standard", uncertaintySamples: 0, seed: 1 } }));
    const gs = res.ratios.find((r) => r.id === "GS")!;
    expect(gs.availability).toBe("excluded");
    expect(gs.value).not.toBeNull();
    expect(res.coverage.excluded).toBe(6);
    expect(res.uncertainty).toBeNull();
  });

  it("always leaves incomplete ratios unmeasured", () => {
    const res = analyzeFace(inputFromFixture(loadFixture("astronaut")));
    for (const id of ["EBS", "IAA", "JFA", "DEV_IAA_JFA", "NBR_ALA", "EYS"] as const) {
      const r = res.ratios.find((x) => x.id === id)!;
      expect(r.availability).toBe("unavailable");
      expect(r.value).toBeNull();
      expect(r.index).toBeNull();
    }
  });
});
