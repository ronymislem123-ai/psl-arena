"use client";
import { Leaderboards } from "@/components/leaderboards/leaderboards";
import { LocalPage } from "@/static/local-page";

export default function LeaderboardsPage() {
  return <LocalPage title="Leaderboards" load={() => <Leaderboards />} />;
}
