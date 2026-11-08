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
