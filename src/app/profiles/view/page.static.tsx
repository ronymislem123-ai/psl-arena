"use client";
import { ProfileDetail } from "@/components/profiles/profiles";
import { getProfile, listAnalyses, listSideAnalyses } from "@/server/repos";
import { awardsForProfile, getRatings, listRatings, tournamentParticipation } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function ProfilePage() {
  return (
    <LocalPage
      title="Profile"
      load={({ userId, query }) => {
        const id = query.get("id") ?? "";
        const profile = getProfile(userId, id);
        if (!profile) return null;
        const ratings = listRatings(userId, { profileId: id });
        return <ProfileDetail profile={profile} analyses={listAnalyses(userId, { profileId: id })} sideAnalyses={listSideAnalyses(userId, { profileId: id })} ratings={ratings} ratingRecords={getRatings(userId, ratings.slice(0, 8).map((r) => r.id))} awards={awardsForProfile(userId, id)} participation={tournamentParticipation(userId, id)} />;
      }}
    />
  );
}
