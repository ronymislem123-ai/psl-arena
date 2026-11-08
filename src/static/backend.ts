/**
 * The browser edition's "server": requests for /api/... are dispatched to the
 * unchanged route handler modules, which run in the page against the local
 * sql.js database. Auth, HTTP helpers, the database and image storage resolve to
 * their *.static.ts variants in this build, everything else (validation schemas,
 * services, repositories, engine) is the same code the server runs.
 */
import * as analyses from "@/app/api/analyses/route";
import * as analysisById from "@/app/api/analyses/[id]/route";
import * as battles from "@/app/api/battles/route";
import * as battleById from "@/app/api/battles/[id]/route";
import * as data from "@/app/api/data/route";
import * as imageById from "@/app/api/images/[id]/route";
import * as leaderboards from "@/app/api/leaderboards/route";
import * as profiles from "@/app/api/profiles/route";
import * as profileById from "@/app/api/profiles/[id]/route";
import * as ratings from "@/app/api/ratings/route";
import * as ratingById from "@/app/api/ratings/[id]/route";
import * as ratios from "@/app/api/ratios/route";
import * as rubric from "@/app/api/rubric/route";
import * as scales from "@/app/api/scales/route";
import * as scaleImport from "@/app/api/scales/import/route";
import * as scaleById from "@/app/api/scales/[id]/route";
import * as scaleDuplicate from "@/app/api/scales/[id]/duplicate/route";
import * as scaleExport from "@/app/api/scales/[id]/export/route";
import * as scaleImages from "@/app/api/scales/[id]/images/route";
import * as settings from "@/app/api/settings/route";
import * as sideAnalyses from "@/app/api/side-analyses/route";
import * as sideAnalysisById from "@/app/api/side-analyses/[id]/route";
import * as stats from "@/app/api/stats/route";
import * as tournaments from "@/app/api/tournaments/route";
import * as tournamentById from "@/app/api/tournaments/[id]/route";
import * as tournamentActions from "@/app/api/tournaments/[id]/actions/route";
import * as tournamentVersions from "@/app/api/tournaments/[id]/versions/route";
import * as tournamentVersionById from "@/app/api/tournaments/[id]/versions/[versionId]/route";
import { ensureLocalDb, withWrite } from "./runtime";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler>>;

/** Literal routes before parameterised ones with the same prefix. */
const ROUTES: [string, RouteModule][] = [
  ["/api/analyses", analyses],
  ["/api/analyses/:id", analysisById],
  ["/api/battles", battles],
  ["/api/battles/:id", battleById],
  ["/api/data", data],
  ["/api/images/:id", imageById],
  ["/api/leaderboards", leaderboards],
  ["/api/profiles", profiles],
  ["/api/profiles/:id", profileById],
  ["/api/ratings", ratings],
  ["/api/ratings/:id", ratingById],
  ["/api/ratios", ratios],
  ["/api/rubric", rubric],
  ["/api/scales", scales],
  ["/api/scales/import", scaleImport],
  ["/api/scales/:id", scaleById],
  ["/api/scales/:id/duplicate", scaleDuplicate],
  ["/api/scales/:id/export", scaleExport],
  ["/api/scales/:id/images", scaleImages],
  ["/api/settings", settings],
  ["/api/side-analyses", sideAnalyses],
  ["/api/side-analyses/:id", sideAnalysisById],
  ["/api/stats", stats],
  ["/api/tournaments", tournaments],
  ["/api/tournaments/:id", tournamentById],
  ["/api/tournaments/:id/actions", tournamentActions],
  ["/api/tournaments/:id/versions", tournamentVersions],
  ["/api/tournaments/:id/versions/:versionId", tournamentVersionById],
] as [string, RouteModule][];

export function matchRoute(pathname: string): { module: RouteModule; params: Record<string, string> } | null {
  const parts = pathname.replace(/\/+$/, "").split("/");
  for (const [pattern, module] of ROUTES) {
    const pp = pattern.split("/");
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let okMatch = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(":")) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) {
        okMatch = false;
        break;
      }
    }
    if (okMatch) return { module, params };
  }
  return null;
}

const LOCAL_ORIGIN = "http://browser.local";

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** fetch() replacement for /api/... in the browser edition. */
export async function localFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, LOCAL_ORIGIN);
  const method = (init?.method ?? "GET").toUpperCase();
  const match = matchRoute(url.pathname);
  if (!match) return jsonResponse({ error: "Not available in the browser edition." }, 404);
  const handler = match.module[method as keyof RouteModule];
  if (!handler) return jsonResponse({ error: "Method not allowed." }, 405);
  const req = new Request(url.toString(), { method, headers: init?.headers, body: method === "GET" || method === "HEAD" ? undefined : init?.body });
  const call = () => Promise.resolve(handler(req, { params: Promise.resolve(match.params) }));
  if (method === "GET" || method === "HEAD") {
    await ensureLocalDb();
    return call();
  }
  return withWrite(call);
}

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^";]+)"?/i.exec(cd);
  return m?.[1] ?? fallback;
}

/** Saves the response of a GET /api/... as a file (replaces <a href download> links). */
export async function downloadLocal(path: string): Promise<void> {
  const res = await localFetch(path);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  const fallback = `${new URL(path, LOCAL_ORIGIN).pathname.split("/").filter(Boolean).slice(1).join("-") || "export"}.json`;
  saveBlob(await res.blob(), filenameFrom(res, fallback));
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
