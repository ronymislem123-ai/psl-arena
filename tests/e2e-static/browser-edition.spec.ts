import { devices, expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/** Paths are relative to the base URL (…/psl-arena/), like links on GitHub Pages. */
const FIX = join(__dirname, "..", "e2e", "fixtures");
const SHOTS = process.env.PSL_SCREENSHOT_DIR ?? join(__dirname, "..", "..", "test-results", "screens-static");
mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // MediaPipe reports "INFO: Created TensorFlow Lite XNNPACK delegate" on the error channel.
    if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 404|^INFO: /.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function rateUpload(page: Page, file: string, label: string, storePhoto: boolean) {
  await page.goto("rater/");
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  const store = page.getByRole("switch", { name: /Store photos in history/ });
  if ((await store.getAttribute("aria-checked")) !== String(storePhoto)) await store.click();
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
  await expect(page.getByTestId("rate-button")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("rate-button").click();
  await page.waitForURL(/\/rater\/view\/?\?id=rate_/, { timeout: 120_000 });
  await expect(page.getByTestId("rating-score")).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}

test("browser edition: rating, persistence, history, tournament, compare, backup and restore", async ({ page, context }) => {
  const errors = collectErrors(page);

  await page.goto("./");
  await expect(page.getByTestId("browser-edition-badge")).toBeVisible();
  await expect(page.getByTestId("logout")).toHaveCount(0);
  await expect(page.getByText("nothing is uploaded, and saved data stays on this device")).toBeVisible();
  await shot(page, "s01-dashboard-empty");

  const alpha = await rateUpload(page, "portrait-a.jpg", "Alpha", true);
  // the stored photo comes from the local database as an object URL
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  await shot(page, "s02-rating");
  await page.reload();
  await expect(page.getByTestId("rating-score")).toBeVisible();
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  // ideal example: rendering, MediaPipe re-detection and re-measurement work under the base path
  await page.getByTestId("ideal-open").click();
  await expect(page.getByTestId("ideal-table")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("ideal-redetected-count")).toContainText("/");
  await page.keyboard.press("Escape");

  const bravo = await rateUpload(page, "portrait-b.jpg", "Bravo", false);
  await page.goto("history/");
  await expect(page.getByTestId("ratings-history").locator("li")).toHaveCount(2);

  // record links use query parameters in the static build
  await page.getByTestId(`select-${alpha}`).check();
  await page.getByTestId(`select-${bravo}`).check();
  await page.getByTestId("history-compare").click();
  await page.waitForURL(/\/compare\/?\?ids=/);
  await expect(page.getByTestId("compare-view")).toBeVisible();

  // export link of a rating downloads a file generated in the page
  await page.goto(`rater/view/?id=${alpha}`);
  const [ratingDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export JSON" }).click()]);
  expect(ratingDl.suggestedFilename()).toBe(`psl-rating-${alpha}.json`);

  // tournament from the two rated profiles
  await page.goto("tournaments/");
  await page.getByTestId("tournament-new").click();
  await page.waitForURL(/\/tournaments\/new/);
  await page.getByTestId("tournament-name").fill("Browser Cup");
  for (let i = 0; i < 2; i++) {
    const pick = page.getByTestId("participant-pick");
    if ((await pick.locator("option").count()) <= 1) break;
    await pick.selectOption({ index: 1 });
    await page.getByTestId("participant-add").click();
  }
  await expect(page.getByTestId("participants").locator("li")).toHaveCount(2);
  await page.getByTestId("tournament-format").selectOption("ranking");
  await page.getByTestId("tournament-create").click();
  await page.waitForURL(/\/tournaments\/view\/?\?id=tour_/);
  await page.getByTestId("tournament-start").click();
  await expect(page.getByTestId("tournament-status")).toHaveText("Completed", { timeout: 30_000 });
  await expect(page.getByTestId("overall-winner").first()).toBeVisible();
  await shot(page, "s03-tournament");

  // a second tab sees the same data (shared IndexedDB)
  const other = await context.newPage();
  await other.goto("tournaments/");
  await expect(other.getByText("Browser Cup")).toBeVisible();
  await other.close();

  // backup, delete everything, restore
  await page.goto("settings/");
  await expect(page.getByTestId("browser-data-card")).toBeVisible();
  await expect(page.getByTestId("two-factor-card")).toHaveCount(0);
  await shot(page, "s04-settings");
  const [backup] = await Promise.all([page.waitForEvent("download"), page.getByTestId("backup-download").click()]);
  expect(backup.suggestedFilename()).toMatch(/^psl-arena-backup-\d{4}-\d{2}-\d{2}\.sqlite$/);
  const backupPath = join(SHOTS, "backup.sqlite");
  await backup.saveAs(backupPath);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete all data" }).click();
  await expect(page.getByText("All data deleted.")).toBeVisible();
  await page.goto("history/");
  await expect(page.getByTestId("ratings-history").locator("li")).toHaveCount(0);
  await page.goto("settings/");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("backup-file").setInputFiles(backupPath);
  await expect(page.getByText("Backup restored.")).toBeVisible();
  await page.goto("history/");
  await expect(page.getByTestId("ratings-history").locator("li")).toHaveCount(2);
  await page.goto(`rater/view/?id=${alpha}`);
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();

  // a file that is not a backup is rejected
  await page.goto("settings/");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("backup-file").setInputFiles({ name: "x.sqlite", mimeType: "application/octet-stream", buffer: Buffer.from("definitely not sqlite") });
  await expect(page.getByText("This file is not a PSL ARENA backup.")).toBeVisible();

  // unknown ids and unknown paths
  await page.goto("rater/view/?id=rate_missing");
  await expect(page.getByTestId("local-not-found")).toBeVisible();
  const res = await page.goto("does-not-exist/");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("local-not-found")).toBeVisible();

  expect(errors).toEqual([]);
});

test("browser edition on a phone: navigation, German texts, offline reload", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "de-DE" });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto("settings/");
  await page.getByRole("combobox").first().selectOption("de");
  await expect(page.getByText("Daten in diesem Browser")).toBeVisible();
  await page.goto("./");
  await expect(page.getByText("Nichts wird hochgeladen")).toBeVisible();
  await shot(page, "s05-phone-dashboard");
  // after the service worker took control, pages load without network
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });
  await page.goto("history/");
  await page.goto("./");
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.getByText("Nichts wird hochgeladen")).toBeVisible();
  // pages never visited before are precached too, including record pages with ?id=
  await page.goto("tournaments/");
  await expect(page.getByTestId("tournament-new")).toBeVisible();
  await page.goto("rater/view/?id=rate_offline");
  await expect(page.getByTestId("local-not-found")).toBeVisible();
  await page.getByRole("link", { name: "Zurück zum Dashboard" }).click();
  await expect(page.getByText("Nichts wird hochgeladen")).toBeVisible();
  await ctx.setOffline(false);
  // offline, the browser's own speculative prefetches (which bypass the service worker) fail; navigation itself works
  expect(errors.filter((e) => !e.includes("net::ERR_INTERNET_DISCONNECTED"))).toEqual([]);
  await ctx.close();
});

/**
 * Regression for the battle-page crash reported on 2026-11-08: browsers translated
 * the (English) app into German, rewriting text nodes behind React's back, and the
 * next update threw "Failed to execute 'removeChild' on 'Node'". The page now opens
 * in German for a German browser, is marked as not translatable, and survives a
 * forced translation (simulated here like Chrome's: every text node wrapped in <font>).
 */
test("German browser with page translation: battle setup does not crash", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  await ctx.addInitScript(() => {
    const translate = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        if (n.nodeValue?.trim() && !n.parentElement?.closest("script,style,font")) nodes.push(n);
      }
      for (const n of nodes) {
        const outer = document.createElement("font");
        const inner = document.createElement("font");
        inner.textContent = n.nodeValue;
        outer.appendChild(inner);
        n.parentNode?.replaceChild(outer, n);
      }
    };
    window.addEventListener("load", () =>
      setTimeout(() => {
        translate(document.body);
        new MutationObserver((ms) => {
          for (const m of ms) for (const a of Array.from(m.addedNodes)) translate(a.nodeType === Node.TEXT_NODE ? (a.parentNode ?? a) : a);
        }).observe(document.body, { childList: true, subtree: true });
      }, 1000),
    );
  });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto("battle/new/");
  await expect(page.locator("html")).toHaveAttribute("translate", "no");
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.waitForTimeout(1500); // let the simulated translation run
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles(join(FIX, "portrait-a.jpg"));
  await inputs.nth(1).setInputFiles(join(FIX, "portrait-b.jpg"));
  await expect(page.getByTestId("slot-a")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
  await expect(page.getByTestId("slot-b")).toHaveAttribute("data-state", "analyzable", { timeout: 120_000 });
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await expect(page.getByTestId("page-error")).toHaveCount(0);
  await page.getByTestId("start-battle").click();
  await page.waitForURL(/\/battle\/view\/?\?id=btl_/, { timeout: 120_000 });
  await expect(page.getByTestId("page-error")).toHaveCount(0);
  await shot(page, "s20-translated-battle");
  expect(errors.filter((e) => !/dom-guard/.test(e))).toEqual([]);
  await ctx.close();
});

test("browser edition: automatic side view runs locally; vision model needs the user's own key and consent", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  // only this origin may be contacted (also when run against the deployed site)
  const own = new URL(baseURL!).hostname;
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && ![own, "127.0.0.1", "localhost"].includes(u.hostname)) external.push(u.hostname);
  });
  await page.goto("side-view/new/");
  await expect(page.getByTestId("side-upload")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await page.locator('input[type="file"]').first().setInputFiles(join(FIX, "profile-scan-left.jpg"));
  await expect(page.getByTestId("side-auto")).toHaveAttribute("data-state", "ok", { timeout: 180_000 });
  await expect(page.getByText("Facing: left")).toBeVisible();
  await expect(page.getByTestId("side-preview")).toHaveAttribute("data-state", "analyzable");
  await page.getByTestId("side-label").fill("Static Profile");
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await page.getByTestId("side-save").click();
  await page.waitForURL(/side-view\/view\/\?id=side_/, { timeout: 60_000 });
  await expect(page.getByTestId("side-row-FCA")).toContainText("°");
  await shot(page, "s10-side-auto-result");

  // the vision model is off until the user enters a key (stored only in this browser)
  await page.goto("settings/");
  await expect(page.getByTestId("vision-model-card")).toHaveAttribute("data-configured", "false");
  await page.getByTestId("vision-key").fill("sk-ant-test-key");
  await page.getByTestId("vision-save").click();
  await expect(page.getByTestId("vision-model-card")).toHaveAttribute("data-configured", "true");
  expect(await page.evaluate(() => localStorage.getItem("psl-arena.visionModel"))).toContain("sk-ant-test-key");
  await shot(page, "s11-vision-settings");
  await page.goto("rater/");
  await expect(page.getByTestId("rater-vision")).toHaveAttribute("data-configured", "true");
  await expect(page.getByTestId("rater-vision").locator('input[type="checkbox"]')).not.toBeChecked(); // consent is opt-in
  await page.goto("settings/");
  await page.getByTestId("vision-remove").click();
  await expect(page.getByTestId("vision-model-card")).toHaveAttribute("data-configured", "false");
  // nothing was sent anywhere: all requests stayed on this origin
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
