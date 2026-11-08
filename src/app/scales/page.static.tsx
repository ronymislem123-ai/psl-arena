"use client";
import type { PslScale } from "@/engine/psl/scale";
import { ScalesList } from "@/components/scales/scales-list";
import { getScale, listScales } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function ScalesPage() {
  return (
    <LocalPage
      title="Scale Builder"
      load={({ userId }) => {
        const scales = listScales(userId);
        const full: Record<string, PslScale> = {};
        for (const s of scales) {
          const f = getScale(userId, s.id);
          if (f) full[s.id] = f;
        }
        return <ScalesList scales={scales} full={full} />;
      }}
    />
  );
}
