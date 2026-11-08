"use client";
import { ScaleEditor } from "@/components/scales/scale-editor";
import { getScale } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function ScalePage() {
  return (
    <LocalPage
      title="Scale"
      load={({ userId, query }) => {
        const scale = getScale(userId, query.get("id") ?? "");
        return scale ? <ScaleEditor key={`${scale.id}:${scale.version}`} mode={scale.builtIn ? "view" : "edit"} scale={scale} justSaved={query.get("saved") === "1"} /> : null;
      }}
    />
  );
}
