import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ServiceError } from "./errors";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(error: unknown) {
  if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: error.issues.slice(0, 10) }, { status: 400 });
  console.error("[api]", error);
  const msg = error instanceof Error ? error.message : "Internal error";
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ServiceError(400, "Malformed JSON body.");
  }
}

export type Params<T extends string> = { params: Promise<Record<T, string>> };
