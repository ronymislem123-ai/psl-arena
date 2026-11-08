import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the browser edition. Expects `out/` built with the same base
 * path (`npm run build:static -- --base /psl-arena`) and serves it like GitHub Pages.
 */
const PORT = process.env.PSL_STATIC_PORT ?? "3300";
const BASE = process.env.PSL_BASE_PATH ?? "/psl-arena";

export default defineConfig({
  testDir: "tests/e2e-static",
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE}/`,
    trace: "off",
    viewport: { width: 1440, height: 900 },
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node scripts/serve-static.mjs --base ${BASE} --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}${BASE}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
