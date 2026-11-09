import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectProfileLandmarks, largestComponent, resample, smoothPolyline, traceBoundary, type ProfileMaskInput } from "@/engine/side-auto";
import { analyzeSideView, SIDE_CORE_POINTS, type SideLandmarkId } from "@/engine/side-view";
import type { SidePoints } from "@/engine/side-view";

/** The 16 points the synthetic drawing (tests/e2e/fixtures/profile-synthetic.jpg) was made from (same as side-view.test.ts). */
const PROFILE: SidePoints = {
  glabella: { x: 500, y: 300 }, nasion: { x: 490, y: 360 }, rhinion: { x: 520, y: 410 }, pronasale: { x: 560, y: 470 },
  subnasale: { x: 516, y: 500 }, alar_crease: { x: 500, y: 480 }, labrale_sup: { x: 522, y: 540 }, stomion: { x: 510, y: 565 },
  labrale_inf: { x: 518, y: 585 }, labiomental: { x: 500, y: 615 }, pogonion: { x: 514, y: 660 }, menton: { x: 490, y: 700 },
  cervical: { x: 430, y: 730 }, neck: { x: 430, y: 800 }, gonion: { x: 380, y: 640 }, tragion: { x: 330, y: 420 },
};

type Rle = number[][];
const decode = (rows: Rle, w: number, h: number) => {
  const out = new Uint8Array(w * h);
  rows.forEach((runs, y) => {
    let x = 0;
    for (let i = 0; i < runs.length; i += 2) {
      out.fill(runs[i], y * w + x, y * w + x + runs[i + 1]);
      x += runs[i + 1];
    }
  });
  return out;
};
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "fixtures", name), "utf8"));

function syntheticInput(): ProfileMaskInput {
  const f = fixture("profile-synthetic-mask.json");
  const m = decode(f.rows, f.width, f.height);
  return { width: f.width, height: f.height, foreground: Float32Array.from(m) };
}
function segInput(name: string): ProfileMaskInput {
  const f = fixture(name);
  return { width: f.width, height: f.height, foreground: Float32Array.from(decode(f.fg, f.width, f.height)), categories: decode(f.cat, f.width, f.height), scale: f.scale };
}
const mirrorInput = (inp: ProfileMaskInput): ProfileMaskInput => {
  const { width: w, height: h } = inp;
  const fg = new Float32Array(w * h);
  const cat = inp.categories ? new Uint8Array(w * h) : undefined;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    fg[y * w + x] = inp.foreground[y * w + (w - 1 - x)];
    if (cat) cat[y * w + x] = inp.categories![y * w + (w - 1 - x)];
  }
  return { ...inp, foreground: fg, categories: cat };
};

describe("contour helpers", () => {
  it("traces the outer boundary of a rectangle clockwise and closes", () => {
    const w = 20, h = 20;
    const b = new Uint8Array(w * h);
    for (let y = 5; y < 15; y++) for (let x = 4; x < 12; x++) b[y * w + x] = 1;
    const { mask, size } = largestComponent(b, w, h);
    expect(size).toBe(80);
    const t = traceBoundary(mask, w, h);
    expect(t).toHaveLength(2 * (8 + 10) - 4);
    expect(t[0]).toEqual({ x: 4, y: 5 });
    expect(t[1]).toEqual({ x: 5, y: 5 }); // clockwise in image coordinates (east first)
  });
  it("keeps only the largest component", () => {
    const w = 10, h = 4;
    const b = new Uint8Array(w * h);
    b[0] = 1;
    for (let x = 4; x < 9; x++) b[w + x] = b[2 * w + x] = 1;
    expect(largestComponent(b, w, h).size).toBe(10);
  });
  it("resamples at a fixed step and smooths without shifting a straight line", () => {
    const line = Array.from({ length: 11 }, (_, i) => ({ x: i, y: 2 * i }));
    const r = resample(line, Math.hypot(1, 2) / 2);
    expect(r.length).toBe(21);
    const s = smoothPolyline(line, 2);
    expect(s[5].x).toBeCloseTo(5, 6);
    expect(s[5].y).toBeCloseTo(10, 6);
  });
});

describe("automatic profile landmarks — synthetic profile with known points", () => {
  const r = detectProfileLandmarks(syntheticInput());
  it("detects a right-facing profile with all midline points", () => {
    expect(r.ok).toBe(true);
    expect(r.facing).toBe("right");
    for (const id of SIDE_CORE_POINTS) expect(r.points[id], id).toBeDefined();
  });
  // the drawing was made from the PROFILE coordinates; contour points must land close to them
  const tol: Partial<Record<SideLandmarkId, number>> = { pronasale: 8, subnasale: 12, labrale_sup: 12, stomion: 14, labrale_inf: 14, labiomental: 14, pogonion: 14, nasion: 18, glabella: 30, menton: 25 };
  for (const [id, t] of Object.entries(tol) as [SideLandmarkId, number][]) {
    it(`${id} within ${t} px of the drawn point`, () => {
      const p = r.points[id]!;
      const q = PROFILE[id];
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(t);
    });
  }
  it("does not invent points that are not on the silhouette", () => {
    expect(r.points.alar_crease).toBeUndefined();
    expect(r.points.tragion).toBeUndefined();
    expect(r.sources.pronasale).toBe("contour");
  });
  it("is mirror-invariant (left-facing copy gives mirrored points)", () => {
    const inp = syntheticInput();
    const m = detectProfileLandmarks(mirrorInput(inp));
    expect(m.facing).toBe("left");
    for (const id of ["pronasale", "subnasale", "pogonion", "labrale_sup"] as SideLandmarkId[]) {
      expect(Math.abs(m.points[id]!.x - (inp.width - r.points[id]!.x))).toBeLessThan(2.5);
      expect(Math.abs(m.points[id]!.y - r.points[id]!.y)).toBeLessThan(2.5);
    }
  });
  it("is deterministic (same input → identical output)", () => {
    expect(detectProfileLandmarks(syntheticInput())).toEqual(r);
  });
  it("feeds the side-view engine: analyzable, automatic placement, off-contour measures not determinable", () => {
    const s = analyzeSideView(r.points, { placement: "automatic", pointSources: r.sources });
    expect(s.analyzable).toBe(true);
    expect(s.assumptionCodes).toContain("automaticPlacement");
    const m = (id: string) => s.measurements.find((x) => x.id === id)!;
    expect(m("FCA").value).not.toBeNull();
    expect(m("NLA").value).not.toBeNull();
    expect(m("GOODE").value).toBeNull();
    expect(m("GOODE").missingLandmarks).toEqual(["alar_crease"]);
    expect(m("GA").value).toBeNull();
    // the convexity measured from the automatic points agrees with the drawn points
    const ref = analyzeSideView(PROFILE).measurements.find((x) => x.id === "FCA")!.value!;
    expect(Math.abs(m("FCA").value! - ref)).toBeLessThan(4);
  });
});

describe("automatic profile landmarks — real segmentation of a rendered 3D head scan", () => {
  for (const name of ["side-seg-r_90.json", "side-seg-r_100m12.json"]) {
    const inp = segInput(name);
    const r = detectProfileLandmarks(inp);
    it(`${name}: finds the full midline, cervical and neck point`, () => {
      expect(r.ok).toBe(true);
      expect(r.facing).toBe("right");
      for (const id of [...SIDE_CORE_POINTS, "cervical", "neck"] as SideLandmarkId[]) expect(r.points[id], id).toBeDefined();
    });
    it(`${name}: anatomical order and plausible profile values`, () => {
      const s = analyzeSideView(r.points, { placement: "automatic" });
      expect(s.analyzable).toBe(true);
      const v = (id: string) => s.measurements.find((x) => x.id === id)!.value!;
      expect(v("FCA")).toBeGreaterThan(155);
      expect(v("FCA")).toBeLessThan(185);
      expect(v("NLA")).toBeGreaterThan(80);
      expect(v("NLA")).toBeLessThan(140);
      expect(v("NFA")).toBeGreaterThan(110);
      expect(v("NFA")).toBeLessThan(160);
      expect(v("CMA")).toBeGreaterThan(90);
      expect(v("CMA")).toBeLessThan(160);
    });
    it(`${name}: a mirrored image gives the same angles`, () => {
      const m = detectProfileLandmarks(mirrorInput(inp));
      expect(m.facing).toBe("left");
      const a = analyzeSideView(r.points).measurements;
      const b = analyzeSideView(m.points).measurements;
      for (const id of ["FCA", "NLA", "NFA", "LFH"]) {
        const x = a.find((q) => q.id === id)!.value!;
        const y = b.find((q) => q.id === id)!.value!;
        expect(Math.abs(x - y), id).toBeLessThan(2);
      }
    });
  }
});

describe("automatic profile landmarks — tipped head", () => {
  it("warns when the head is tipped (render pitched by 12°) and stays quiet for an upright head", () => {
    const upright = detectProfileLandmarks(segInput("side-seg-r_90.json"));
    const pitched = detectProfileLandmarks(segInput("side-seg-r_100m12.json"));
    expect(upright.issues.map((i) => i.code)).not.toContain("headTilted");
    const w = pitched.issues.find((i) => i.code === "headTilted");
    expect(w?.severity).toBe("warning");
    expect(w?.params?.deg).toBeGreaterThan(12);
  });
});

describe("automatic profile landmarks — hair in front of the forehead", () => {
  const HAIR = 1;
  const base = segInput("side-seg-r_90.json");
  const r0 = detectProfileLandmarks(base);
  const sc = base.scale ?? 1;
  const toMask = (p: { x: number; y: number }) => ({ x: p.x / sc - 0.5, y: p.y / sc - 0.5 });
  const G = toMask(r0.points.glabella!);
  const N = toMask(r0.points.nasion!);
  const P = toMask(r0.points.pronasale!);
  const nose = Math.hypot(P.x - N.x, P.y - N.y); // ≈ 4.8 cm
  const paint = (inp: ProfileMaskInput, f: (x: number, y: number) => boolean, fg: boolean) => {
    const { width: w, height: h } = inp;
    const fgOut = Float32Array.from(inp.foreground);
    const cat = Uint8Array.from(inp.categories!);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f(x, y)) {
      if (fg) fgOut[y * w + x] = 1;
      if (fg || fgOut[y * w + x] >= 0.5) cat[y * w + x] = HAIR;
    }
    return { ...inp, foreground: fgOut, categories: cat };
  };
  const catAt = (inp: ProfileMaskInput, p: { x: number; y: number }, inward: number) => {
    const m = toMask(p);
    return inp.categories![Math.round(m.y) * inp.width + Math.round(m.x - inward)];
  };

  it("a hair curl in front of the brow does not become the glabella", () => {
    // curl: a disc of hair attached to the forehead, reaching about 1.7 cm in front of it just above the glabella
    const c = { x: G.x + 0.15 * nose, y: G.y - 0.12 * nose };
    const rad = 0.2 * nose;
    const inp = paint(base, (x, y) => (x - c.x) ** 2 + (y - c.y) ** 2 <= rad * rad, true);
    const r = detectProfileLandmarks(inp);
    expect(r.ok, JSON.stringify({ issues: r.issues, diag: r.diag })).toBe(true);
    if (r.points.glabella) expect(catAt(inp, r.points.glabella, 0.05 * nose)).not.toBe(HAIR);
    else expect(r.issues.map((i) => i.code)).toContain("hairOverForehead");
    expect(Math.hypot(r.points.nasion!.x / sc - N.x - 0.5, r.points.nasion!.y / sc - N.y - 0.5)).toBeLessThan(0.1 * nose);
  });

  it("hair covering the whole forehead: glabella not determinable, the rest of the profile is measured", () => {
    // fringe down to just above the nasion, protruding in front of the forehead
    const yHair = N.y - 0.2 * nose;
    const inp = paint(base, (x, y) => y < yHair && x > G.x - 0.6 * nose && x < G.x + 0.25 * nose, true);
    const r = detectProfileLandmarks(inp);
    expect(r.ok).toBe(true);
    expect(r.points.glabella).toBeUndefined();
    expect(r.issues.map((i) => i.code)).toContain("hairOverForehead");
    const s = analyzeSideView(r.points, { placement: "automatic" });
    expect(s.analyzable).toBe(true);
    const m = (id: string) => s.measurements.find((x) => x.id === id)!;
    for (const id of ["FCA", "LFH", "MFP", "CHP", "NFA"]) expect(m(id).value, id).toBeNull();
    for (const id of ["NLA", "CMA", "ZANG"]) expect(m(id).value, id).not.toBeNull();
  });
});

describe("automatic profile landmarks — unusable inputs", () => {
  it("rejects an empty mask", () => {
    const r = detectProfileLandmarks({ width: 50, height: 50, foreground: new Float32Array(2500) });
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe("noPerson");
  });
  it("rejects a frontal-like blob without a nose", () => {
    const w = 200, h = 300;
    const fg = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x - 100) / 60) ** 2 + ((y - 120) / 90) ** 2 < 1 || (y > 200 && Math.abs(x - 100) < 30)) fg[y * w + x] = 1;
    const r = detectProfileLandmarks({ width: w, height: h, foreground: fg });
    expect(r.ok).toBe(false);
    expect(["noNose", "chinNotFound"]).toContain(r.issues.find((i) => i.severity === "error")!.code);
  });
});
