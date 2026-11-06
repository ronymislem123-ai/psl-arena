import type { Metadata } from "next";
import { ScaleEditor } from "@/components/scales/scale-editor";
import { requireUser } from "@/server/auth";
import { buildStandardScale } from "@/engine/psl/scale";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New scale" };

export default async function NewScalePage() {
  await requireUser("/scales/new");
  const base = buildStandardScale();
  return <ScaleEditor mode="new" scale={{ ...base, id: "new", name: "My scale", builtIn: false, version: 1, description: "" }} />;
}
