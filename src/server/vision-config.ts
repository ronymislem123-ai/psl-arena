/**
 * Vision-model configuration of the server edition: enabled by the operator with
 * PSL_ARENA_VISION_PROVIDER=claude and ANTHROPIC_API_KEY (optional
 * PSL_ARENA_VISION_MODEL). The browser edition resolves ./vision-config.static.ts
 * instead (the user's own key, stored in their browser).
 */
export interface VisionConfig {
  provider: "claude";
  apiKey: string;
  model?: string;
  browser: boolean;
}

export function visionConfig(): VisionConfig | null {
  const provider = (process.env.PSL_ARENA_VISION_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (provider !== "claude" || !apiKey) return null;
  return { provider: "claude", apiKey, model: process.env.PSL_ARENA_VISION_MODEL?.trim() || undefined, browser: false };
}

/** Why no provider is available (for the UI). */
export function visionConfigHint(): "notConfigured" | "missingKey" | "browserKey" | null {
  const provider = (process.env.PSL_ARENA_VISION_PROVIDER ?? "").trim().toLowerCase();
  if (provider !== "claude") return "notConfigured";
  if (!(process.env.ANTHROPIC_API_KEY ?? "").trim()) return "missingKey";
  return null;
}
