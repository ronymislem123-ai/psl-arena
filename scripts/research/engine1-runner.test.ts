/**
 * Engine 1.x runner for the model validation (docs/MODEL_VALIDATION.md).
 * Usage: git worktree add ../psl-old 6391a18 && ln -s $PWD/node_modules ../psl-old/node_modules
 *        cp scripts/research/engine1-runner.test.ts ../psl-old/tests/unit/zz-old-validation.test.ts
 *        (cd ../psl-old && VALIDATION_OUT=$PWD/../psl-arena/test-results/validation npx vitest run tests/unit/zz-old-validation.test.ts --project server)
 * It reads cases.json written by tests/research/validation.test.ts and writes results-old.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { rateFace } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";

const OUT = process.env.VALIDATION_OUT!;
it("engine 1.x on the validation cases", () => {
  const cases = JSON.parse(readFileSync(`${OUT}/cases.json`, "utf8"));
  const scale = snapshotScale(buildStandardScale());
  const res = cases.map((c: { id: string; group: string; face: string; label: string; params?: Record<string, unknown>; input: { mesh: number[][] } & Record<string, unknown> }) => {
    // engine 1.x used only x/y
    const input = { ...c.input, mesh: c.input.mesh.map(([x, y]) => ({ x, y })) } as never;
    try {
      const a = analyzeFace(input) as ReturnType<typeof analyzeFace>;
      const r = rateFace({ frontal: a, scale });
      return { id: c.id, group: c.group, face: c.face, label: c.label, params: c.params ?? {}, analyzable: a.quality.analyzable, quality: a.quality.level, overall: a.scores.overall, overallSigma: a.uncertainty?.overallSigma ?? null, symmetry: a.symmetry.score, psl: r.score, pslSigma: r.scoreSigma, coverage: r.coverage, pose: a.quality.pose };
    } catch (e) {
      return { id: c.id, group: c.group, face: c.face, label: c.label, params: c.params ?? {}, error: String(e) };
    }
  });
  writeFileSync(`${OUT}/results-old.json`, JSON.stringify(res, null, 1));
  console.log("old cases", res.length, "errors", res.filter((r: { error?: string }) => r.error).length);
}, 1_800_000);
