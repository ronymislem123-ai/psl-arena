import { NextResponse } from "next/server";
import { deleteAccount, requireUserApi, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { fail, readJson } from "@/server/http";
import { deleteAccountSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = deleteAccountSchema.parse(await readJson(req));
    deleteAccount(user.id, body.password);
    const res = NextResponse.json({ deleted: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(req, 0), maxAge: 0 });
    return res;
  } catch (e) {
    return fail(e);
  }
}
