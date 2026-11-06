import type { Metadata } from "next";
import { ComparePicker, CompareView } from "@/components/compare/compare-view";
import { requireUser } from "@/server/auth";
import { getRatings, listRatings } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare ratings" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const user = await requireUser("/compare");
  const { ids } = await searchParams;
  const wanted = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const records = wanted.length >= 2 ? getRatings(user.id, wanted) : [];
  if (records.length >= 2) return <CompareView records={records} />;
  return <ComparePicker ratings={listRatings(user.id, { limit: 200 })} preselect={wanted} />;
}
