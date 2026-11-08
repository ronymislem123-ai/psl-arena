"use client";
import { SidePlacer } from "@/components/side/side-placer";
import { LocalPage } from "@/static/local-page";

export default function NewSideViewPage() {
  return <LocalPage title="Side View" load={() => <SidePlacer />} />;
}
