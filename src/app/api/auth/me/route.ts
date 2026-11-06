import { userFromRequest } from "@/server/auth";
import { ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = userFromRequest(req);
  if (!user) return ok({ error: "Sign in required." }, { status: 401 });
  return ok({ user });
}
