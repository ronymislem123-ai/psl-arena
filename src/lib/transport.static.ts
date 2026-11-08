/**
 * Browser edition of ./transport.ts: requests are answered by the route handlers
 * running in the page (src/static/backend.ts) against the local database.
 */
import { localImageUrl } from "@/server/images.static";
import { downloadLocal, localFetch } from "@/static/backend";

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await localFetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

/** Object URL of an image stored in the local database. */
export const imageUrl = (id: string | null | undefined) => localImageUrl(id);

export async function downloadApi(path: string): Promise<void> {
  await downloadLocal(path);
}
