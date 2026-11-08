"use client";
import { SettingsView } from "@/components/settings/settings";
import { LocalPage } from "@/static/local-page";

export default function SettingsPage() {
  return <LocalPage title="Settings" load={() => <SettingsView account={null} />} />;
}
