// Runs the MediaPipe Face Landmarker (same model and runtime as the app) on image
// files in headless Chromium and writes one landmark fixture JSON per image:
//   { name, width, height, mesh: [[x, y, z], …] (pixels), blendshapes, matrix }
// Usage: node scripts/research/detect-images.mjs <outDir> <image> [<image> …]
// Used to build test fixtures and the image-level robustness experiments.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const [outDir, ...images] = process.argv.slice(2);
if (!outDir || !images.length) {
  console.error("usage: node scripts/research/detect-images.mjs <outDir> <image…>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const visionDir = dirname(require.resolve("@mediapipe/tasks-vision"));
const TYPES = { ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".task": "application/octet-stream", ".html": "text/html" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { FilesetResolver, FaceLandmarker } from "/vision/vision_bundle.mjs";
const fileset = await FilesetResolver.forVisionTasks("/wasm");
window.lm = await FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: "/model.task", delegate: "CPU" }, runningMode: "IMAGE", numFaces: 5, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
window.detect = async (dataUrl) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d").drawImage(img, 0, 0);
  const r = window.lm.detect(c);
  const W = c.width, H = c.height;
  return { width: W, height: H, faces: r.faceLandmarks.map((pts, i) => ({
    mesh: pts.map((p) => [p.x * W, p.y * H, p.z * W]),
    blendshapes: Object.fromEntries((r.faceBlendshapes?.[i]?.categories ?? []).map((c) => [c.categoryName, c.score])),
    matrix: r.facialTransformationMatrixes?.[i] ? Array.from(r.facialTransformationMatrixes[i].data) : null,
  })) };
};
window.ready = true;
</script>`;
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = null;
  if (url === "/") return res.end(PAGE);
  if (url.startsWith("/vision/")) file = join(visionDir, url.slice(8));
  else if (url.startsWith("/wasm/")) file = join(root, "public", "mediapipe", "wasm", url.slice(6));
  else if (url === "/model.task") file = join(root, "public", "models", "face_landmarker.task");
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
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
for (const img of images) {
  const ext = extname(img).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${readFileSync(img).toString("base64")}`;
  const r = await page.evaluate((u) => window.detect(u), dataUrl);
  const name = basename(img, ext);
  if (!r.faces.length) {
    console.log(`${name}: no face`);
    continue;
  }
  // largest face first, like the app
  const area = (f) => {
    const xs = f.mesh.map((p) => p[0]);
    const ys = f.mesh.map((p) => p[1]);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  };
  const face = r.faces.sort((a, b) => area(b) - area(a))[0];
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ name, width: r.width, height: r.height, faceCount: r.faces.length, mesh: face.mesh.map((p) => p.map((v) => Math.round(v * 1000) / 1000)), blendshapes: face.blendshapes, matrix: face.matrix }));
  console.log(`${name}: ${r.faces.length} face(s), ${r.width}×${r.height}`);
}
await browser.close();
server.close();
