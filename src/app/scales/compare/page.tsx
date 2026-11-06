import type { Metadata } from "next";
import { ScaleCompare } from "@/components/scales/scales-list";
import { requireUser } from "@/server/auth";
import { getScale, listScales } from "@/server/repos-psl";
import type { PslScale } from "@/engine/psl/scale";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare scales" };

export default async function ComparePage() {
  const user = await requireUser("/scales/compare");
  const scales = listScales(user.id).map((s) => getScale(user.id, s.id)).filter((s): s is PslScale => !!s);
  return <ScaleCompare scales={scales} />;
}
