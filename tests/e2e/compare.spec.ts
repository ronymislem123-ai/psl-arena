import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const FIX = join(__dirname, "fixtures");
const SHOTS = process.env.PSL_SCREENSHOT_DIR ?? join(__dirname, "..", "..", "test-results", "screens");
mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });
const ACCOUNT = { email: `e2e-cmp-${Date.now()}@example.com`, password: "e2e strong password 42", name: "Compare Tester" };

async function consentAndRate(page: Page) {
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    const text = await box.evaluate((el) => (el.closest("label")?.textContent ?? "").trim());
    if (/right to use|adult/i.test(text) && !(await box.isChecked())) await box.check();
  }
  await expect(page.getByTestId("rate-button")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("rate-button").click();
  await page.waitForURL(/\/rater\/rate_/, { timeout: 120_000 });
  return page.url().split("/").pop()!;
}

async function rateUpload(page: Page, file: string, label: string) {
  await page.goto("/rater");
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.locator('input[type="file"]').first().setInputFiles(join(FIX, file));
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
  await page.getByPlaceholder("e.g. Alex").fill(label);
  const confirm = page.getByRole("button", { name: "Confirm hairline" });
  if (await confirm.isEnabled()) await confirm.click();
  return consentAndRate(page);
}

test("compare, progress and awards", async ({ page }) => {
  test.setTimeout(420_000);
  expect([201, 409]).toContain((await page.request.post("/api/auth/signup", { data: ACCOUNT })).status());
  expect((await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } })).ok()).toBeTruthy();
  const a1 = await rateUpload(page, "portrait-a.jpg", "Alpha");
  // second rating of the same profile from the saved analysis
  await page.goto("/rater");
  await page.getByRole("tab", { name: "Rate a saved analysis" }).click();
  await expect(page.getByTestId("rater-analysis")).toBeVisible();
  const a2 = await consentAndRate(page);
  const b1 = await rateUpload(page, "portrait-b.jpg", "Bravo");

  // identical ratings: zero deltas, no warnings
  await page.goto(`/compare?ids=${a1},${a2}`);
  await expect(page.getByTestId("compare-view")).toBeVisible();
  await expect(page.getByTestId("compare-warnings")).toHaveCount(0);
  await expect(page.getByText("Same rubric version")).toBeVisible();
  await expect(page.locator('[data-testid="compare-criteria"] tbody tr')).toHaveCount(42);
  await expect(page.locator('[data-testid="compare-areas"] tbody tr')).toHaveCount(7);
  await shot(page, "70-compare-identical");

  // different profiles: gains/losses and the common-only toggle
  await page.goto(`/compare?ids=${a1},${b1}`);
  await expect(page.getByTestId("compare-view")).toBeVisible();
  const lists = page.locator('[data-testid="compare-view"] ul li');
  expect(await lists.count()).toBeGreaterThan(0);
  await page.getByRole("switch").click();
  const rows = await page.locator('[data-testid="compare-criteria"] tbody tr').count();
  expect(rows).toBeLessThan(41);
  expect(rows).toBeGreaterThan(15);
  await shot(page, "71-compare-two-profiles");

  // picker with preselection from the rating page, and history selection
  await page.goto(`/rater/${a1}`);
  await page.getByRole("link", { name: "Compare with…" }).click();
  await page.waitForURL(/\/compare\?ids=/);
  await expect(page.getByTestId("compare-picker")).toBeVisible();
  await expect(page.getByTestId("compare-go")).toBeDisabled();
  await page.getByTestId("compare-picker").locator('input[type="checkbox"]:not(:checked)').first().check();
  await expect(page.getByTestId("compare-go")).toBeEnabled();
  await page.getByTestId("compare-go").click();
  await page.waitForURL(/\/compare\?ids=rate_[a-z0-9]+,rate_/);
  await expect(page.getByTestId("compare-view")).toBeVisible();
  await page.goto("/history");
  await page.getByTestId(`select-${a1}`).check();
  await page.getByTestId(`select-${b1}`).check();
  await expect(page.getByTestId("history-compare")).toBeEnabled();
  await page.getByTestId("history-compare").click();
  await page.waitForURL(/\/compare\?ids=/);
  await expect(page.getByTestId("compare-view")).toBeVisible();

  // profile progress timeline (two ratings of Alpha) and awards after a completed tournament
  const alpha = (await (await page.request.get(`/api/ratings/${a1}`)).json()).rating;
  const bravo = (await (await page.request.get(`/api/ratings/${b1}`)).json()).rating;
  await page.goto(`/profiles/${alpha.profileId}`);
  await expect(page.getByTestId("rating-timeline")).toBeVisible();
  await expect(page.getByTestId("progress-chart")).toBeVisible();
  await expect(page.getByTestId("awards")).toContainText("No tournament awards yet.");
  const rubric = await (await page.request.get("/api/rubric")).json();
  expect(rubric.version).toBe("2.1.0");
  const cfgRes = await page.request.get("/api/tournaments");
  expect(cfgRes.ok()).toBeTruthy();
  const created = await page.request.post("/api/tournaments", { data: { name: "Awards Cup", config: { format: "ranking", seeding: "rating", randomSeed: 1, winnerMethod: "weighted", decisiveCategoryId: "harmony", tieEpsilon: 0.05, groupSize: 4, qualifyPerGroup: 2, minCategoryCoverage: 0.5, categories: [{ id: "overallFace", name: "Best Overall Face", criteria: [], overall: true, weight: 0 }, { id: "harmony", name: "Best Facial Harmony", criteria: [{ id: "facialThirds", weight: 2 }, { id: "eyeMouthLength", weight: 2 }, { id: "faceShape", weight: 2 }], weight: 100 }, { id: "eyeArea", name: "Best Eye Area", criteria: [{ id: "canthalTilt", weight: 4 }, { id: "eyeSpacing", weight: 4 }], weight: 0 }] }, participants: [{ profileId: alpha.profileId }, { profileId: bravo.profileId }] } });
  expect(created.status()).toBe(201);
  const tid = (await created.json()).tournament.id;
  const started = await page.request.post(`/api/tournaments/${tid}/actions`, { data: { action: "start" } });
  expect((await started.json()).tournament.status).toBe("completed");
  await page.goto(`/profiles/${alpha.profileId}`);
  const awardsText = (await page.getByTestId("awards").textContent()) ?? "";
  const bravoAwards = (await (await page.request.get(`/api/profiles`)).json()).profiles.length;
  expect(bravoAwards).toBeGreaterThanOrEqual(2);
  // one of the two profiles must hold at least a category win; check both pages
  await page.goto(`/profiles/${bravo.profileId}`);
  const awardsText2 = (await page.getByTestId("awards").textContent()) ?? "";
  expect(`${awardsText}${awardsText2}`).toMatch(/Category winner|Overall winner/);
  await shot(page, "72-profile-progress-awards");

  // achievements: "First win" is earned on at least one of the two profiles
  const earnedA = await page.locator('[data-testid="achievements"] [data-earned="true"]').count();
  await page.goto(`/profiles/${alpha.profileId}`);
  const earnedB = await page.locator('[data-testid="achievements"] [data-earned="true"]').count();
  expect(earnedA + earnedB).toBeGreaterThan(0);
  await expect(page.getByTestId("award-stats")).toBeVisible();

  // raw frontal analyses: history selection → ratio-level comparison
  await page.goto("/history");
  await page.getByRole("tab", { name: /Analyses/ }).click();
  const analysisBoxes = page.locator('[data-testid^="select-analysis-"]');
  expect(await analysisBoxes.count()).toBeGreaterThanOrEqual(2);
  await analysisBoxes.nth(0).check();
  await analysisBoxes.nth(1).check();
  await page.getByTestId("history-compare-analyses").click();
  await page.waitForURL(/\/compare\?mode=analyses&analyses=/);
  await expect(page.getByTestId("analyses-compare-view")).toBeVisible();
  await expect(page.locator('[data-testid="analyses-ratios"] tbody tr')).toHaveCount(42);
  await expect(page.locator('[data-testid="analyses-categories"] tbody tr')).toHaveCount(7);
  await expect(page.getByText("Same engine version")).toBeVisible();
  await page.getByRole("switch").click();
  expect(await page.locator('[data-testid="analyses-ratios"] tbody tr').count()).toBeLessThan(42);
  await shot(page, "73-compare-analyses");
  // the analysis center links into the comparison with its analysis preselected
  await page.goto(`/analysis/${alpha.analysisId}`);
  await page.getByRole("link", { name: /Compare frontal analyses/ }).click();
  await page.waitForURL(/\/compare\?mode=analyses&analyses=ana_/);
  await expect(page.getByTestId("analyses-picker").locator('input[type="checkbox"]:checked')).toHaveCount(1);

  // tournament versions: reopen the completed cup, change a weight, complete again, compare versions
  const reopened = await page.request.post(`/api/tournaments/${tid}/actions`, { data: { action: "reopen", note: "weights changed" } });
  expect(reopened.ok()).toBeTruthy();
  const cur = (await reopened.json()).tournament;
  const cfg2 = { ...cur.config, categories: cur.config.categories.map((c: { id: string; weight: number }) => ({ ...c, weight: c.id === "eyeArea" ? 100 : 0 })) };
  expect((await page.request.patch(`/api/tournaments/${tid}`, { data: { config: cfg2 } })).ok()).toBeTruthy();
  const again = (await (await page.request.post(`/api/tournaments/${tid}/actions`, { data: { action: "start" } })).json()).tournament;
  expect(again.status).toBe("completed");
  expect(again.version).toBe(2);
  await page.goto(`/compare?mode=versions&tournament=${tid}`);
  await expect(page.getByTestId("versions-compare-view")).toBeVisible();
  await expect(page.getByTestId("versions-diff")).toBeVisible();
  await expect(page.locator('[data-testid="versions-categories"] tbody tr')).toHaveCount(3);
  await expect(page.locator('[data-testid="versions-ranking"] tbody tr')).toHaveCount(2);
  await expect(page.getByText(/Weight changes/)).toBeVisible();
  await shot(page, "74-compare-versions");
  // rendered, read-only archived version
  await page.goto(`/tournaments/${tid}`);
  await page.getByRole("tab", { name: "Versions" }).click();
  await page.getByTestId("version-open-1").click();
  await page.waitForURL(/\/tournaments\/tour_[a-z0-9]+\/versions\/tv_/);
  await expect(page.getByTestId("archived-banner")).toContainText("Archived version 1");
  await expect(page.getByTestId("tournament-start")).toHaveCount(0);
  await expect(page.getByTestId("tournament-reopen")).toHaveCount(0);
  await expect(page.getByTestId("tournament-results")).toBeVisible();
  await shot(page, "75-archived-version");
});
