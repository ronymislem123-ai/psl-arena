import { NextResponse } from "next/server";
import { clientId, completeMfaChallenge, cookieFromHeader, createSession, MFA_COOKIE, mfaCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { fail, readJson } from "@/server/http";
import { mfaCompleteSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Second-factor step: authenticator code or recovery code → full session. */
export async function POST(req: Request) {
  try {
    const body = mfaCompleteSchema.parse(await readJson(req));
    const challenge = cookieFromHeader(req.headers.get("cookie"), MFA_COOKIE);
    const { user, usedRecoveryCode, remainingCodes } = completeMfaChallenge(challenge, body, clientId(req));
    const { token } = createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({ user, usedRecoveryCode, remainingCodes });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
    res.cookies.set(MFA_COOKIE, "", { ...mfaCookieOptions(req), maxAge: 0 });
    return res;
  } catch (e) {
    return fail(e);
  }
}
