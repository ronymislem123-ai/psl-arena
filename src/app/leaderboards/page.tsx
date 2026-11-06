import type { Metadata } from "next";
import { Leaderboards } from "@/components/leaderboards/leaderboards";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboards" };

export default async function LeaderboardsPage() {
  await requireUser("/leaderboards");
  return <Leaderboards />;
}
