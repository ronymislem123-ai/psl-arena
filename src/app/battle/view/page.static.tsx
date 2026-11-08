"use client";
import { BattleView } from "@/components/battle/battle-view";
import { getAnalysis, getBattle } from "@/server/repos";
import { LocalPage } from "@/static/local-page";

export default function BattlePage() {
  return (
    <LocalPage
      title="Battle"
      load={({ userId, query }) => {
        const battle = getBattle(userId, query.get("id") ?? "");
        if (!battle) return null;
        const a = getAnalysis(userId, battle.analysisAId);
        const b = getAnalysis(userId, battle.analysisBId);
        if (!a || !b) return null;
        return (
          <BattleView
            battle={battle.result}
            createdAt={battle.createdAt}
            a={{ label: battle.labelA, imageId: a.imageId, analysis: a.result, analysisId: a.id }}
            b={{ label: battle.labelB, imageId: b.imageId, analysis: b.result, analysisId: b.id }}
          />
        );
      }}
    />
  );
}
