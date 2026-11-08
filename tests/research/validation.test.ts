/**
 * Model validation, part 1 (engine 2.0): builds the validation cases (groups A–E),
 * evaluates them with the current engine and writes
 *   <out>/cases.json        — the exact analysis inputs (re-used by the 1.x runner)
 *   <out>/results-new.json  — overall index, PSL, σ, symmetry, categories per case
 * <out> = $VALIDATION_OUT or test-results/validation. Part 2 (scripts/research/
 * validation-report.py) compares them with the engine 1.x results and writes
 * docs/research/model-validation.json.
 *
 * Groups:
 *  A  test–retest: 35 re-detections of two portraits under nuisance changes
 *  B  controlled single-feature deformations (10 operators × 5 amounts × 3 base faces)
 *  C  clearly different faces (real fixtures, AI faces, average face, ideal example)
 *  D  compensation: weak features with and without one excellent feature
 *  E  pose and symmetry: 3D yaw/pitch/roll of known faces, mirror-symmetric and asymmetric variants
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { analyzeFace, DEFAULT_CONFIG } from "@/engine/analysis";
import { rateFace } from "@/engine/psl/rating";
import { CATEGORY_WEIGHTS, CRITERIA, RUBRIC_AREAS } from "@/engine/psl/rubric";
import { aggregateHierarchy, frontalMeasures } from "@/engine/scoring/hierarchy";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { deformMesh, symmetrizeMesh, type Deformation, type DeformationId, type MeshPoint } from "@/engine/synth/deform";
import { IDEAL_MESH, IDEAL_TRICHION } from "@/engine/synth/ideal-mesh.data";
import { canonicalImageMesh } from "@/engine/synth/ideal";
import type { AnalysisInput } from "@/engine/types";
import { inputFromFixture, loadFixture, type Fixture } from "../unit/helpers";

const OUT = process.env.VALIDATION_OUT ?? join(__dirname, "..", "..", "test-results", "validation");
const REP = join(__dirname, "..", "fixtures", "repeatability");
const scale = snapshotScale(buildStandardScale());

interface Case { id: string; group: "A" | "B" | "C" | "D" | "E"; face: string; label: string; params?: Record<string, number | string>; input: AnalysisInput }

/** Hairline rule shared by all cases: 0.45 IPD above the mesh top, along the face's up direction. */
function withHairline(input: AnalysisInput): AnalysisInput {
  const m = input.mesh;
  const ipd = Math.hypot(m[473].x - m[468].x, m[473].y - m[468].y);
  const ux = (m[473].x - m[468].x) / ipd;
  const uy = (m[473].y - m[468].y) / ipd;
  // up = pupil line rotated by −90° (image y down)
  const up = { x: uy, y: -ux };
  return { ...input, trichion: { point: { x: m[10].x + up.x * 0.45 * ipd, y: m[10].y + up.y * 0.45 * ipd }, source: "manual", confidence: 1 } };
}

function fromMesh(mesh: MeshPoint[], samples: number, trichion?: { x: number; y: number }): AnalysisInput {
  const f: Fixture = { name: "synthetic", width: 1000, height: 1200, mesh: mesh.map((p) => [p.x, p.y, p.z ?? 0]) as [number, number, number][], blendshapes: {}, matrix: [] };
  const inp = inputFromFixture(f, { config: { ...DEFAULT_CONFIG, uncertaintySamples: samples } });
  return trichion ? { ...inp, trichion: { point: trichion, source: "manual", confidence: 1 } } : withHairline(inp);
}

/** Orthographic 3D rotation of a mesh about its centroid (yaw about the vertical axis, pitch about the horizontal, roll in-plane). */
function rotate3d(mesh: MeshPoint[], yawDeg: number, pitchDeg: number, rollDeg: number): MeshPoint[] {
  const n = mesh.length;
  const c = mesh.reduce<{ x: number; y: number; z: number }>((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n, z: s.z + (p.z ?? 0) / n }), { x: 0, y: 0, z: 0 });
  const [a, b, g] = [yawDeg, pitchDeg, rollDeg].map((d) => (d * Math.PI) / 180);
  return mesh.map((p) => {
    let x = p.x - c.x, y = p.y - c.y, z = (p.z ?? 0) - c.z;
    [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
    [y, z] = [y * Math.cos(b) - z * Math.sin(b), y * Math.sin(b) + z * Math.cos(b)];
    [x, y] = [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g)];
    return { x: x + c.x + 100, y: y + c.y + 100, z: z + c.z };
  });
}

const UNITS: Record<string, number> = { eyeSpacing: 0.04, eyeSize: 0.08, canthalTilt: 3, noseWidth: 0.08, mouthWidth: 0.06, lipFullness: 0.15, faceWidth: 0.05, jawWidth: 0.06, chinHeight: 0.04, midfaceHeight: 0.04 };

function buildCases(): Case[] {
  const cases: Case[] = [];
  // A — test–retest
  for (const f of readdirSync(REP).filter((x) => x.endsWith(".json") && x.includes("__") && !x.includes("transforms"))) {
    const fx = JSON.parse(readFileSync(join(REP, f), "utf8")) as Fixture;
    const [face, variant] = f.replace(".json", "").split("__");
    cases.push({ id: `A:${face}:${variant}`, group: "A", face, label: variant, input: withHairline(inputFromFixture(fx, { config: { ...DEFAULT_CONFIG, uncertaintySamples: 40 } })) });
  }
  // B — single-feature deformations on three base faces
  const bases: [string, MeshPoint[]][] = [
    ["obama", inputFromFixture(loadFixture("obama")).mesh as MeshPoint[]],
    ["ai-face", inputFromFixture(loadFixture("ai-face")).mesh as MeshPoint[]],
    ["average", canonicalImageMesh()],
  ];
  for (const [face, mesh] of bases) {
    for (const [op, unit] of Object.entries(UNITS)) {
      for (const k of [-2, -1, 0, 1, 2]) {
        const m = k === 0 ? mesh : deformMesh(mesh, [{ id: op as DeformationId, amount: k * unit }]);
        cases.push({ id: `B:${face}:${op}:${k}`, group: "B", face, label: `${op} ${k > 0 ? "+" : ""}${k}`, params: { op, k }, input: fromMesh(m, 12) });
      }
    }
  }
  // C — clearly different faces
  for (const name of ["obama", "biden", "ai-face", "mp-portrait-rot"]) cases.push({ id: `C:${name}`, group: "C", face: name, label: name, input: { ...inputFromFixture(loadFixture(name)), config: { ...DEFAULT_CONFIG, uncertaintySamples: 40 } } });
  const ideal = IDEAL_MESH.map(([x, y, z]) => ({ x, y, z }));
  cases.push({ id: "C:average", group: "C", face: "average", label: "canonical average face", input: fromMesh(canonicalImageMesh(), 40) });
  cases.push({ id: "C:ideal", group: "C", face: "ideal", label: "ideal example", input: fromMesh(ideal, 40, IDEAL_TRICHION) });
  // D — compensation: four weak features, with the eye area also weak (all-weak) or ideal (one-excellent)
  const weak: Deformation[] = [
    { id: "noseWidth", amount: 0.22 },
    { id: "jawWidth", amount: 0.16 },
    { id: "lipFullness", amount: -0.35 },
    { id: "chinHeight", amount: 0.1 },
  ];
  const weakEyes: Deformation[] = [
    { id: "eyeSpacing", amount: -0.1 },
    { id: "canthalTilt", amount: -6 },
  ];
  const half = (ds: Deformation[]) => ds.map((d) => ({ ...d, amount: d.amount / 2 }));
  cases.push({ id: "D:ideal", group: "D", face: "ideal", label: "ideal", input: fromMesh(ideal, 40, IDEAL_TRICHION) });
  cases.push({ id: "D:eyesOnlyWeak", group: "D", face: "ideal", label: "only the eyes weak", input: fromMesh(deformMesh(ideal, weakEyes), 40, IDEAL_TRICHION) });
  cases.push({ id: "D:allWeak", group: "D", face: "ideal", label: "eyes and four other features weak", input: fromMesh(deformMesh(ideal, [...weak, ...weakEyes]), 40, IDEAL_TRICHION) });
  cases.push({ id: "D:oneExcellent", group: "D", face: "ideal", label: "eyes excellent, four other features weak", input: fromMesh(deformMesh(ideal, weak), 40, IDEAL_TRICHION) });
  cases.push({ id: "D:balanced", group: "D", face: "ideal", label: "all six features moderately off", input: fromMesh(deformMesh(ideal, half([...weak, ...weakEyes])), 40, IDEAL_TRICHION) });
  // E — pose and symmetry
  for (const [face, mesh, tri] of [["ideal", ideal, true], ["obama", bases[0][1], false]] as const) {
    for (const yaw of [0, 5, 10, 15, 20, 25]) cases.push({ id: `E:${face}:yaw${yaw}`, group: "E", face, label: `yaw ${yaw}°`, params: { yaw }, input: fromMesh(rotate3d(mesh as MeshPoint[], yaw, 0, 0), 12) });
    for (const pitch of [-10, 10]) cases.push({ id: `E:${face}:pitch${pitch}`, group: "E", face, label: `pitch ${pitch}°`, params: { pitch }, input: fromMesh(rotate3d(mesh as MeshPoint[], 0, pitch, 0), 12) });
    for (const roll of [30, 90, 180]) cases.push({ id: `E:${face}:roll${roll}`, group: "E", face, label: `roll ${roll}°`, params: { roll }, input: fromMesh(rotate3d(mesh as MeshPoint[], 0, 0, roll), 12) });
    void tri;
  }
  const obamaSym = symmetrizeMesh(bases[0][1]);
  cases.push({ id: "E:obama:symmetrized", group: "E", face: "obama", label: "mirror-averaged", input: fromMesh(obamaSym, 40) });
  for (const k of [0.01, 0.02, 0.04]) cases.push({ id: `E:obama:asym${k}`, group: "E", face: "obama", label: `right eye raised ${k} IPD`, params: { asym: k }, input: fromMesh(deformMesh(obamaSym, [{ id: "asymmetryEye", amount: k }]), 40) });
  return cases;
}

it("builds the validation cases and evaluates them with engine 2.0", () => {
  mkdirSync(OUT, { recursive: true });
  const cases = buildCases();
  writeFileSync(join(OUT, "cases.json"), JSON.stringify(cases.map((c) => ({ ...c, input: { ...c.input, mesh: c.input.mesh.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round((p.z ?? 0) * 100) / 100]) } }))));
  const results = cases.map((c) => {
    const input = { ...c.input, mesh: c.input.mesh.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round((p.z ?? 0) * 100) / 100 })) };
    try {
      const a = analyzeFace(input);
      const r = rateFace({ frontal: a, scale });
      return { id: c.id, group: c.group, face: c.face, label: c.label, params: c.params ?? {}, analyzable: a.quality.analyzable, quality: a.quality.level, overall: a.scores.overall, overallSigma: a.uncertainty?.overallSigma ?? null, symmetry: a.symmetry.score, psl: r.score, pslSigma: r.scoreSigma, coverage: r.coverage, categories: a.scores.rubric?.categories ?? {}, penalty: r.aggregation?.compensationPenalty ?? null, pose: a.quality.pose };
    } catch (e) {
      return { id: c.id, group: c.group, face: c.face, label: c.label, params: c.params ?? {}, error: String(e) };
    }
  });
  writeFileSync(join(OUT, "results-new.json"), JSON.stringify(results, null, 1));

  // sensitivity of the C/D results to the model parameters: exponent p and category weights
  const sens = cases
    .filter((c) => c.group === "C" || c.group === "D")
    .map((c) => {
      const a = analyzeFace({ ...c.input, config: { ...c.input.config, uncertaintySamples: 40 } });
      const m = frontalMeasures(a.ratios, a.symmetry, a.additional);
      const byP = Object.fromEntries([1, 0.5, 0.25].map((p) => [`p=${p}`, aggregateHierarchy(m, p).overall]));
      // equal category weights instead of the evidence-informed ones
      const saved = { ...CATEGORY_WEIGHTS };
      for (const k of RUBRIC_AREAS) CATEGORY_WEIGHTS[k] = 100 / RUBRIC_AREAS.length;
      const equal = aggregateHierarchy(m).overall;
      Object.assign(CATEGORY_WEIGHTS, saved);
      // without landmark-reliability weights
      const flat = new Map([...m].map(([k, v]) => [k, { ...v, reliability: 1 }]));
      const noRel = aggregateHierarchy(flat).overall;
      return { id: c.id, ...byP, equalWeights: equal, noReliability: noRel };
    });
  writeFileSync(join(OUT, "sensitivity.json"), JSON.stringify(sens, null, 1));
  void CRITERIA;
  console.log(`cases: ${cases.length}; errors: ${results.filter((r) => "error" in r).length}`);
  expect(results.filter((r) => "error" in r)).toHaveLength(0);
});
