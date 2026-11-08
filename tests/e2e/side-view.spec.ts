import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const FIX = join(__dirname, "fixtures");
const SHOTS = process.env.PSL_SCREENSHOT_DIR ?? join(__dirname, "..", "..", "test-results", "screens");
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });
}

const ACCOUNT = { email: `e2e-side-${Date.now()}@example.com`, password: "e2e strong password 42", name: "Side Tester" };

/** Landmarks of tests/e2e/fixtures/profile-synthetic.jpg (800 × 1000, facing right), in placement order. */
const POINTS: [string, number, number][] = [
  ["glabella", 500, 300], ["nasion", 490, 360], ["rhinion", 520, 410], ["pronasale", 560, 470], ["subnasale", 516, 500], ["alar_crease", 500, 480],
  ["labrale_sup", 522, 540], ["stomion", 510, 565], ["labrale_inf", 518, 585], ["labiomental", 500, 615], ["pogonion", 514, 660], ["menton", 490, 700],
  ["cervical", 430, 730], ["neck", 430, 800], ["gonion", 380, 640], ["tragion", 330, 420],
];

/** Clicks an image coordinate of the 800 × 1000 fixture; the locator click scrolls the canvas into view. */
async function clickImagePoint(page: Page, x: number, y: number) {
  const canvas = page.getByTestId("side-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: (x / 800) * box.width, y: (y / 1000) * box.height } });
}

test.describe("Side view (profile) module", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/auth/signup", { data: ACCOUNT });
    expect([201, 409]).toContain(res.status());
  });

  test("guided placement → preview → save → result → history", async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const login = await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
    expect(login.ok()).toBeTruthy();

    await page.goto("/side-view/new");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("New Side-View Analysis");
    await expect(page.getByTestId("side-upload")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await shot(page, "40-side-empty");
    await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "profile-synthetic.jpg"));
    await expect(page.getByTestId("side-canvas")).toBeVisible({ timeout: 30_000 });
    // version 2.0: the automatic detection runs first; this test then exercises the manual path
    await expect(page.getByTestId("side-auto")).toHaveAttribute("data-state", /^(ok|failed)$/, { timeout: 180_000 });
    if (await page.getByTestId("side-reset").isEnabled()) await page.getByTestId("side-reset").click();
    await expect(page.getByTestId("side-placed")).toContainText("0 of 16");
    await expect(page.getByTestId("side-current")).toHaveAttribute("data-landmark", "glabella");

    // the loupe follows the pointer
    const box = (await page.getByTestId("side-canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.3);
    await expect(page.getByTestId("side-loupe")).toBeVisible();
    await shot(page, "41-side-loupe");

    // place the 16 points in guided order; the current landmark advances each time
    for (let i = 0; i < POINTS.length; i++) {
      const [id, x, y] = POINTS[i];
      await expect(page.getByTestId("side-current")).toHaveAttribute("data-landmark", id);
      await clickImagePoint(page, x, y);
      await expect(page.getByTestId(`side-step-${id}`)).toHaveAttribute("data-done", "true");
      await expect(page.getByTestId("side-placed")).toContainText(`${i + 1} of 16`);
    }
    await expect(page.getByTestId("side-current")).toHaveAttribute("data-landmark", "");
    await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "analyzable");
    await expect(page.getByText("Facing: right")).toBeVisible();
    await shot(page, "42-side-placed");

    // undo removes the last point and re-opens the step; the tragion is optional (version 2.0), so the preview stays
    await page.getByTestId("side-undo").click();
    await expect(page.getByTestId("side-placed")).toContainText("15 of 16");
    await expect(page.getByTestId("side-current")).toHaveAttribute("data-landmark", "tragion");
    await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "analyzable");
    await clickImagePoint(page, 330, 420);
    await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "analyzable");

    // a wrong placement is rejected: move the subnasale above the nose tip via the step list
    await page.getByTestId("side-step-subnasale").click();
    await clickImagePoint(page, 516, 350);
    await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "unusable");
    await expect(page.getByText(/top-to-bottom order/)).toBeVisible();
    await shot(page, "43-side-unusable");
    await page.getByTestId("side-step-subnasale").click();
    await clickImagePoint(page, 516, 500);
    await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "analyzable");

    // profile label, photo storage, consent → save
    await page.getByTestId("side-label").fill("Profile Pat");
    await page.getByRole("switch").click(); // store the photo (encrypted)
    const boxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
    await expect(page.getByTestId("side-save")).toBeEnabled();
    await page.getByTestId("side-save").click();
    await page.waitForURL(/\/side-view\/side_/, { timeout: 60_000 });

    // result page
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Profile Pat");
    await expect(page.getByText("Facing: right")).toBeVisible();
    await expect(page.getByText("16 scored · 3 descriptive")).toBeVisible();
    await expect(page.locator('image[href^="/api/images/"]').first()).toBeAttached();
    const rows = page.locator('[data-testid="side-table"] tbody tr');
    await expect(rows).toHaveCount(19);
    await expect(page.getByTestId("side-row-LFH")).toContainText("50.0 %");
    await expect(page.getByTestId("side-row-CMA")).toContainText("116.6°");
    await expect(page.getByTestId("side-row-GA")).toContainText("Guide range");
    await expect(page.getByTestId("side-row-MLA")).toContainText("not scored");
    await page.waitForTimeout(1500); // score count-up
    await shot(page, "44-side-result");
    await page.getByTestId("side-layer").selectOption("CMA");
    await expect(page.getByTestId("side-canvas").locator("path").first()).toBeAttached(); // angle arc
    await shot(page, "45-side-layer-cma");
    await page.getByTestId("side-row-GOODE").click();
    await expect(page.getByRole("dialog")).toContainText("Goode");
    await expect(page.getByRole("dialog")).toContainText("Literature norm");
    await shot(page, "46-side-detail");
    await page.keyboard.press("Escape");

    // history tab and profile page list the side view; API returns it and isolates accounts
    await page.goto("/history");
    await page.getByRole("tab", { name: /Side views/ }).click();
    await expect(page.getByTestId("side-history")).toContainText("Profile Pat");
    await shot(page, "47-side-history");
    const list = await (await page.request.get("/api/side-analyses")).json();
    expect(list.sideAnalyses.length).toBeGreaterThanOrEqual(1);
    expect(list.sideAnalyses[0].scoredCount).toBe(16);
    const profile = await (await page.request.get(`/api/profiles`)).json();
    expect(profile.profiles.find((p: { label: string }) => p.label === "Profile Pat").sideAnalysisCount).toBe(1);
    await page.goto(`/profiles/${list.sideAnalyses[0].profileId}`);
    await expect(page.getByText("Side views")).toBeVisible();
    await expect(page.getByText("Latest profile index")).toBeVisible();

    // German locale
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.locator("select").first().selectOption("de");
    await expect(page.getByRole("link", { name: "Seitenansicht" }).first()).toBeVisible();
    await page.goto(`/side-view/${list.sideAnalyses[0].id}`);
    await expect(page.getByTestId("side-row-CMA")).toContainText("Zervikomentaler Winkel");
    await expect(page.getByText("Literaturnorm").first()).toBeVisible();
    await shot(page, "48-side-result-de");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.locator("select").first().selectOption("en");

    expect(errors, `page errors: ${errors.join("\n")}`).toHaveLength(0);
  });

  test("API validation: unusable placement is rejected and foreign records are hidden", async ({ request }) => {
    const login = await request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
    expect(login.ok()).toBeTruthy();
    const points = Object.fromEntries(POINTS.map(([id, x, y]) => [id, { x, y }]));
    const bad = await request.post("/api/side-analyses", { data: { consent: { rightsConfirmed: true, adultsConfirmed: true }, storeImage: false, imageWidth: 800, imageHeight: 1000, points: { ...points, subnasale: { x: 516, y: 350 } } } });
    expect(bad.status()).toBe(422);
    const noConsent = await request.post("/api/side-analyses", { data: { consent: { rightsConfirmed: false, adultsConfirmed: true }, storeImage: false, imageWidth: 800, imageHeight: 1000, points } });
    expect(noConsent.status()).toBe(400);
    const good = await request.post("/api/side-analyses", { data: { profileLabel: "API Pat", consent: { rightsConfirmed: true, adultsConfirmed: true }, storeImage: false, imageWidth: 800, imageHeight: 1000, points } });
    expect(good.status()).toBe(201);
    expect((await good.json()).sideAnalysis.scoredCount).toBe(16);
    const mine = (await (await request.get("/api/side-analyses")).json()).sideAnalyses as { id: string }[];
    expect(mine.length).toBeGreaterThan(0);
    const other = await request.post("/api/auth/signup", { data: { email: `e2e-side-other-${Date.now()}@example.com`, password: "other strong password 42" } });
    expect(other.status()).toBe(201);
    expect((await request.get(`/api/side-analyses/${mine[0].id}`)).status()).toBe(404);
  });
  test("automatic side view: upload only → landmarks detected → save without manual points → not-determinable measures marked", async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const login = await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
    expect(login.ok()).toBeTruthy();
    await page.goto("/side-view/new");
    await expect(page.getByTestId("side-upload")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "profile-scan.jpg"));
    await expect(page.getByTestId("side-auto")).toHaveAttribute("data-state", "ok", { timeout: 180_000 });
    await expect(page.getByTestId("side-auto-count")).toContainText(/1[0-6] of 16 points detected automatically/);
    for (const id of ["glabella", "nasion", "pronasale", "subnasale", "labrale_sup", "stomion", "labrale_inf", "labiomental", "pogonion", "menton"]) {
      await expect(page.getByTestId(`side-step-${id}`)).toHaveAttribute("data-done", "true");
    }
    await expect(page.getByTestId("side-src-pronasale")).toContainText(/contour/i);
    await expect(page.getByTestId("side-step-alar_crease")).toHaveAttribute("data-done", "false"); // not on the silhouette: never guessed
    await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "analyzable");
    await shot(page, "49-side-auto");
    await page.getByTestId("side-label").fill("Auto Profile");
    const boxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
    await page.getByTestId("side-save").click();
    await page.waitForURL(/\/side-view\/side_/, { timeout: 60_000 });
    await expect(page.getByTestId("side-row-FCA")).toContainText("°");
    await expect(page.getByTestId("side-nd-GOODE")).toContainText("not determinable");
    await expect(page.getByTestId("side-nd-GA")).toContainText("not determinable");
    await expect(page.getByText(/detected automatically from the profile silhouette/)).toBeVisible();
    await shot(page, "50-side-auto-result");
    const list = await (await page.request.get("/api/side-analyses")).json();
    const auto = list.sideAnalyses.find((x: { profileLabel?: string; label?: string }) => (x.profileLabel ?? x.label) === "Auto Profile") ?? list.sideAnalyses[0];
    const full = await (await page.request.get(`/api/side-analyses/${auto.id}`)).json();
    expect(full.sideAnalysis.result.placement).toBe("automatic");
    expect(full.sideAnalysis.result.missingPoints).toContain("alar_crease");
    expect(full.sideAnalysis.points.alar_crease).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test("automatic side view rejects a frontal photo with an explanation", async ({ page }) => {
    test.setTimeout(180_000);
    await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
    await page.goto("/side-view/new");
    await expect(page.getByTestId("side-upload")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "portrait-a-small.jpg"));
    await expect(page.getByTestId("side-auto")).toHaveAttribute("data-state", "failed", { timeout: 180_000 });
    await expect(page.getByTestId("side-auto")).toContainText(/frontal face|nasal tip|not possible/i);
    await expect(page.getByTestId("side-placed")).toContainText("0 of 16");
    await shot(page, "51-side-auto-frontal");
  });
});
