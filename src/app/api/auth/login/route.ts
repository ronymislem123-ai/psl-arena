import { NextResponse } from "next/server";
import { clientId, createMfaChallenge, createSession, isTotpEnabled, login, MFA_COOKIE, mfaCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { fail, readJson } from "@/server/http";
import { loginSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Password step. With a second factor enabled no session is created yet: a
 * short-lived challenge cookie (scoped to /api/auth/login) is issued and the
 * client continues at /api/auth/login/totp.
 */
export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await readJson(req));
    const user = login(body, clientId(req));
    if (isTotpEnabled(user.id)) {
      const { token } = createMfaChallenge(user.id);
      const res = NextResponse.json({ mfaRequired: true });
      res.cookies.set(MFA_COOKIE, token, mfaCookieOptions(req));
      return res;
    }
    const { token } = createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
