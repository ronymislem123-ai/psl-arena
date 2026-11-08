"use client";
import { NewBattle } from "@/components/battle/new-battle";
import { LocalPage } from "@/static/local-page";

export default function NewBattlePage() {
  return <LocalPage title="New Battle" load={() => <NewBattle />} />;
}
