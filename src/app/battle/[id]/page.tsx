import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BattleView } from "@/components/battle/battle-view";
import { requireUser } from "@/server/auth";
import { getAnalysis, getBattle } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Battle" };

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/battle/${id}`);
  const battle = getBattle(user.id, id);
  if (!battle) notFound();
  const a = getAnalysis(user.id, battle.analysisAId);
  const b = getAnalysis(user.id, battle.analysisBId);
  if (!a || !b) notFound();
  return (
    <BattleView
      battle={battle.result}
      createdAt={battle.createdAt}
      a={{ label: battle.labelA, imageId: a.imageId, analysis: a.result, analysisId: a.id }}
      b={{ label: battle.labelB, imageId: b.imageId, analysis: b.result, analysisId: b.id }}
    />
  );
}
