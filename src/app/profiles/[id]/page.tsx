import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileDetail } from "@/components/profiles/profiles";
import { getProfile, listAnalyses } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) notFound();
  return <ProfileDetail profile={profile} analyses={listAnalyses({ profileId: id })} />;
}
