import { describe, expect, it } from "vitest";
import { parseExif } from "@/engine/capture/exif";

/** Builds a JPEG header with an APP1 EXIF block (TIFF, chosen byte order) containing Software, ExifIFD → FocalLength, FocalLengthIn35mmFilm. */
function jpegWithExif(le: boolean, software = "Snapseed 2.0", focal = [55, 10], f35 = 26): Uint8Array {
  const tiff: number[] = [];
  const w16 = (v: number) => (le ? tiff.push(v & 0xff, v >> 8) : tiff.push(v >> 8, v & 0xff));
  const w32 = (v: number) => (le ? tiff.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24) : tiff.push(v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff));
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]));
  w16(42);
  w32(8); // IFD0 at 8
  // IFD0: 2 entries
  const sw = [...software].map((c) => c.charCodeAt(0)).concat(0);
  const ifd0Size = 2 + 2 * 12 + 4;
  const swOff = 8 + ifd0Size;
  const exifOff = swOff + sw.length;
  w16(2);
  w16(0x0131); w16(2); w32(sw.length); w32(swOff);
  w16(0x8769); w16(4); w32(1); w32(exifOff);
  w32(0);
  tiff.push(...sw);
  // Exif IFD: 2 entries, then the rational
  const ratOff = exifOff + 2 + 2 * 12 + 4;
  w16(2);
  w16(0x920a); w16(5); w32(1); w32(ratOff);
  w16(0xa405); w16(3); w32(1); w16(f35); w16(0);
  w32(0);
  w32(focal[0]); w32(focal[1]);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xda, 0, 2]);
}

describe("EXIF reader", () => {
  it("reads focal lengths and software in both byte orders", () => {
    for (const le of [true, false]) {
      const info = parseExif(jpegWithExif(le));
      expect(info).toEqual({ software: "Snapseed 2.0", focalLengthMm: 5.5, focalLength35mm: 26 });
    }
  });
  it("returns null for non-JPEG data and JPEGs without EXIF", () => {
    expect(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
  });
  it("survives truncated data", () => {
    const full = jpegWithExif(true);
    for (let n = 4; n < full.length; n += 7) expect(() => parseExif(full.subarray(0, n))).not.toThrow();
  });
});

describe("capture classification", async () => {
  const { classifyCapture, estimateDistance, IRIS_DIAMETER_MM } = await import("@/engine/capture/classify");
  const { inputFromFixture, loadFixture } = await import("./helpers");
  const base = inputFromFixture(loadFixture("obama"));
  const rq = base.rawQuality;
  it("estimates the camera distance from the EXIF focal length and the iris diameter", () => {
    expect(estimateDistance({ ...rq, focalLength35mm: null }, base.mesh, 0)).toBeNull();
    const d = estimateDistance({ ...rq, focalLength35mm: 85 }, base.mesh, 0)!;
    const iris = Math.max(Math.hypot(base.mesh[469].x - base.mesh[471].x, base.mesh[469].y - base.mesh[471].y), Math.hypot(base.mesh[474].x - base.mesh[476].x, base.mesh[474].y - base.mesh[476].y));
    const expected = ((85 * Math.hypot(rq.imageWidth, rq.imageHeight)) / 43.27) * IRIS_DIAMETER_MM / iris / 10;
    expect(d.estimate).toBeCloseTo(expected, 6);
    expect(d.low).toBeLessThan(d.estimate);
    expect(d.high).toBeGreaterThan(d.estimate);
    // halving the focal length halves the distance (pinhole model)
    expect(estimateDistance({ ...rq, focalLength35mm: 42.5 }, base.mesh, 0)!.estimate).toBeCloseTo(d.estimate / 2, 6);
  });
  it("classifies view, tilt, elevation and framing from measured values and never guesses the undeterminable", () => {
    const c = classifyCapture(rq, { yaw: 12, pitch: -11, roll: 100 }, base.mesh);
    const get = (id: string) => c.items.find((i) => i.id === id)!;
    expect(get("view").value).toBe("slightlyTurned");
    expect(get("tilt").value).toBe("rotated");
    expect(get("elevation")).toMatchObject({ value: "chinDown", basis: "inferred" });
    expect(get("mirror").basis).toBe("undeterminable");
    expect(get("photographer").basis).toBe("undeterminable");
    expect(get("distance")).toMatchObject({ value: "unknown", basis: "undeterminable" });
    // with a phone-like focal length at arm's length the selfie item becomes "likely"
    const close = classifyCapture({ ...rq, focalLength35mm: 6 }, { yaw: 0, pitch: 0, roll: 0 }, base.mesh);
    expect(close.items.find((i) => i.id === "selfie")?.value).toBe("likely");
    expect(close.perspectiveInflation!).toBeGreaterThan(0.15);
  });
  it("a close-range estimate switches the effective capture distance and lowers depth-sensitive confidence, not the ratio values", async () => {
    const { analyzeFace } = await import("@/engine/analysis");
    const far = analyzeFace({ ...base, rawQuality: { ...rq, focalLength35mm: 200 }, config: { ...base.config, uncertaintySamples: 0 } });
    const near = analyzeFace({ ...base, rawQuality: { ...rq, focalLength35mm: 6 }, config: { ...base.config, uncertaintySamples: 0 } });
    expect(far.quality.captureDistance).toBe("standard");
    expect(near.quality.captureDistance).toBe("selfie");
    expect(near.quality.issues.some((i) => i.key === "perspective.close")).toBe(true);
    const nw = (a: typeof far) => a.ratios.find((r) => r.id === "N_BYZGO")!;
    expect(nw(near).value).toBeCloseTo(nw(far).value!, 9);
    expect(nw(near).confidence).toBeLessThan(nw(far).confidence);
  });
});
