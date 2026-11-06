// Copies the MediaPipe WASM runtime from node_modules into /public so the app
// serves it from the same origin (no CDN, works offline). Also verifies that the
// Face Landmarker model bundle is present.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

let wasmSrc;
try {
  // The package's "exports" map hides package.json, so resolve the main entry instead.
  wasmSrc = join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
} catch {
  console.warn("[prepare-assets] @mediapipe/tasks-vision not installed yet; skipping wasm copy.");
  process.exit(0);
}
const wasmDst = join(root, "public", "mediapipe", "wasm");
mkdirSync(wasmDst, { recursive: true });
for (const f of readdirSync(wasmSrc)) {
  cpSync(join(wasmSrc, f), join(wasmDst, f));
}
console.log(`[prepare-assets] copied ${readdirSync(wasmSrc).length} wasm runtime files to public/mediapipe/wasm`);

const model = join(root, "public", "models", "face_landmarker.task");
if (!existsSync(model) || statSync(model).size < 1_000_000) {
  console.warn(
    "[prepare-assets] WARNING: public/models/face_landmarker.task is missing.\n" +
      "  Download it from https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task\n" +
      "  (Apache-2.0, Google) and place it at public/models/face_landmarker.task"
  );
} else {
  console.log("[prepare-assets] face_landmarker.task present");
}
