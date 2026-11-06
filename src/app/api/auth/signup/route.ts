import { NextResponse } from "next/server";
import { clientId, createSession, generateRecoveryCodes, isSignupAllowed, SESSION_COOKIE, sessionCookieOptions, signup } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { signupSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ allowed: isSignupAllowed() });
}

export async function POST(req: Request) {
  try {
    const body = signupSchema.parse(await readJson(req));
    const user = signup(body, clientId(req));
    const recoveryCodes = generateRecoveryCodes(user.id);
    const { token } = createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({ user, recoveryCodes }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
