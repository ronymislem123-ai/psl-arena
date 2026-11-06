import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileDetail } from "@/components/profiles/profiles";
import { requireUser } from "@/server/auth";
import { getProfile, listAnalyses, listSideAnalyses } from "@/server/repos";
import { awardsForProfile, getRatings, listRatings } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/profiles/${id}`);
  const profile = getProfile(user.id, id);
  if (!profile) notFound();
  const ratings = listRatings(user.id, { profileId: id });
  return <ProfileDetail profile={profile} analyses={listAnalyses(user.id, { profileId: id })} sideAnalyses={listSideAnalyses(user.id, { profileId: id })} ratings={ratings} ratingRecords={getRatings(user.id, ratings.slice(0, 8).map((r) => r.id))} awards={awardsForProfile(user.id, id)} />;
}
