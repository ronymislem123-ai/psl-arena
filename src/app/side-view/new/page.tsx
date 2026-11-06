import type { Metadata } from "next";
import { SidePlacer } from "@/components/side/side-placer";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Side View" };

export default async function NewSideViewPage() {
  await requireUser("/side-view/new");
  return <SidePlacer />;
}
