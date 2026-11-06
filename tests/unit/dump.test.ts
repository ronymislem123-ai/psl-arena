import { describe, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { RATIO_BY_ID } from "@/engine/ratios/database";
import { formatValue } from "@/engine/explain";
import { inputFromFixture, loadFixture } from "./helpers";

// Diagnostic table: run with DUMP=1 npx vitest run tests/unit/dump.test.ts
describe.skipIf(!process.env.DUMP)("dump", () => {
  it("prints ratio tables", () => {
    const names = ["obama", "astronaut", "ai-face", "biden"];
    const results = names.map((n) => analyzeFace(inputFromFixture(loadFixture(n))));
    const rows: string[] = [];
    rows.push(["#", "ratio", "T1", ...names].join("\t"));
    for (const def of Object.values(RATIO_BY_ID)) {
      const cells = results.map((r) => {
        const x = r.ratios.find((q) => q.id === def.id)!;
        if (x.availability !== "available") return x.availability === "excluded" ? "excl" : "n/a";
        return `${formatValue(x.value, def.unit)}${x.inT1 ? " ✓" : ""} (${x.index!.toFixed(0)}|${(x.confidence * 100).toFixed(0)}%)`;
      });
      rows.push([def.number, def.abbreviation, `${def.t1.min ?? ""}–${def.t1.max ?? ""}`, ...cells].join("\t"));
    }
    rows.push("");
    for (const [i, r] of results.entries()) {
      rows.push(`${names[i]}: overall=${r.scores.overall?.toFixed(1)} harmony=${r.scores.harmony?.toFixed(1)} proportion=${r.scores.proportion?.toFixed(1)} symmetry=${r.scores.symmetry?.toFixed(1)} conf=${(r.scores.confidence * 100).toFixed(0)}% quality=${r.quality.level}/${r.quality.score.toFixed(2)} yaw=${r.quality.pose.yaw.toFixed(1)} pitch=${r.quality.pose.pitch.toFixed(1)} roll=${r.quality.pose.roll.toFixed(1)} σ=${r.uncertainty?.overallSigma.toFixed(2)} T1=${r.original.t1Count}/${r.original.evaluableCount}`);
      rows.push(`  categories: ${r.categories.map((c) => `${c.id}=${c.index?.toFixed(0) ?? "-"}`).join(" ")}`);
      rows.push(`  issues: ${r.quality.issues.map((q) => `${q.severity}:${q.code}`).join(", ")}`);
    }
    console.log(rows.join("\n"));
  });
});
