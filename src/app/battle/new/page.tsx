import type { Metadata } from "next";
import { NewBattle } from "@/components/battle/new-battle";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Battle" };

export default async function NewBattlePage() {
  await requireUser("/battle/new");
  return <NewBattle />;
}
