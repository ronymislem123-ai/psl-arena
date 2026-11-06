import { NextResponse } from "next/server";
import { clientId, createSession, login, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { fail, readJson } from "@/server/http";
import { loginSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await readJson(req));
    const user = login(body, clientId(req));
    const { token } = createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
