"use client";
import type { PslScale } from "@/engine/psl/scale";
import { ScaleCompare } from "@/components/scales/scales-list";
import { getScale, listScales } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function CompareScalesPage() {
  return (
    <LocalPage
      title="Compare scales"
      load={({ userId }) => <ScaleCompare scales={listScales(userId).map((s) => getScale(userId, s.id)).filter((s): s is PslScale => !!s)} />}
    />
  );
}
