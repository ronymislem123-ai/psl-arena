import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { resolveBattle } from "@/engine/battle";
import { inputFromFixture, loadFixture } from "./helpers";

describe("battle resolver", () => {
  it("declares a draw for identical analyses", () => {
    const a = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const b = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const r = resolveBattle(a, b);
    expect(r.verdict).toBe("draw");
    expect(r.diff).toBe(0);
    expect(r.rounds.every((x) => x.winner === "draw" || x.winner === "n/a")).toBe(true);
    expect(r.keyDifferences).toHaveLength(0);
  });

  it("produces rounds with real values and a consistent summary", () => {
    const a = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const b = analyzeFace(inputFromFixture(loadFixture("astronaut")));
    const r = resolveBattle(a, b);
    expect(r.rounds).toHaveLength(9);
    expect(r.rounds.map((x) => x.id)).toContain("jawline");
    expect(r.roundWinsA + r.roundWinsB + r.roundDraws).toBeLessThanOrEqual(9);
    expect(["A", "B", "draw", "inconclusive"]).toContain(r.verdict);
    expect(r.summary.length).toBeGreaterThan(10);
    if (r.verdict === "A") expect(r.overallA!).toBeGreaterThan(r.overallB!);
    if (r.verdict === "B") expect(r.overallB!).toBeGreaterThan(r.overallA!);
  });

  it("is inconclusive when an image is not analyzable", () => {
    const a = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const b = analyzeFace(inputFromFixture(loadFixture("ai-upper")));
    const r = resolveBattle(a, b);
    expect(r.verdict).toBe("inconclusive");
    expect(r.verdictReason).toMatch(/quality/);
  });

  it("is inconclusive when coverage is too low", () => {
    const a = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const b = analyzeFace(inputFromFixture(loadFixture("biden")));
    const low = { ...b, coverage: { ...b.coverage, evaluable: 15, fraction: 15 / 42 } };
    const r = resolveBattle(a, low);
    expect(r.verdict).toBe("inconclusive");
    expect(r.verdictReason).toMatch(/coverage/);
  });

});
