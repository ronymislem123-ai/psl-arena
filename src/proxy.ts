import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/server/auth-constants";

/**
 * Optimistic access gate: page requests without a session cookie are redirected
 * to /login. The authoritative check (cookie → database session) happens in the
 * pages and API routes themselves.
 */
export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();
  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // everything except Next internals, static assets (paths with a file extension), the ML runtime and the model
  matcher: ["/((?!_next/|mediapipe/|models/|favicon\\.ico|.*\\..*).*)"],
};
