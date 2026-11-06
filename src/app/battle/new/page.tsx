import type { Metadata } from "next";
import { NewBattle } from "@/components/battle/new-battle";

export const metadata: Metadata = { title: "New Battle" };

export default function NewBattlePage() {
  return <NewBattle />;
}
