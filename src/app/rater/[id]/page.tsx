import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RatingResult } from "@/components/rater/rating-result";
import { requireUser } from "@/server/auth";
import { getRating } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PSL rating" };

export default async function RatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/rater/${id}`);
  const record = getRating(user.id, id);
  if (!record) notFound();
  return <RatingResult record={record} />;
}
