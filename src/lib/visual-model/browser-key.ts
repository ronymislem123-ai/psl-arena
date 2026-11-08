/**
 * The browser edition's vision-model key: entered by the user in the settings and
 * stored only in this browser (localStorage). It is sent only to the model API, and
 * only when the user consents to sending a photo for a rating.
 */
const KEY = "psl-arena.visionModel";

export interface BrowserVisionKey {
  apiKey: string;
  model?: string;
}

export function readBrowserVisionKey(): BrowserVisionKey | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as BrowserVisionKey;
    return v?.apiKey?.trim() ? { apiKey: v.apiKey.trim(), model: v.model?.trim() || undefined } : null;
  } catch {
    return null;
  }
}

export function writeBrowserVisionKey(v: BrowserVisionKey | null) {
  try {
    if (!v || !v.apiKey.trim()) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ apiKey: v.apiKey.trim(), model: v.model?.trim() || undefined }));
  } catch {
    /* storage unavailable: the key is simply not kept */
  }
}
