import { userFromRequest } from "@/server/auth";
import { fail, type Params } from "@/server/http";
import { readImage } from "@/server/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = userFromRequest(req);
    if (!user) return new Response("Unauthorized", { status: 401 });
    const { id } = await params;
    if (!/^img_[a-z0-9]+$/.test(id)) return new Response("Not found", { status: 404 });
    const img = readImage(user.id, id);
    if (!img) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(img.buf), {
      headers: {
        "Content-Type": img.mime,
        "Cache-Control": "private, max-age=3600",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
