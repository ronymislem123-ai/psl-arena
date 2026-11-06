import { describe, expect, it } from "vitest";
import { angleAt, createRng, dist, fitLine, intersectLines, polylineAtY, rotateAround, tiltDeg } from "@/engine/geometry";

describe("geometry", () => {
  it("measures distances and tilts", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    // lateral point higher (smaller y) → positive tilt, regardless of side
    expect(tiltDeg({ x: 0, y: 0 }, { x: 10, y: -10 })).toBeCloseTo(45);
    expect(tiltDeg({ x: 0, y: 0 }, { x: -10, y: -10 })).toBeCloseTo(45);
    expect(tiltDeg({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(-45);
  });
  it("rotates around a pivot and computes angles", () => {
    const p = rotateAround({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
    expect(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });
  it("fits and intersects lines", () => {
    const l1 = fitLine([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
    const l2 = fitLine([{ x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0 }]);
    const ix = intersectLines(l1, l2)!;
    expect(ix.x).toBeCloseTo(1);
    expect(ix.y).toBeCloseTo(1);
    expect(polylineAtY([{ x: 0, y: 0 }, { x: 10, y: 10 }], 5)).toEqual({ x: 5, y: 5 });
  });
  it("has a deterministic RNG", () => {
    const a = createRng(42), b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
