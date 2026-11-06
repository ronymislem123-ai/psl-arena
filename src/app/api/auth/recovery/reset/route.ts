import { NextResponse } from "next/server";
import { clientId, createSession, resetPasswordWithRecoveryCode, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { fail, readJson } from "@/server/http";
import { resetPasswordSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: e-mail + unused recovery code + new password → signed in with a fresh session. */
export async function POST(req: Request) {
  try {
    const body = resetPasswordSchema.parse(await readJson(req));
    const { user, remainingCodes } = resetPasswordWithRecoveryCode(body, clientId(req));
    const { token } = createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({ user, remainingCodes });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
