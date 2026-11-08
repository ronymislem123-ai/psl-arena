import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    reporters: "default",
    projects: [
      {
        resolve: { alias },
        test: { name: "server", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        // Resolves like `npm run build:static`: *.static.ts siblings replace the server modules.
        resolve: { alias, extensions: [".static.ts", ".static.tsx", ".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"] },
        test: { name: "browser-edition", include: ["tests/static/**/*.test.ts"], environment: "node" },
      },
    ],
  },
});
