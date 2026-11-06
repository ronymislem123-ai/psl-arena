import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScaleEditor } from "@/components/scales/scale-editor";
import { requireUser } from "@/server/auth";
import { getScale } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scale" };

export default async function ScalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireUser(`/scales/${id}`);
  const scale = getScale(user.id, id);
  if (!scale) notFound();
  return <ScaleEditor mode={scale.builtIn ? "view" : "edit"} scale={scale} justSaved={saved === "1"} />;
}
