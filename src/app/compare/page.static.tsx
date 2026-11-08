"use client";
import type { AnalysisRecord } from "@/server/repos";
import { AnalysesCompareView } from "@/components/compare/analyses-view";
import { CompareView } from "@/components/compare/compare-view";
import { ComparePickers, type CompareMode } from "@/components/compare/pickers";
import { VersionsCompareView, type VersionOption } from "@/components/compare/versions-view";
import { getAnalysis, listAnalyses } from "@/server/repos";
import { getRatings, getTournament, getTournamentVersion, listRatings, listTournaments, listTournamentVersions } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

const split = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export default function ComparePage() {
  return (
    <LocalPage
      title="Compare"
      load={({ userId, query }) => {
        const sp = { ids: query.get("ids"), analyses: query.get("analyses"), mode: query.get("mode"), tournament: query.get("tournament"), a: query.get("a"), b: query.get("b") };
        const mode: CompareMode = sp.mode === "analyses" || sp.analyses ? "analyses" : sp.mode === "versions" || sp.tournament ? "versions" : "ratings";
        if (mode === "ratings") {
          const wanted = split(sp.ids);
          const records = wanted.length >= 2 ? getRatings(userId, wanted) : [];
          if (records.length >= 2) return <CompareView records={records} />;
        }
        if (mode === "analyses") {
          const wanted = split(sp.analyses).slice(0, 4);
          const records = wanted.map((id) => getAnalysis(userId, id)).filter((r): r is AnalysisRecord => !!r);
          if (records.length >= 2) return <AnalysesCompareView records={records} />;
        }
        if (mode === "versions") {
          const tournaments = listTournaments(userId);
          const tid = sp.tournament;
          const current = tid ? getTournament(userId, tid) : null;
          const versions = tid ? listTournamentVersions(userId, tid) : [];
          const options: VersionOption[] = [];
          if (current && tid) {
            options.push({ id: "current", version: current.version, label: `current (v${current.version}, ${current.status})`, record: current });
            for (const v of versions) {
              const rec = getTournamentVersion(userId, tid, v.id);
              if (rec) options.push({ id: v.id, version: v.version, label: `archived v${v.version} (${rec.status})`, record: rec });
            }
          }
          return <VersionsCompareView tournaments={tournaments} tournamentId={current ? tid : null} versions={versions} options={options} a={sp.a} b={sp.b} />;
        }
        const preselect = [...split(sp.ids), ...split(sp.analyses)];
        return <ComparePickers mode={mode} ratings={listRatings(userId, { limit: 200 })} analyses={listAnalyses(userId, { limit: 200 })} tournaments={listTournaments(userId)} preselect={preselect} />;
      }}
    />
  );
}
