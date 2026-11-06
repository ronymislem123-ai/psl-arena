import type { Metadata } from "next";
import { RaterSetup } from "@/components/rater/rater-setup";
import { requireUser } from "@/server/auth";
import { listProfiles } from "@/server/repos";
import { listScales } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI PSL Rater" };

export default async function RaterPage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const user = await requireUser("/rater");
  const { profile } = await searchParams;
  return <RaterSetup scales={listScales(user.id)} profiles={listProfiles(user.id)} initialProfileId={profile} />;
}
