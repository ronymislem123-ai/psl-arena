import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE, sessionCookieOptions, tokenFromRequest } from "@/server/auth";
import { fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    destroySession(tokenFromRequest(req));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(req, 0), maxAge: 0 });
    return res;
  } catch (e) {
    return fail(e);
  }
}
