/**
 * Browser edition: the vision model runs with the user's own API key, entered in
 * the settings and kept only in this browser's localStorage (see
 * src/lib/visual-model/browser-key.ts). Nothing is configured by default.
 */
import { readBrowserVisionKey } from "@/lib/visual-model/browser-key";
import type { VisionConfig } from "./vision-config";
export type { VisionConfig } from "./vision-config";

export function visionConfig(): VisionConfig | null {
  const k = readBrowserVisionKey();
  return k ? { provider: "claude", apiKey: k.apiKey, model: k.model, browser: true } : null;
}

export function visionConfigHint(): "notConfigured" | "missingKey" | "browserKey" | null {
  return readBrowserVisionKey() ? null : "browserKey";
}
