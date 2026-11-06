import type { Metadata } from "next";
import { ProfilesList } from "@/components/profiles/profiles";
import { listProfiles } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Face Profiles" };

export default function ProfilesPage() {
  return <ProfilesList profiles={listProfiles()} />;
}
