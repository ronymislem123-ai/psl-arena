import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Research runs (not part of `npm test`): regenerate the ideal-example mesh and the
 * model-validation report. `npm run research` (all) or `npm run research -- ideal`.
 */
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
export default defineConfig({
  resolve: { alias },
  test: { name: "research", include: ["tests/research/**/*.test.ts"], environment: "node", testTimeout: 1_800_000, hookTimeout: 600_000, reporters: "default" },
});
