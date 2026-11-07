import type { Metadata } from "next";
import { AnalysesCompareView } from "@/components/compare/analyses-view";
import { CompareView } from "@/components/compare/compare-view";
import { ComparePickers, type CompareMode } from "@/components/compare/pickers";
import { VersionsCompareView, type VersionOption } from "@/components/compare/versions-view";
import { requireUser } from "@/server/auth";
import { getAnalysis, listAnalyses } from "@/server/repos";
import { getRatings, getTournament, getTournamentVersion, listRatings, listTournaments, listTournamentVersions } from "@/server/repos-psl";
import type { AnalysisRecord } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare" };

const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; analyses?: string; mode?: string; tournament?: string; a?: string; b?: string }> }) {
  const user = await requireUser("/compare");
  const sp = await searchParams;
  const mode: CompareMode = sp.mode === "analyses" || sp.analyses ? "analyses" : sp.mode === "versions" || sp.tournament ? "versions" : "ratings";

  if (mode === "ratings") {
    const wanted = split(sp.ids);
    const records = wanted.length >= 2 ? getRatings(user.id, wanted) : [];
    if (records.length >= 2) return <CompareView records={records} />;
  }
  if (mode === "analyses") {
    const wanted = split(sp.analyses).slice(0, 4);
    const records = wanted.map((id) => getAnalysis(user.id, id)).filter((r): r is AnalysisRecord => !!r);
    if (records.length >= 2) return <AnalysesCompareView records={records} />;
  }
  if (mode === "versions") {
    const tournaments = listTournaments(user.id);
    const tid = sp.tournament ?? null;
    const current = tid ? getTournament(user.id, tid) : null;
    const versions = tid ? listTournamentVersions(user.id, tid) : [];
    const options: VersionOption[] = [];
    if (current) {
      options.push({ id: "current", version: current.version, label: `current (v${current.version}, ${current.status})`, record: current });
      for (const v of versions) {
        const rec = getTournamentVersion(user.id, tid!, v.id);
        if (rec) options.push({ id: v.id, version: v.version, label: `archived v${v.version} (${rec.status})`, record: rec });
      }
    }
    return <VersionsCompareView tournaments={tournaments} tournamentId={current ? tid : null} versions={versions} options={options} a={sp.a ?? null} b={sp.b ?? null} />;
  }
  const preselect = [...split(sp.ids), ...split(sp.analyses)];
  return <ComparePickers mode={mode} ratings={listRatings(user.id, { limit: 200 })} analyses={listAnalyses(user.id, { limit: 200 })} tournaments={listTournaments(user.id)} preselect={preselect} />;
}
