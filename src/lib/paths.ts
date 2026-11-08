/**
 * Links to pages of a single record. The server app uses path segments
 * (/rater/rate_abc); the static browser edition cannot pre-render unknown ids, so
 * it serves one page per record type and passes the id as a query parameter.
 */
import { IS_STATIC } from "./base-path";

function withQuery(base: string, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export const paths = {
  analysis: (id: string) => (IS_STATIC ? withQuery("/analysis/view", { id }) : `/analysis/${id}`),
  battle: (id: string) => (IS_STATIC ? withQuery("/battle/view", { id }) : `/battle/${id}`),
  profile: (id: string) => (IS_STATIC ? withQuery("/profiles/view", { id }) : `/profiles/${id}`),
  rating: (id: string) => (IS_STATIC ? withQuery("/rater/view", { id }) : `/rater/${id}`),
  scale: (id: string, opts?: { saved?: boolean }) => (IS_STATIC ? withQuery("/scales/view", { id, saved: opts?.saved ? "1" : undefined }) : `/scales/${id}${opts?.saved ? "?saved=1" : ""}`),
  sideView: (id: string) => (IS_STATIC ? withQuery("/side-view/view", { id }) : `/side-view/${id}`),
  tournament: (id: string) => (IS_STATIC ? withQuery("/tournaments/view", { id }) : `/tournaments/${id}`),
  tournamentEdit: (id: string) => (IS_STATIC ? withQuery("/tournaments/edit", { id }) : `/tournaments/${id}/edit`),
  tournamentVersion: (id: string, versionId: string) => (IS_STATIC ? withQuery("/tournaments/version", { id, v: versionId }) : `/tournaments/${id}/versions/${versionId}`),
};
