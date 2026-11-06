import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SideResult } from "@/components/side/side-result";
import { requireUser } from "@/server/auth";
import { getSideAnalysis } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Side View" };

export default async function SideViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/side-view/${id}`);
  const record = getSideAnalysis(user.id, id);
  if (!record) notFound();
  return <SideResult record={record} />;
}
