import type { Metadata } from "next";
import { ScalesList } from "@/components/scales/scales-list";
import { requireUser } from "@/server/auth";
import { getScale, listScales } from "@/server/repos-psl";
import type { PslScale } from "@/engine/psl/scale";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scale Builder" };

export default async function ScalesPage() {
  const user = await requireUser("/scales");
  const scales = listScales(user.id);
  const full: Record<string, PslScale> = {};
  for (const s of scales) {
    const f = getScale(user.id, s.id);
    if (f) full[s.id] = f;
  }
  return <ScalesList scales={scales} full={full} />;
}
