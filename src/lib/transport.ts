/**
 * How the client talks to the data layer. Server app: fetch() against the Next.js
 * route handlers. The browser edition replaces this module with transport.static.ts,
 * which runs the same handlers inside the page.
 */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  // A 401 from a data endpoint means the session is gone → back to the login page.
  // Auth endpoints answer 401 for wrong credentials/codes, which the forms display themselves.
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    const target = new URL("/login", window.location.origin);
    target.searchParams.set("next", window.location.pathname + window.location.search);
    window.location.assign(target.toString()); // full reload: the session is gone, drop all client state

  }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

/** URL of a stored image. */
export const imageUrl = (id: string | null | undefined) => (id ? `/api/images/${id}` : null);

/** Downloads GET /api/... as a file (the server sets Content-Disposition). */
export async function downloadApi(path: string): Promise<void> {
  const a = document.createElement("a");
  a.href = path;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
