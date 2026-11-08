// Runs the ideal-example closed loop (render → MediaPipe → engine → correct) in
// headless Chromium with the app's own modules, outside the UI.
// Usage: node scripts/research/ideal-loop.mjs <outDir> [iterations]
// Writes <outDir>/ideal-loop.json (per-iteration residuals and target checks) and
// <outDir>/ideal-render-<k>.png.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const [outDir = "ideal-out", iters = "6"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const entry = `
import { runIdealExample } from "@/lib/ideal-example";
window.runLoop = async (n) => {
  const r = await runIdealExample({ iterations: n, keepImages: true, damping: window.DAMP ?? 0.6 });
  return { iterations: r.iterations, best: r.bestIteration, geometric: r.geometric.checks, redetected: r.redetected?.checks ?? null, overall: r.redetected?.analysis.scores.overall ?? null, images: r.images ?? [] };
};
window.ready = true;
`;
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, loader: "ts" },
  bundle: true,
  format: "esm",
  write: false,
  platform: "browser",
  alias: { "@": join(root, "src") },
  define: { "process.env.NEXT_PUBLIC_BASE_PATH": '""', "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_PSL_STATIC": '""', "process.env": "{}" },
  logLevel: "error",
});
const js = bundle.outputFiles[0].text;
const TYPES = { ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".task": "application/octet-stream" };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (url === "/") return res.writeHead(200, { "Content-Type": "text/html" }).end('<!doctype html><meta charset="utf-8"><script type="module" src="/app.js"></script>');
  if (url === "/app.js") return res.writeHead(200, { "Content-Type": "text/javascript" }).end(js);
  let file = null;
  if (url.startsWith("/mediapipe/wasm/")) file = join(root, "public", "mediapipe", "wasm", url.slice(16));
  else if (url === "/models/face_landmarker.task") file = join(root, "public", "models", "face_landmarker.task");
  if (!file) return res.writeHead(404).end();
  try {
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console", m.text()); });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60_000 });
await page.evaluate((d) => { window.DAMP = d; }, Number(process.env.DAMP ?? 0.6));
const out = await page.evaluate((n) => window.runLoop(n), Number(iters));
out.images.forEach((d, k) => writeFileSync(join(outDir, `ideal-render-${k}.png`), Buffer.from(d.split(",")[1], "base64")));
delete out.images;
writeFileSync(join(outDir, "ideal-loop.json"), JSON.stringify(out, null, 1));
for (const it of out.iterations) console.log(`#${it.iteration} detected=${it.detected} residual mean ${(it.residualMean * 100).toFixed(2)} % max ${(it.residualMax * 100).toFixed(1)} % in range ${it.inRange}/${it.total} misfit ${it.misfit?.toFixed(2)} worst ${(it.worst ?? []).map(([i, d]) => `${i}:${(d * 100).toFixed(1)}`).join(" ")}`);
console.log("best", out.best, "overall", out.overall?.toFixed(1));
await browser.close();
server.close();
