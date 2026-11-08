"use client";
import { AnalysisCenter } from "@/components/analysis/analysis-center";
import { getAnalysis } from "@/server/repos";
import { LocalPage } from "@/static/local-page";

export default function AnalysisPage() {
  return (
    <LocalPage
      title="Analysis"
      load={({ userId, query }) => {
        const a = getAnalysis(userId, query.get("id") ?? "");
        return a ? <AnalysisCenter result={a.result} label={a.profileLabel} imageId={a.imageId} createdAt={a.createdAt} analysisId={a.id} profileId={a.profileId} width={a.imageWidth} height={a.imageHeight} /> : null;
      }}
    />
  );
}
