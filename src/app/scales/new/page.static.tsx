"use client";
import { ScaleEditor } from "@/components/scales/scale-editor";
import { buildStandardScale } from "@/engine/psl/scale";
import { LocalPage } from "@/static/local-page";

export default function NewScalePage() {
  return (
    <LocalPage
      title="New scale"
      load={() => {
        const base = buildStandardScale();
        return <ScaleEditor mode="new" scale={{ ...base, id: "new", name: "My scale", builtIn: false, version: 1, description: "" }} />;
      }}
    />
  );
}
