"use client";
import { RatingResult } from "@/components/rater/rating-result";
import { getRating } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function RatingPage() {
  return (
    <LocalPage
      title="PSL rating"
      load={({ userId, query }) => {
        const record = getRating(userId, query.get("id") ?? "");
        return record ? <RatingResult record={record} /> : null;
      }}
    />
  );
}
