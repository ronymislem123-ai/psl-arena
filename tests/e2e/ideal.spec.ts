import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIX = join(__dirname, "fixtures");
const SHOTS = process.env.PSL_SCREENSHOT_DIR ?? join(__dirname, "..", "..", "test-results", "screens");
mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });
const ACCOUNT = { email: `e2e-ideal-${Date.now()}@example.com`, password: "e2e strong password 42", name: "Ideal Tester" };

test("manual correction, reliability panel and the closed-loop ideal example", async ({ page }) => {
  test.setTimeout(480_000);
  expect([201, 409]).toContain((await page.request.post("/api/auth/signup", { data: ACCOUNT })).status());
  expect((await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } })).ok()).toBeTruthy();

  // --- manual correction in the upload slot
  await page.goto("/rater");
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "portrait-a.jpg"));
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
  await page.getByPlaceholder("e.g. Alex").fill("Ideal");
  const confirm = page.getByRole("button", { name: "Confirm hairline" });
  if (await confirm.isEnabled()) await confirm.click();
  await page.getByTestId("correct-toggle-a").click();
  await page.getByTestId("axis-a").fill("2");
  await expect(page.getByTestId("correct-a")).toContainText("+2.0°");
  await shot(page, "80-correction-panel");
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    const text = await box.evaluate((el) => (el.closest("label")?.textContent ?? "").trim());
    if (/right to use|adult/i.test(text) && !(await box.isChecked())) await box.check();
  }
  await page.getByTestId("rate-button").click();
  await page.waitForURL(/\/rater\/rate_/, { timeout: 120_000 });
  const ratingId = page.url().split("/").pop()!;
  await expect(page.getByTestId("rating-reliability")).toBeVisible();
  await expect(page.getByTestId("rating-descriptive")).toContainText("FWHR");

  // --- analysis page: corrected badge, rubric categories, reliability panel
  const rating = await (await page.request.get(`/api/ratings/${ratingId}`)).json();
  const analysisId = rating.rating?.analysisId;
  expect(analysisId).toBeTruthy();
  await page.goto(`/analysis/${analysisId}`);
  await expect(page.getByTestId("corrected-badge")).toContainText("+2.0°");
  await expect(page.getByTestId("rubric-categories")).toBeVisible();
  await page.getByRole("tab", { name: "Quality" }).click();
  await expect(page.getByTestId("reliability-level")).toBeVisible();
  await expect(page.locator('[data-testid="measure-quality-table"] tbody tr').first()).toBeVisible();
  await shot(page, "81-reliability");

  // --- ideal example: render → MediaPipe → measure → correct
  await page.goto(`/analysis/${analysisId}`);
  await page.getByTestId("ideal-open").click();
  await expect(page.getByTestId("ideal-table")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId("ideal-image")).toBeVisible();
  const loop = await page.getByTestId("ideal-loop").innerText();
  const count = await page.getByTestId("ideal-redetected-count").innerText();
  writeFileSync(join(SHOTS, "ideal-loop.txt"), `${count}\n${loop}\n`);
  const m = count.match(/(\d+)\/(\d+)/)!;
  expect(Number(m[2])).toBeGreaterThan(20);
  expect(Number(m[1])).toBeGreaterThan(0);
  await shot(page, "82-ideal-example");
});
