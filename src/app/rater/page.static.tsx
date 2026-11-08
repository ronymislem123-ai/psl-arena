"use client";
import { RaterSetup } from "@/components/rater/rater-setup";
import { listProfiles } from "@/server/repos";
import { listScales } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function RaterPage() {
  return <LocalPage title="AI PSL Rater" load={({ userId, query }) => <RaterSetup scales={listScales(userId)} profiles={listProfiles(userId)} initialProfileId={query.get("profile") ?? undefined} />} />;
}
