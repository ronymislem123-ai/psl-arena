import { describe, expect, it } from "vitest";
import { canonicalImageFrame, fitRigid, normaliseHeadPose, poseFromRotation, rotationFromPose, applyMat, type Point3 } from "@/engine/landmarks/pose";

const canon: Point3[] = Array.from({ length: 478 }, (_, i) => canonicalImageFrame(i));
const scaleShift = (pts: Point3[], s: number, t: Point3) => pts.map((p) => ({ x: s * p.x + t.x, y: s * p.y + t.y, z: s * p.z + t.z }));

describe("3D head pose", () => {
  it("recovers known rotations of the canonical face exactly", () => {
    for (const pose of [{ yaw: 0, pitch: 0, roll: 0 }, { yaw: 20, pitch: 0, roll: 0 }, { yaw: -15, pitch: 10, roll: 5 }, { yaw: 5, pitch: -12, roll: 175 }, { yaw: 0, pitch: 0, roll: 90 }]) {
      const R = rotationFromPose(pose);
      const pts = scaleShift(canon.map((p) => applyMat(R, p)), 40, { x: 500, y: 400, z: 0 });
      const n = normaliseHeadPose(pts);
      expect(n.pose.yaw).toBeCloseTo(pose.yaw, 6);
      expect(n.pose.pitch).toBeCloseTo(pose.pitch, 6);
      expect(n.pose.roll).toBeCloseTo(pose.roll, 6);
      expect(n.residualIpd).toBeLessThan(1e-9);
      // frontalised points equal the unrotated (scaled, shifted) template up to the common centroid
      const ref = scaleShift(canon, 40, { x: 500, y: 400, z: 0 });
      const dx = n.frontal[1].x - n.frontal[468].x;
      expect(dx).toBeCloseTo(ref[1].x - ref[468].x, 6);
    }
  });
  it("sign conventions: yaw + turns the face to image right, pitch + raises the chin, roll + is clockwise on screen", () => {
    const nose = (pose: { yaw: number; pitch: number; roll: number }) => applyMat(rotationFromPose(pose), canon[1]);
    const base = canon[1];
    expect(nose({ yaw: 20, pitch: 0, roll: 0 }).x).toBeGreaterThan(base.x); // nose tip moves to image right
    expect(nose({ yaw: 0, pitch: 20, roll: 0 }).y).toBeLessThan(base.y); // nose tip moves up (image y down)
    const leftEye = applyMat(rotationFromPose({ yaw: 0, pitch: 0, roll: 20 }), canon[473]);
    expect(leftEye.y).toBeGreaterThan(canon[473].y); // subject's left eye lower → clockwise
  });
  it("fitRigid is invariant to uniform scale and translation", () => {
    const pts = scaleShift(canon, 3.3, { x: -7, y: 12, z: 5 });
    const f = fitRigid(canon, pts, canon.map(() => 1));
    expect(f.scale).toBeCloseTo(3.3, 9);
    expect(poseFromRotation(f.R).yaw).toBeCloseTo(0, 9);
  });
});

describe("measurement frame at any in-plane rotation", async () => {
  const { analyzeFace } = await import("@/engine/analysis");
  const { inputFromFixture, loadFixture } = await import("./helpers");
  const rotate = (pts: { x: number; y: number; z?: number }[], deg: number) => {
    const r = (deg * Math.PI) / 180;
    const c = { x: 600, y: 600 };
    return pts.map((p) => ({ ...p, x: c.x + (p.x - c.x) * Math.cos(r) - (p.y - c.y) * Math.sin(r), y: c.y + (p.x - c.x) * Math.sin(r) + (p.y - c.y) * Math.cos(r) }));
  };
  for (const depth of [true, false]) {
    it(`${depth ? "3D" : "2D"} path: 90°, 180° and 270° rotations give identical ratios and stay analyzable`, () => {
      const base = inputFromFixture(loadFixture("obama"));
      const input = depth ? base : { ...base, mesh: base.mesh.map((p) => ({ x: p.x, y: p.y })) };
      const ref = analyzeFace({ ...input, config: { ...input.config, uncertaintySamples: 0 } });
      expect(ref.mesh.method).toBe(depth ? "3d" : "2d");
      for (const deg of [90, 180, 270, 135]) {
        const trichion = input.trichion ? { ...input.trichion, point: rotate([input.trichion.point], deg)[0] } : input.trichion;
        const a = analyzeFace({ ...input, mesh: rotate(input.mesh, deg), trichion, config: { ...input.config, uncertaintySamples: 0 } });
        expect(a.quality.analyzable).toBe(true);
        expect(Math.abs(((a.mesh.rollDeg - ref.mesh.rollDeg - deg + 540) % 360) - 180)).toBeLessThan(1e-6);
        for (const r of a.ratios) {
          const o = ref.ratios.find((x) => x.id === r.id)!;
          if (o.value == null) continue;
          expect(r.value, `${r.id} @${deg}°`).toBeCloseTo(o.value, 6);
        }
        expect(a.symmetry.score!).toBeCloseTo(ref.symmetry.score!, 6);
      }
    });
  }
});
