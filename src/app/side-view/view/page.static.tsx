"use client";
import { SideResult } from "@/components/side/side-result";
import { getSideAnalysis } from "@/server/repos";
import { LocalPage } from "@/static/local-page";

export default function SideViewPage() {
  return (
    <LocalPage
      title="Side View"
      load={({ userId, query }) => {
        const record = getSideAnalysis(userId, query.get("id") ?? "");
        return record ? <SideResult record={record} /> : null;
      }}
    />
  );
}
