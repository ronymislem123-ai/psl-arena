import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { totpCode } from "../../src/server/totp";

const FIX = join(__dirname, "fixtures");
const SHOTS = process.env.PSL_SCREENSHOT_DIR ?? join(__dirname, "..", "..", "test-results", "screens");
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });
}

const ACCOUNT = { email: `e2e-${Date.now()}@example.com`, password: "e2e strong password 42", name: "E2E Tester" };

async function signIn(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

test.describe("PSL ARENA end-to-end", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/auth/signup", { data: ACCOUNT });
    expect([201, 409]).toContain(res.status());
  });

  test("unauthenticated access is blocked", async ({ page, request }) => {
    const api = await request.get("/api/analyses");
    expect(api.status()).toBe(401);
    const img = await request.get("/api/images/img_doesnotexist");
    expect(img.status()).toBe(401);
    await page.goto("/history");
    await expect(page).toHaveURL(/\/login\?next=%2Fhistory/);
    await expect(page.getByTestId("auth-login")).toBeVisible();
    await shot(page, "00-login");
  });

  test("sign-up form creates an account and signs in", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    const email = `e2e-ui-${Date.now()}@example.com`;
    await page.getByLabel(/E-mail/).fill(email);
    await page.getByLabel(/Display name/).fill("UI Tester");
    await page.getByLabel(/^Password/).fill("ui strong password 42");
    await page.getByLabel(/Repeat password/).fill("ui strong password 42");
    await page.getByRole("button", { name: "Create account" }).click();
    // recovery codes are shown once after sign-up
    await expect(page.getByTestId("recovery-codes")).toBeVisible();
    const codeTexts = await page.getByTestId("recovery-code-list").locator("li").allTextContents();
    expect(codeTexts).toHaveLength(8);
    expect(codeTexts[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    await shot(page, "27-recovery-codes");
    await page.getByTestId("codes-continue").click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByText("UI Tester").first()).toBeVisible();
    // this fresh account sees nothing of the other account
    const mine = await (await page.request.get("/api/analyses")).json();
    expect(mine.analyses).toHaveLength(0);
    await page.getByTestId("logout").click();
    await page.waitForURL(/\/login/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);

    // forgot password → reset with a recovery code
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.waitForURL(/\/reset/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/E-mail/).fill(email);
    await page.getByLabel(/Recovery code/).fill(codeTexts[0]);
    await page.getByLabel(/New password/).fill("ui reset password 42");
    await page.getByLabel(/Repeat password/).fill("ui reset password 42");
    await shot(page, "28-reset-form");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("status")).toContainText("7 recovery code");
    await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });
    // old password rejected, new one accepted, used code rejected
    expect((await page.request.post("/api/auth/login", { data: { email, password: "ui strong password 42" } })).status()).toBe(401);
    expect((await page.request.post("/api/auth/login", { data: { email, password: "ui reset password 42" } })).ok()).toBeTruthy();
    expect((await page.request.post("/api/auth/recovery/reset", { data: { email, code: codeTexts[0], newPassword: "ui reset password 43" } })).status()).toBe(401);
    // settings: regenerate codes with the password
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/7 of 8 recovery codes unused/)).toBeVisible();
    const regenForm = page.getByTestId("regenerate-codes").locator("xpath=ancestor::form");
    await regenForm.getByLabel(/^Password/).fill("ui reset password 42");
    await page.getByTestId("regenerate-codes").click();
    await expect(page.getByTestId("recovery-code-list").locator("li")).toHaveCount(8);
    await expect(page.getByText(/8 of 8 recovery codes unused/)).toBeVisible();
    const freshCodes = await page.getByTestId("recovery-code-list").locator("li").allTextContents();
    await shot(page, "29-settings-recovery");

    // two-factor: enable with the manual key, sign out, sign in with password + code, disable again
    const twoFactor = page.getByTestId("two-factor-card");
    await expect(page.getByTestId("two-factor-state")).toHaveText("OFF");
    await twoFactor.getByLabel(/^Password/).fill("ui reset password 42");
    await page.getByTestId("totp-start").click();
    await expect(page.getByTestId("totp-setup")).toBeVisible();
    await expect(twoFactor.locator('img[alt="QR"]')).toBeVisible();
    const secret = (await page.getByTestId("totp-secret").textContent())!.replace(/\s+/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await shot(page, "30-totp-setup");
    await page.getByTestId("totp-code").fill(totpCode(secret));
    await page.getByTestId("totp-enable").click();
    await expect(page.getByTestId("two-factor-state")).toHaveText("ON");
    await expect(page.getByText("Two-factor authentication is now active.")).toBeVisible();
    await page.getByTestId("logout").click();
    await page.waitForURL(/\/login/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/E-mail/).fill(email);
    await page.getByLabel(/^Password/).fill("ui reset password 42");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("auth-mfa")).toBeVisible();
    expect((await page.request.get("/api/auth/me")).status()).toBe(401); // no session before the second factor
    await shot(page, "31-mfa-step");
    await page.getByLabel(/Authenticator code/).fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByTestId("auth-mfa").getByRole("alert")).toContainText("not valid");
    await page.getByLabel(/Authenticator code/).fill(totpCode(secret, Date.now() + 30_000)); // next step: never used before
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);
    // disable with password + a recovery code (the current and next TOTP steps were just consumed;
    // the unit tests cover disabling with an authenticator code)
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("two-factor-state")).toHaveText("ON");
    const card = page.getByTestId("two-factor-card");
    await card.getByLabel(/^Password/).fill("ui reset password 42");
    await card.getByLabel(/Authenticator code/).fill("000000");
    await page.getByTestId("totp-disable").click();
    await expect(card.getByRole("alert")).toContainText("not valid");
    await card.getByLabel(/Authenticator code/).fill(freshCodes[0]);
    await page.getByTestId("totp-disable").click();
    await expect(page.getByTestId("two-factor-state")).toHaveText("OFF");
    await expect(page.getByText(/7 of 8 recovery codes unused/)).toBeVisible();
  });

  test("dashboard renders", async ({ page }) => {
    await signIn(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PSL ARENA");
    await shot(page, "01-dashboard");
  });

  test("full battle flow: upload → quality check → hairline → battle → analysis", async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signIn(page);
    await page.goto("/battle/new");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("New Battle");
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 }); // hydrated

    const inputs = page.locator('input[type="file"]');
    await inputs.nth(0).setInputFiles(join(FIX, "portrait-a.jpg"));
    // wait until slot A is processed (preview score visible)
    await expect(page.getByText("Preview score").first()).toBeVisible({ timeout: 120_000 });
    await inputs.nth(1).setInputFiles(join(FIX, "portrait-b.jpg"));
    await expect(page.getByText("Preview score").nth(1)).toBeVisible({ timeout: 120_000 });

    // labels
    const labels = page.getByPlaceholder("e.g. Alex");
    await labels.nth(0).fill("Alpha");
    await labels.nth(1).fill("Bravo");

    // quality: both frontal portraits must be analyzable (smile warnings expected)
    await expect(page.getByText(/Ready|Good|Acceptable/).first()).toBeVisible();
    await shot(page, "02-upload-review");

    // confirm hairlines (if the estimate exists)
    const confirmButtons = page.getByRole("button", { name: "Confirm hairline" });
    const n = await confirmButtons.count();
    for (let i = 0; i < n; i++) {
      const b = confirmButtons.nth(i);
      if (await b.isEnabled()) await b.click();
    }

    // opt in to encrypted photo storage (exercises the image store + /api/images)
    await page.getByRole("switch").nth(1).click();

    // consent
    const boxes = page.locator('input[type="checkbox"]');
    const cnt = await boxes.count();
    for (let i = 0; i < cnt; i++) {
      const box = boxes.nth(i);
      const label = await box.evaluate((el) => (el.closest("label")?.textContent ?? "").trim());
      if (/right to use|adults/i.test(label) && !(await box.isChecked())) await box.check();
    }

    const start = page.getByTestId("start-battle");
    await expect(start).toBeEnabled({ timeout: 30_000 });
    await start.click();
    await page.waitForURL(/\/battle\/btl_/, { timeout: 120_000 });
    await expect(page.getByText("Arena").first()).toBeVisible();
    await expect(page.locator('img[src^="/api/images/"]').first()).toBeVisible({ timeout: 20_000 });
    await shot(page, "03-arena-intro");
    await page.waitForTimeout(5000);
    await shot(page, "04-arena-round");
    await page.getByRole("button", { name: /Show summary/ }).click();
    await expect(page.getByText(/Final result/).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2500);
    await shot(page, "05-arena-reveal");

    // summary tab
    await page.getByRole("tab", { name: "Summary" }).click();
    await expect(page.getByText("Rounds").first()).toBeVisible();
    const roundRows = page.locator("table tbody tr");
    await expect(roundRows).toHaveCount(9);
    await shot(page, "06-battle-summary");

    // comparison tab: 42 ratio rows
    await page.getByRole("tab", { name: "Comparison" }).click();
    await expect(page.locator("table").nth(0)).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(42);
    await shot(page, "07-battle-compare");

    // analysis center of person 1 (links live on the summary tab)
    await page.getByRole("tab", { name: "Summary" }).click();
    await page.getByRole("link", { name: /View analysis: Alpha/ }).first().click();
    await page.waitForURL(/\/analysis\/ana_/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Alpha");
    await page.waitForTimeout(1600); // let the score count-up finish
    await shot(page, "08-analysis-overview");
    await page.getByRole("tab", { name: "42 Core Ratios" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(42);
    await page.locator("table tbody tr").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "09-ratio-detail");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Landmarks" }).click();
    await expect(page.locator("svg circle").first()).toBeVisible();
    await shot(page, "10-landmarks");
    await page.getByRole("tab", { name: "Symmetry" }).click();
    await shot(page, "11-symmetry");
    await page.getByRole("tab", { name: "Quality & confidence" }).click();
    await shot(page, "12-quality");

    // history
    await page.goto("/history");
    await expect(page.getByText(/Alpha/).first()).toBeVisible();
    await shot(page, "13-history");
    await page.goto("/profiles");
    await expect(page.getByText(/Bravo/).first()).toBeVisible();
    await shot(page, "14-profiles");

    expect(errors, `page errors: ${errors.join("\n")}`).toHaveLength(0);
  });

  test("rejects a strongly turned head and keeps the start button disabled", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await page.goto("/battle/new");
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    const inputs = page.locator('input[type="file"]');
    await inputs.nth(0).setInputFiles(join(FIX, "turned-head.jpg"));
    await expect(page.getByText("Preview score").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/head is turned/i).first()).toBeVisible();
    await expect(page.getByText("Unusable").first()).toBeVisible();
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "unusable");
    await shot(page, "15-rejected-turned-head");
    await expect(page.getByTestId("start-battle")).toBeDisabled();
  });

  test("API: reference database, stats and isolation", async ({ request }) => {
    const r = await request.get("/api/ratios");
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.ratios).toHaveLength(42);
    expect(body.additional).toHaveLength(7);
    const login = await request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
    expect(login.ok()).toBeTruthy();
    const s = await request.get("/api/stats");
    expect(s.ok()).toBeTruthy();
    const bad = await request.post("/api/analyses", { data: { nope: true } });
    expect(bad.status()).toBe(400);
    // another account cannot read this account's analyses
    const mine = (await (await request.get("/api/analyses")).json()).analyses as { id: string }[];
    expect(mine.length).toBeGreaterThan(0);
    const other = { email: `e2e-other-${Date.now()}@example.com`, password: "other strong password 42" };
    const ctx = await request.post("/api/auth/signup", { data: other });
    expect(ctx.status()).toBe(201);
    // the request fixture now carries the other account's cookie (last Set-Cookie wins)
    const foreign = await request.get(`/api/analyses/${mine[0].id}`);
    expect(foreign.status()).toBe(404);
    expect((await (await request.get("/api/analyses")).json()).analyses).toHaveLength(0);
  });

  test("mobile layout renders the setup page and the app is installable", async ({ browser, request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBeTruthy();
    const m = await manifest.json();
    expect(m.display).toBe("standalone");
    expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
    for (const icon of m.icons as { src: string }[]) expect((await request.get(icon.src)).ok()).toBeTruthy();
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await signIn(page);
    await page.goto("/battle/new");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("New Battle");
    expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toBe("/manifest.webmanifest");
    expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("viewport-fit=cover");
    expect(await page.locator('input[type="file"]').first().getAttribute("accept")).toBe("image/*");
    await shot(page, "16-mobile-setup");
    await page.goto("/");
    await shot(page, "17-mobile-dashboard");
    await ctx.close();
  });
  test("battle without stored photos keeps images in the session only", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page);
    await page.goto("/battle/new");
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    const inputs = page.locator('input[type="file"]');
    await inputs.nth(0).setInputFiles(join(FIX, "portrait-a.jpg"));
    await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
    await inputs.nth(1).setInputFiles(join(FIX, "portrait-b.jpg"));
    await expect(page.getByTestId("slot-b")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
    const boxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < (await boxes.count()); i++) {
      const box = boxes.nth(i);
      const label = await box.evaluate((el) => (el.closest("label")?.textContent ?? "").trim());
      if (/right to use|adults/i.test(label)) await box.check();
    }
    await page.getByTestId("start-battle").click();
    await page.waitForURL(/\/battle\/btl_/, { timeout: 120_000 });
    // no server-side image, but the arena renders the session copy (data URL)
    await expect(page.locator('img[src^="data:image/jpeg"]').first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('img[src^="/api/images/"]').count()).toBe(0);
    const stats = await (await page.request.get("/api/stats")).json();
    expect(stats.stats.images).toBe(2); // only the two photos from the opt-in flow exist on the server
    await shot(page, "18-session-only-arena");
  });

  test("landmark layers render and the German locale applies", async ({ page }) => {
    await signIn(page);
    await page.goto("/history");
    await page.getByRole("tab", { name: /Analyses/ }).click();
    // the stored-photo analysis ("Alpha") → overlays on the photo
    await page.locator("li", { hasText: "Alpha" }).first().getByRole("link", { name: "Open" }).click();
    await page.waitForURL(/\/analysis\/ana_/);
    await page.getByRole("tab", { name: "Landmarks" }).click();
    const canvas = page.getByTestId("landmark-canvas");
    await expect(canvas.locator("circle").first()).toBeVisible();
    const select = page.locator("select").last();
    for (const [layer, name] of [["nose", "19-layer-nose"], ["symmetry", "20-layer-symmetry"], ["jaw", "21-layer-jaw"], ["thirds", "22-layer-thirds"]] as const) {
      await select.selectOption(layer);
      await expect(canvas.locator("line").first()).toBeAttached();
      await shot(page, name);
    }
    // an analysis without a stored photo still shows the wireframe overlay
    await page.goto("/history");
    await page.getByRole("tab", { name: /Analyses/ }).click();
    await page.locator("li", { hasText: "Person 2" }).first().getByRole("link", { name: "Open" }).click();
    await page.waitForURL(/\/analysis\/ana_/);
    await page.getByRole("tab", { name: "Landmarks" }).click();
    await expect(page.getByTestId("landmark-canvas").locator("circle").first()).toBeAttached();
    await expect(page.getByText(/wireframe/).first()).toBeVisible();
    await shot(page, "24-wireframe-fallback");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle"); // hydrated before interacting
    await page.locator("select").first().selectOption("de");
    await expect(page.getByRole("link", { name: "Verlauf" }).first()).toBeVisible();
    await expect(page.getByText("Einstellungen").first()).toBeVisible();
    await shot(page, "23-settings-de");
    // measurement texts are translated too
    await page.goto("/history");
    await page.getByRole("tab", { name: /Analysen/ }).click();
    await page.locator("li", { hasText: "Alpha" }).first().getByRole("link", { name: "Öffnen" }).click();
    await page.waitForURL(/\/analysis\/ana_/);
    await page.getByRole("tab", { name: "42 Kernverhältnisse" }).click();
    await expect(page.getByText("Augenabstands-Verhältnis").first()).toBeVisible();
    await page.locator("table tbody tr").first().click();
    await expect(page.getByRole("dialog")).toContainText("Abstand der Pupillenmitten");
    await shot(page, "25-ratio-detail-de");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Merkmalsübersicht" }).click();
    await expect(page.getByText("A · Augen & Brauen")).toBeVisible();
    await expect(page.getByText(/innerhalb des T1-Bereichs|außerhalb des T1-Bereichs/).first()).toBeVisible();
    await page.getByRole("tab", { name: "Qualität & Konfidenz" }).click();
    await expect(page.getByText("Gesichtsauflösung").first()).toBeVisible();
    await shot(page, "26-quality-de");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.locator("select").first().selectOption("en");
  });
});
