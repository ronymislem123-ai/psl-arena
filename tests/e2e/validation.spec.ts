/**
 * Rating-consistency experiments on the real browser pipeline. Writes the measured
 * numbers to test-results/validation.json; docs/VALIDATION.md reports them.
 * Only repeatability is asserted (deterministic pipeline). The other deltas are
 * measured and reported, not asserted against invented thresholds.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIX = join(__dirname, "fixtures");
const OUT = join(__dirname, "..", "..", "test-results");
mkdirSync(OUT, { recursive: true });
const ACCOUNT = { email: `e2e-val-${Date.now()}@example.com`, password: "e2e strong password 42", name: "Validation" };

interface Row { label: string; file: string; score: number | null; tier: string | null; coverage: number; valid: boolean; areas: Record<string, number | null>; criteria: Record<string, number | null>; analysisOverall: number | null }

async function rate(page: Page, file: string, label: string): Promise<Row> {
  await page.goto("/rater");
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.locator('input[type="file"]').first().setInputFiles(join(FIX, file));
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", /analyzable|unusable/, { timeout: 120_000 });
  const state = await page.getByTestId("slot-a").getAttribute("data-state");
  if (state !== "analyzable") return { label, file, score: null, tier: null, coverage: 0, valid: false, areas: {}, criteria: {}, analysisOverall: null };
  await page.getByPlaceholder("e.g. Alex").fill(label);
  const confirm = page.getByRole("button", { name: "Confirm hairline" });
  if (await confirm.isEnabled()) await confirm.click();
  for (const box of await page.locator('input[type="checkbox"]').all()) if (!(await box.isChecked())) await box.check();
  await page.getByTestId("rate-button").click();
  await page.waitForURL(/\/rater\/rate_/, { timeout: 120_000 });
  const id = page.url().split("/").pop()!;
  const rec = (await (await page.request.get(`/api/ratings/${id}`)).json()).rating;
  const r = rec.result;
  const analysis = rec.analysisId ? (await (await page.request.get(`/api/analyses/${rec.analysisId}`)).json()).analysis : null;
  return {
    label, file, score: r.score, tier: r.tier?.name ?? null, coverage: r.coverage, valid: r.valid,
    areas: Object.fromEntries(r.areas.map((a: { id: string; score: number | null }) => [a.id, a.score])),
    criteria: Object.fromEntries(r.criteria.map((c: { id: string; score: number | null }) => [c.id, c.score])),
    analysisOverall: analysis?.result.scores.overall ?? null,
  };
}

test("rating consistency: repeat, mirror, downscale, crop", async ({ page }) => {
  test.setTimeout(600_000);
  expect([201, 409]).toContain((await page.request.post("/api/auth/signup", { data: ACCOUNT })).status());
  expect((await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } })).ok()).toBeTruthy();
  const rows: Row[] = [];
  for (const [file, label] of [["portrait-a.jpg", "A original"], ["portrait-a.jpg", "A repeat"], ["portrait-a-mirror.jpg", "A mirrored"], ["portrait-a-small.jpg", "A 60 % scale"], ["portrait-a-crop.jpg", "A tighter crop"], ["portrait-b.jpg", "B original"], ["portrait-b.jpg", "B repeat"]] as const) {
    rows.push(await rate(page, file, label));
  }
  const by = (l: string) => rows.find((r) => r.label === l)!;
  const diff = (x: Row, y: Row) => (x.score != null && y.score != null ? Math.abs(x.score - y.score) : null);
  const critDiff = (x: Row, y: Row) => {
    const ids = Object.keys(x.criteria).filter((k) => x.criteria[k] != null && y.criteria[k] != null);
    const d = ids.map((k) => Math.abs(x.criteria[k]! - y.criteria[k]!));
    return { n: d.length, mean: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, max: d.length ? Math.max(...d) : null, maxId: d.length ? ids[d.indexOf(Math.max(...d))] : null };
  };
  const report = {
    date: new Date().toISOString(),
    rows,
    repeatA: diff(by("A original"), by("A repeat")),
    repeatB: diff(by("B original"), by("B repeat")),
    mirror: diff(by("A original"), by("A mirrored")),
    mirrorCriteria: critDiff(by("A original"), by("A mirrored")),
    scale60: diff(by("A original"), by("A 60 % scale")),
    scaleCriteria: critDiff(by("A original"), by("A 60 % scale")),
    crop: diff(by("A original"), by("A tighter crop")),
    cropCriteria: critDiff(by("A original"), by("A tighter crop")),
    tierStable: { mirror: by("A original").tier === by("A mirrored").tier, scale60: by("A original").tier === by("A 60 % scale").tier, crop: by("A original").tier === by("A tighter crop").tier },
  };
  writeFileSync(join(OUT, "validation.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(__dirname, "..", "..", "docs", "validation-run.json"), JSON.stringify(report, null, 2)); // persisted copy (test-results is wiped per run)
  console.log(JSON.stringify(report, null, 2));
  // deterministic pipeline: identical input ⇒ identical score
  expect(report.repeatA).toBe(0);
  expect(report.repeatB).toBe(0);
});
