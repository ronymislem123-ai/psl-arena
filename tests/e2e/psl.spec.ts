import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const FIX = join(__dirname, "fixtures");
const SHOTS = process.env.PSL_SCREENSHOT_DIR ?? join(__dirname, "..", "..", "test-results", "screens");
mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });

const ACCOUNT = { email: `e2e-psl-${Date.now()}@example.com`, password: "e2e strong password 42", name: "PSL Tester" };

async function signIn(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
  expect(res.ok()).toBeTruthy();
}

/** Rates a frontal photo through the real UI (in-browser detection) and returns the rating id + score. */
async function rateUpload(page: Page, file: string, label: string, scaleId?: string, beforeRate?: (page: Page) => Promise<void>) {
  await page.goto("/rater");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI PSL Rater");
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  if (scaleId) await page.getByTestId("rater-scale").selectOption(scaleId);
  await page.locator('input[type="file"]').first().setInputFiles(join(FIX, file));
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
  await page.getByPlaceholder("e.g. Alex").fill(label);
  const confirm = page.getByRole("button", { name: "Confirm hairline" });
  if (await confirm.isEnabled()) await confirm.click();
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    const text = await box.evaluate((el) => (el.closest("label")?.textContent ?? "").trim());
    if (/right to use|adult/i.test(text) && !(await box.isChecked())) await box.check();
  }
  if (beforeRate) await beforeRate(page);
  await expect(page.getByTestId("rate-button")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("rate-button").click();
  await page.waitForURL(/\/rater\/rate_/, { timeout: 120_000 });
  const id = page.url().split("/").pop()!;
  const score = Number(await page.getByTestId("rating-score").evaluate((el) => el.firstChild?.textContent));
  return { id, score };
}

test.describe("PSL platform: scale builder, rater, tournaments", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/auth/signup", { data: ACCOUNT });
    expect([201, 409]).toContain(res.status());
  });

  test("scale builder: create, validate, test assignment, save, reopen, duplicate, export/import, delete", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await page.goto("/scales");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Scale Builder");
    await expect(page.getByTestId("scale-card-scale_builtin_psl_standard")).toContainText("21 tiers");
    await shot(page, "50-scales-list");
    await page.getByTestId("scale-new").click();
    await page.waitForURL(/\/scales\/new/);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("scale-name").fill("E2E custom scale");
    await expect(page.getByTestId("scale-validation")).toHaveAttribute("data-valid", "true");
    // tier assignment on the unrounded value
    await page.getByTestId("scale-test-value").fill("4.6666");
    await expect(page.getByTestId("scale-test-result")).toContainText("Mid LTN");
    await page.getByTestId("scale-test-value").fill("10");
    await expect(page.getByTestId("scale-test-result")).toContainText("Adam");
    await page.getByTestId("scale-test-value").fill("10.2");
    await expect(page.getByTestId("scale-test-result")).toContainText("outside");
    // break the scale: shrink the top tier's max below the scale end → gap
    await page.getByTestId("tier-expand-adam").click();
    const adamRow = page.getByTestId("tier-row-adam");
    await adamRow.getByLabel("Max").first().fill("9.8");
    await expect(page.getByTestId("scale-validation")).toHaveAttribute("data-valid", "false");
    await expect(page.getByTestId("scale-validation")).toContainText("Gap");
    await expect(page.getByTestId("scale-save")).toBeDisabled();
    await shot(page, "51-scale-invalid");
    await adamRow.getByLabel("Max").first().fill("10");
    await expect(page.getByTestId("scale-validation")).toHaveAttribute("data-valid", "true");
    // remove a tier (neighbour absorbs the range) and add one
    await page.getByTestId("tier-remove-sub4").click();
    await expect(page.getByTestId("scale-validation")).toHaveAttribute("data-valid", "true");
    await page.getByTestId("tier-add").click();
    await expect(page.getByTestId("scale-validation")).toHaveAttribute("data-valid", "true");
    await page.getByTestId("scale-save").click();
    await page.waitForURL(/\/scales\/scale_/, { timeout: 30_000 });
    await expect(page.getByText("Scale saved.")).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await shot(page, "52-scale-saved");
    // reopen: persisted
    await page.goto(`/scales/${id}`);
    await expect(page.getByTestId("scale-name")).toHaveValue("E2E custom scale");
    await expect(page.getByTestId("tier-row-sub4")).toHaveCount(0);
    await expect(page.getByTestId("scale-validation")).toHaveAttribute("data-valid", "true");
    // export → import
    const exp = await page.request.get(`/api/scales/${id}/export`);
    expect(exp.ok()).toBeTruthy();
    const data = await exp.json();
    expect(data.format).toBe("psl-arena-scale");
    expect(data.scale.tiers.length).toBe(21);
    const imp = await page.request.post("/api/scales/import", { data: { data, name: "Imported copy" } });
    expect(imp.status()).toBe(201);
    const bad = await page.request.post("/api/scales/import", { data: { data: { ...data, scale: { ...data.scale, tiers: data.scale.tiers.slice(1) } } } });
    expect(bad.status()).toBe(400);
    // duplicate from the editor
    await page.getByTestId("scale-duplicate").click();
    await page.waitForURL((u) => /\/scales\/scale_/.test(u.pathname) && !u.pathname.endsWith(id));
    await expect(page.getByTestId("scale-name")).toHaveValue("E2E custom scale (copy)");
    await page.goto("/scales");
    await expect(page.getByTestId("scales-list").locator("[data-testid^=scale-card-]")).toHaveCount(4);
    // compare page
    await page.goto("/scales/compare");
    await expect(page.getByTestId("scale-bar")).toHaveCount(4);
    await shot(page, "53-scales-compare");
    // delete the copy via API
    const list = (await (await page.request.get("/api/scales")).json()).scales as { id: string; name: string }[];
    const copy = list.find((s) => s.name === "E2E custom scale (copy)")!;
    expect((await page.request.delete(`/api/scales/${copy.id}`)).ok()).toBeTruthy();
  });

  test("rater: rate photos on the standard and a custom scale, report format, repeatability, history", async ({ page }) => {
    test.setTimeout(420_000);
    await signIn(page);
    const a = await rateUpload(page, "portrait-a.jpg", "Alpha");
    await expect(page.getByTestId("rating-status")).toContainText(/Valid|Provisional/);
    await expect(page.getByTestId("rating-reasoning")).toContainText("Based on");
    await expect(page.getByText("Strengths")).toBeVisible();
    await expect(page.getByText("Lower-rated criteria")).toBeVisible();
    await expect(page.getByText("Overall assessment")).toBeVisible();
    await expect(page.getByText("Analysis quality")).toBeVisible();
    await expect(page.getByText(/does not determine a person/)).toBeVisible();
    await expect(page.locator('[data-testid="rating-criteria"] tbody tr')).toHaveCount(32); // rubric 3.0, front profile only
    await expect(page.getByTestId("rating-score-label")).toHaveText("PSL Score – Front Profile");
    await expect(page.getByTestId("front-profile-note")).toHaveText("The rating is based solely on the frontal view of the face. Traits that require a lateral perspective are not included in the overall score.");
    await expect(page.getByTestId("rating-band")).toContainText(/expression/);
    await expect(page.getByTestId("band-legend")).toContainText("0–2 very weak");
    await expect(page.getByTestId("rating-legacy-badge")).toHaveCount(0);
    await expect(page.getByTestId("scale-marker")).toBeVisible();
    await expect(page.getByTestId("rating-areas")).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, "54-rating-result");
    await page.getByTestId("criterion-canthalTilt").click();
    await expect(page.getByRole("dialog")).toContainText("Canthal tilt");
    await shot(page, "55-criterion-detail");
    await page.keyboard.press("Escape");
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThan(10);
    // the stored rating carries the scale snapshot and rubric version
    const rec = (await (await page.request.get(`/api/ratings/${a.id}`)).json()).rating;
    expect(rec.rubricVersion).toBe("3.0.0");
    expect(rec.sideAnalysisId).toBeNull();
    expect(rec.scaleSnapshot.tiers.length).toBe(21);
    expect(rec.result.criteria.filter((c: { assessable: boolean }) => c.assessable).length).toBeGreaterThan(20);
    expect(rec.result.notAssessable.some((n: { code: string }) => n.code === "requiresProfile")).toBe(false);
    // the shown score is Σ Sᵢ·Wᵢ over the assessable categories (weights renormalised)
    const scored = rec.result.areas.filter((x: { score: number | null }) => x.score != null);
    const w = scored.reduce((sum: number, x: { weight: number }) => sum + x.weight, 0);
    expect(rec.result.score).toBeCloseTo(scored.reduce((sum: number, x: { weight: number; score: number }) => sum + x.score * x.weight, 0) / w, 6);
    expect(a.score).toBe(Number(rec.result.score.toFixed(1)));

    // repeatability: the same image rated again gives the identical score
    const a2 = await rateUpload(page, "portrait-a.jpg", "Alpha again");
    expect(a2.score).toBe(a.score);

    // custom scale with two tiers → tier names come from the custom scale
    const scale = await page.request.post("/api/scales", { data: { name: "Two tiers", description: "", rangeMin: 0, rangeMax: 10, tiers: [{ id: "low", name: "Lower half", short: "lo", group: null, min: 0, max: 5, order: 0, description: "", color: "#4f7cff", percentile: null, images: [], notes: "" }, { id: "high", name: "Upper half", short: "hi", group: null, min: 5, max: 10, order: 1, description: "", color: "#34d399", percentile: null, images: [], notes: "" }] } });
    expect(scale.status()).toBe(201);
    const scaleId = (await scale.json()).scale.id;
    const b = await rateUpload(page, "portrait-b.jpg", "Bravo", scaleId);
    await expect(page.getByText(/Lower half|Upper half/).first()).toBeVisible();
    expect(b.score).toBeGreaterThan(0);
    await shot(page, "56-rating-custom-scale");

    // rate a saved analysis (existing mode)
    await page.goto("/rater");
    await page.getByRole("tab", { name: "Rate a saved analysis" }).click();
    await expect(page.getByTestId("rater-analysis")).toBeVisible();
    for (const box of await page.locator('input[type="checkbox"]').all()) await box.check();
    await page.getByTestId("rate-button").click();
    await page.waitForURL(/\/rater\/rate_/);
    // history and profile pages list ratings
    await page.goto("/history");
    await expect(page.getByTestId("ratings-history").locator("li")).toHaveCount(4);
    await shot(page, "57-history-ratings");
    // copy report text is the mandatory format
    await page.goto(`/rater/${a.id}`);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByTestId("rating-copy").click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/PSL Score – Front Profile: \d\.\d( ± \d\.\d+)? \/ 10/);
    expect(text).toContain("The rating is based solely on the frontal view of the face.");
    expect(text).toMatch(/Tier: /);
    expect(text).toContain("Reasoning:");
    expect(text).toContain("Strengths:");
    expect(text).toContain("Lower-rated criteria:");
    expect(text).toContain("Overall assessment:");
    expect(text).toContain("Analysis quality:");
    expect(text).toContain("Disclaimer:");
    // leaderboards over the newest rating per profile
    await page.goto("/leaderboards");
    await expect(page.getByTestId("leaderboards")).toBeVisible();
    await expect(page.getByTestId("leaderboards").locator("ol").first()).toBeVisible();
    await shot(page, "58-leaderboards");
  });

  test("rater: front profile only — no side-view upload or route, no profile criteria; vision model needs setup and consent", async ({ page }) => {
    test.setTimeout(420_000);
    await signIn(page);
    await page.goto("/rater");
    await expect(page.getByTestId("rater-vision")).toHaveAttribute("data-configured", "false");
    await expect(page.getByTestId("rater-vision")).toContainText(/No vision model set up/);
    await expect(page.getByTestId("rater-side-input")).toHaveCount(0);
    await expect(page.locator('a[href*="side-view"]')).toHaveCount(0);
    expect((await page.request.get("/side-view")).status()).toBe(404);
    expect((await page.request.get("/api/side-analyses")).status()).toBe(404);
    const r = await rateUpload(page, "portrait-a.jpg", "Front Only");
    const rec = (await (await page.request.get(`/api/ratings/${r.id}`)).json()).rating;
    expect(rec.sideAnalysisId).toBeNull();
    expect(rec.result.quality.sideUsed).toBe(false);
    const ids = rec.result.criteria.map((c: { id: string }) => c.id);
    for (const id of ["profileConvexity", "nasolabialAngle", "midfaceProjection", "chinProjection", "neckChinDefinition", "gonialAngle", "noseProjection", "mandibularPlane", "nasalAngles", "lowerFaceHarmony"]) expect(ids, id).not.toContain(id);
    for (const c of rec.result.criteria) expect(["frontal", "visual-model", "self-assessment"], c.id).toContain(c.source);
    expect(rec.result.areas.map((x: { id: string; weight: number }) => `${x.id}:${x.weight}`)).toEqual(["eye:20", "harmonySymmetry:20", "midfaceFront:15", "nose:15", "lowerThird:15", "jawline:10", "cheekbonesWidth:5"]);
    const crit = (id: string) => rec.result.criteria.find((c: { id: string }) => c.id === id);
    // measured eyelid criteria, visual-model criteria clearly marked
    expect(crit("scleralShow").assessable).toBe(true);
    expect(crit("upperLidExposure").assessable).toBe(true);
    expect(crit("eyeShape").notAssessableCode).toBe("visualNotConfigured");
    expect(rec.result.coverage).toBeGreaterThan(0.9);
    await expect(page.getByTestId("area-band-eye")).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "56b-rating-front-profile");
    await page.getByTestId("criterion-eyeShape").click();
    await expect(page.getByRole("dialog")).toContainText(/only with a vision model/);
    await page.keyboard.press("Escape");
  });

  test("stored ratings of the old method (rubric 2.x) stay unchanged and are marked, not shown as front-profile scores", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page);
    const r = await rateUpload(page, "portrait-b.jpg", "Legacy Person");
    // simulate a rating stored before 3.0: same record, rubric 2.2.0 and another score
    const db = new Database(join(process.cwd(), process.env.PSL_ARENA_DATA_DIR ?? ".e2e-data", "psl-arena.sqlite"));
    const row = db.prepare("SELECT * FROM psl_ratings WHERE id = ?").get(r.id) as Record<string, unknown>;
    const result = JSON.parse(row.result_json as string);
    const legacyId = `rate_legacy${Date.now()}`;
    const legacy = { ...result, rubricVersion: "2.2.0", score: 4.37, quality: { ...result.quality, sideUsed: true }, aggregation: { ...result.aggregation, p: 0.5 } };
    db.prepare("INSERT INTO psl_ratings (id, user_id, profile_id, analysis_id, side_analysis_id, scale_id, scale_snapshot_json, rubric_version, result_json, psl_score, tier_id, tier_name, coverage, valid, provisional, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, '2.2.0', ?, 4.37, ?, ?, ?, ?, ?, ?)")
      .run(legacyId, row.user_id, row.profile_id, row.analysis_id, row.scale_id, row.scale_snapshot_json, JSON.stringify(legacy), row.tier_id, row.tier_name, row.coverage, row.valid, row.provisional, new Date(Date.now() + 60_000).toISOString());
    db.close();
    await page.goto(`/rater/${legacyId}`);
    await expect(page.getByTestId("rating-score")).toContainText("4.4");
    await expect(page.getByTestId("rating-score-label")).toHaveText("PSL score (old method)");
    await expect(page.getByTestId("rating-legacy-badge")).toContainText("2.2.0");
    await expect(page.getByTestId("rating-legacy-note")).toContainText("not a “PSL Score – Front Profile”");
    await expect(page.getByTestId("front-profile-note")).toHaveCount(0);
    await expect(page.getByTestId("rating-band")).toHaveCount(0);
    await shot(page, "56c-rating-legacy");
    // history marks it, leaderboards leave it out
    await page.goto("/history");
    await expect(page.getByTestId("ratings-history").getByTestId("legacy-method").first()).toBeVisible();
    await page.goto("/leaderboards");
    await expect(page.getByTestId("leaderboards-legacy")).toBeVisible();
    // the stored record itself is untouched
    const stored = (await (await page.request.get(`/api/ratings/${legacyId}`)).json()).rating;
    expect(stored.rubricVersion).toBe("2.2.0");
    expect(stored.result.score).toBe(4.37);
    // clean up so later tests see only front-profile ratings
    expect((await page.request.delete(`/api/ratings/${legacyId}`)).ok()).toBeTruthy();
  });

  test("rater: self-assessment of the visual criteria (labelled, half weight) and photo measures shown but not scored", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page);
    const r = await rateUpload(page, "portrait-a.jpg", "Self Assessed", undefined, async (p) => {
      const card = p.getByTestId("rater-self");
      await expect(card).toContainText("Self-assessment");
      await card.getByRole("switch").click();
      await expect(p.getByTestId("self-value-eyeShape")).toContainText(/leave out/);
      await p.getByTestId("self-eyeShape").fill("7.5");
      await p.getByTestId("self-jawlineDefinition").fill("4");
      await expect(p.getByTestId("self-value-eyeShape")).toContainText("7.5 / 10");
    });
    const rec = (await (await page.request.get(`/api/ratings/${r.id}`)).json()).rating;
    const crit = (id: string) => rec.result.criteria.find((c: { id: string }) => c.id === id);
    expect(crit("eyeShape")).toMatchObject({ assessable: true, source: "self-assessment", score: 7.5 });
    expect(crit("jawlineDefinition").source).toBe("self-assessment");
    expect(crit("lipShape").assessable).toBe(false);
    expect(rec.result.warningCodes).toContain("selfAssessment");
    expect(rec.result.selfAssessment).toEqual({ eyeShape: 7.5, jawlineDefinition: 4 });
    // measured in the browser from the photo: geometry and image contrasts, all present
    const app = Object.fromEntries(rec.result.appearance.map((m: { id: string; value: number | null }) => [m.id, m.value]));
    for (const id of ["EYE_LID_BALANCE", "EYE_LID_APEX", "LIP_BOW", "LIP_FULLNESS", "JAW_EDGE", "MALAR_SHADE"]) expect(typeof app[id], id).toBe("number");
    await expect(page.getByTestId("criterion-eyeShape")).toContainText(/self-assessment/i);
    await expect(page.getByTestId("appearance-lipShape")).toBeVisible();
    await page.getByTestId("criterion-eyeShape").click();
    await expect(page.getByTestId("self-note")).toContainText("7.5 / 10");
    await expect(page.getByTestId("appearance-detail")).toContainText(/not scored/);
    await shot(page, "56c-self-assessment-dialog");
    await page.keyboard.press("Escape");
  });

  test("rater: a photo picked while the saved setup is still being restored is not overwritten by it", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.goto("/rater");
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "portrait-a.jpg"));
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
    await page.getByPlaceholder("e.g. Alex").fill("First Person");
    await page.waitForTimeout(800); // the setup is saved (debounced) for a crash-safe reload
    // reload: the saved photo is restored in the background — pick another photo right away
    await page.reload({ waitUntil: "domcontentloaded" });
    // pick only once the page is interactive (a real user cannot open the file dialog earlier),
    // but while the restore of the saved photo is still running
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    const restoring = await page.getByTestId("slot-a").locator(".animate-spin").count();
    await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "portrait-b.jpg"));
    expect(restoring, "the saved photo should still be loading when the new one is picked").toBeGreaterThan(0);
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
    await page.waitForTimeout(2500); // give a stale restore time to (wrongly) win
    await page.getByPlaceholder("e.g. Alex").fill("Second Person");
    const boxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await boxes.count()); i++) {
      const text = await boxes.nth(i).evaluate((el) => (el.closest("label")?.textContent ?? "").trim());
      if (/right to use|adult/i.test(text) && !(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
    }
    await page.getByTestId("rate-button").click();
    await page.waitForURL(/\/rater\/rate_/, { timeout: 120_000 });
    const rec = (await (await page.request.get(`/api/ratings/${page.url().split("/").pop()}`)).json()).rating;
    expect(rec.profileLabel).toBe("Second Person");
    const ana = (await (await page.request.get(`/api/analyses/${rec.analysisId}`)).json()).analysis;
    // portrait-b is 970 × 2204 (working copy ≤ 1600 px high), portrait-a 910 × 1137
    expect(ana.imageHeight).toBe(1600);
  });

  test("tournaments: ranking tournament with duplicate ratings, category winners, knockout with manual tie decision, reopen/version, mobile", async ({ page, browser }) => {
    test.setTimeout(420_000);
    await signIn(page);
    // two more rated profiles (one of them the mirrored portrait) so that five participants exist
    await rateUpload(page, "portrait-a-mirror.jpg", "Charlie");
    await rateUpload(page, "portrait-b.jpg", "Delta");
    await page.goto("/tournaments");
    await page.getByTestId("tournament-new").click();
    await page.waitForURL(/\/tournaments\/new/);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("tournament-name").fill("E2E Cup");
    for (let i = 0; i < 5; i++) {
      const pick = page.getByTestId("participant-pick");
      const options = await pick.locator("option").count();
      if (options <= 1) break;
      await pick.selectOption({ index: 1 });
      await page.getByTestId("participant-add").click();
    }
    const n = await page.getByTestId("participants").locator("li").count();
    expect(n).toBeGreaterThanOrEqual(5);
    await page.getByTestId("tournament-format").selectOption("ranking");
    await shot(page, "59-tournament-wizard");
    await page.getByTestId("tournament-create").click();
    await page.waitForURL(/\/tournaments\/tour_/);
    const tid = page.url().split("/").pop()!;
    await expect(page.getByTestId("tournament-status")).toHaveText("Draft");
    await page.getByTestId("tournament-start").click();
    await expect(page.getByTestId("tournament-status")).toHaveText("Completed", { timeout: 30_000 });
    await expect(page.getByTestId("tournament-results")).toBeVisible();
    await expect(page.getByTestId("overall-winner").first()).toBeVisible();
    await expect(page.getByTestId("category-cards").locator("[data-testid^=category-]")).toHaveCount(12);
    await expect(page.locator('[data-testid="final-ranking"] tbody tr')).toHaveCount(n);
    await expect(page.getByTestId("tournament-stats")).toBeVisible();
    await shot(page, "60-tournament-results");
    const rec = (await (await page.request.get(`/api/tournaments/${tid}`)).json()).tournament;
    expect(rec.results.categoryRankings.length).toBe(12);
    // "Alpha" and "Alpha again" share the same rating → they tie in every category they win
    // rubric 3.0: no profile category any more
    expect(rec.results.categoryRankings.some((r: { categoryId: string }) => r.categoryId === "profile")).toBe(false);
    const anyTie = rec.results.categoryRankings.some((r: { tied: boolean }) => r.tied);
    expect(anyTie).toBe(true);
    // category winners independent of weights: re-run with other weights gives the same winners
    const dup = await page.request.post(`/api/tournaments/${tid}/actions`, { data: { action: "duplicate" } });
    const copy = (await dup.json()).tournament;
    const cfg = { ...copy.config, categories: copy.config.categories.map((c: { id: string; weight: number }) => ({ ...c, weight: c.id === "eyeArea" ? 100 : 0 })) };
    expect((await page.request.patch(`/api/tournaments/${copy.id}`, { data: { config: cfg } })).ok()).toBeTruthy();
    const started = (await (await page.request.post(`/api/tournaments/${copy.id}/actions`, { data: { action: "start" } })).json()).tournament;
    const nameOf = (tr: { participants: { id: string; displayName: string }[] }, id: string) => tr.participants.find((p) => p.id === id)!.displayName;
    expect(started.results.categoryRankings.map((r: { winners: string[] }) => r.winners.map((w) => nameOf(started, w)).sort())).toEqual(rec.results.categoryRankings.map((r: { winners: string[] }) => r.winners.map((w) => nameOf(rec, w)).sort()));
    // locked: editing a completed tournament is refused
    expect((await page.request.patch(`/api/tournaments/${tid}`, { data: { name: "x" } })).status()).toBe(409);
    // reopen → new version, archived copy
    await page.getByTestId("tournament-reopen").click();
    await expect(page.getByTestId("tournament-status")).toHaveText("Draft");
    const versions = (await (await page.request.get(`/api/tournaments/${tid}/versions`)).json()).versions;
    expect(versions.length).toBe(1);
    // knockout with manual tie decisions
    const koCfg = { ...rec.config, format: "knockout", seeding: "manual" };
    expect((await page.request.patch(`/api/tournaments/${tid}`, { data: { config: koCfg } })).ok()).toBeTruthy();
    await page.reload();
    await page.getByTestId("tournament-start").click();
    await expect(page.getByTestId("tournament-status")).toHaveText("Running");
    await expect(page.getByTestId("bracket")).toBeVisible();
    await shot(page, "61-tournament-bracket");
    let guard = 0;
    while ((await page.getByTestId("tournament-status").textContent()) !== "Completed" && guard++ < 10) {
      if (await page.getByTestId("tournament-blocked").isVisible()) {
        await page.locator('[data-testid^="decide-"][data-testid$="-a"]').first().click();
        await page.waitForTimeout(300);
      } else {
        await page.getByTestId("tournament-advance").click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.getByTestId("tournament-status")).toHaveText("Completed");
    await expect(page.getByTestId("tournament-results")).toBeVisible();
    await shot(page, "62-tournament-knockout-results");
    const ko = (await (await page.request.get(`/api/tournaments/${tid}`)).json()).tournament;
    expect(ko.results.knockoutChampionId).toBeTruthy();
    expect(ko.state.bracket.byes).toBe(8 - n);
    // duels tab shows a symmetric comparison
    await page.getByRole("tab", { name: "Duels" }).click();
    await expect(page.getByTestId("duel-table")).toBeVisible();
    await shot(page, "63-tournament-duel");
    // mobile layout: bottom nav "More" sheet and the bracket scroll
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const m = await ctx.newPage();
    await m.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
    await m.goto(`/tournaments/${tid}`);
    await m.getByRole("tab", { name: "Bracket" }).click();
    await expect(m.getByTestId("bracket")).toBeVisible();
    await shot(m, "64-mobile-bracket");
    await m.getByTestId("nav-more").click();
    await expect(m.getByRole("dialog")).toBeVisible();
    await shot(m, "65-mobile-more");
    await ctx.close();
  });
});
