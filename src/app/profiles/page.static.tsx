"use client";
import { ProfilesList } from "@/components/profiles/profiles";
import { listProfiles } from "@/server/repos";
import { LocalPage } from "@/static/local-page";

export default function ProfilesPage() {
  return <LocalPage title="Face Profiles" load={({ userId }) => <ProfilesList profiles={listProfiles(userId)} />} />;
}
