import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

const ACCOUNT = { email: `e2e-prompt-${Date.now()}@example.com`, password: "e2e strong password 42", name: "Prompt Tester" };
const SHA256 = "5197e2acf46f89623458a819c8121f34690a36a5f657d86fbfe5ee265f2b5af8";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("\"Schlechtes Foto? Kein Problem!\" shows the full original prompt and copies exactly it", async ({ page, request }) => {
  const res = await request.post("/api/auth/signup", { data: ACCOUNT });
  expect([201, 409]).toContain(res.status());
  await page.request.post("/api/auth/login", { data: { email: ACCOUNT.email, password: ACCOUNT.password } });
  for (const [path, w] of [["/rater", 1440], ["/battle/new", 360]] as const) {
    await page.setViewportSize({ width: w, height: w > 400 ? 900 : 780 });
    await page.goto(path);
    await page.getByTestId("reference-prompt-open").first().click();
    const modal = page.getByTestId("reference-prompt-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Universal Facial Reference Optimization");
    const text = page.getByTestId("reference-prompt-text");
    for (const s of ["1. DEINE ROLLE", "6. PROFESSIONELLE BILDQUALITÄTSOPTIMIERUNG", "11. FINALES ZIEL"]) await expect(text).toContainText(s);
    await expect(page.getByTestId("reference-prompt-hint")).toContainText("aktiviere den Modus ‚Intensives Nachdenken‘");
    // the last line is reachable by scrolling inside the dialog
    await text.getByText("meines tatsächlichen Gesichts.").scrollIntoViewIfNeeded();
    await expect(text.getByText("meines tatsächlichen Gesichts.")).toBeInViewport();
    await page.getByTestId("reference-prompt-copy").click();
    await expect(page.getByTestId("reference-prompt-copied")).toHaveText("Prompt erfolgreich kopiert");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(createHash("sha256").update(clip, "utf8").digest("hex")).toBe(SHA256);
    expect(clip).not.toContain("So funktioniert");
    // no horizontal overflow of the modal on phones
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
  }
});
