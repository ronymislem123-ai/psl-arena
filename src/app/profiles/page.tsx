import type { Metadata } from "next";
import { ProfilesList } from "@/components/profiles/profiles";
import { requireUser } from "@/server/auth";
import { listProfiles } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Face Profiles" };

export default async function ProfilesPage() {
  const user = await requireUser("/profiles");
  return <ProfilesList profiles={listProfiles(user.id)} />;
}
