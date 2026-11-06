import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth/reset-form";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/settings");
  return <ResetForm next={next} />;
}
