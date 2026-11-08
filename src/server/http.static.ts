/**
 * Browser edition of ./http.ts: the same helpers on plain Fetch API objects, so the
 * unchanged route handlers can run inside the page (see src/static/backend.ts).
 */
import { ZodError } from "zod";
import { ServiceError } from "./errors";

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function ok(data: unknown, init?: ResponseInit) {
  return json(data, init);
}

export function fail(error: unknown) {
  if (error instanceof ServiceError) return json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return json({ error: "Invalid request", issues: error.issues.slice(0, 10) }, { status: 400 });
  console.error("[local api]", error);
  const msg = error instanceof Error ? error.message : "Internal error";
  return json({ error: msg }, { status: 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ServiceError(400, "Malformed JSON body.");
  }
}

export type Params<T extends string> = { params: Promise<Record<T, string>> };
