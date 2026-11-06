import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisCenter } from "@/components/analysis/analysis-center";
import { getAnalysis } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analysis" };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getAnalysis(id);
  if (!a) notFound();
  return <AnalysisCenter result={a.result} label={a.profileLabel} imageId={a.imageId} createdAt={a.createdAt} analysisId={a.id} profileId={a.profileId} width={a.imageWidth} height={a.imageHeight} />;
}
