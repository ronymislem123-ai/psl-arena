import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return <SettingsView account={{ email: user.email, name: user.name, createdAt: user.createdAt }} />;
}
