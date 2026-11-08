"use client";
/** Browser edition: the user's own Anthropic API key, kept only in this browser. */
import { useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { useT } from "@/lib/i18n";
import { readBrowserVisionKey, writeBrowserVisionKey } from "@/lib/visual-model/browser-key";
import { DEFAULT_VISUAL_MODEL } from "@/lib/visual-model/claude";
import { useVisionStatus, VisionModelShell } from "./vision-model-card";

export function VisionModelCard() {
  const { t } = useT();
  const [status, refresh] = useVisionStatus();
  const stored = typeof window === "undefined" ? null : readBrowserVisionKey();
  const [key, setKey] = useState("");
  const [model, setModel] = useState(stored?.model ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    writeBrowserVisionKey({ apiKey: key || stored?.apiKey || "", model });
    setKey("");
    setMsg({ ok: true, text: t("settings.vision.saved") });
    refresh();
  };
  const remove = () => {
    writeBrowserVisionKey(null);
    setMsg({ ok: true, text: t("settings.vision.removed") });
    refresh();
  };
  // checks the key with the free model-info endpoint (no photo, no billed tokens)
  const check = async () => {
    const k = readBrowserVisionKey();
    if (!k) return;
    setBusy(true);
    setMsg(null);
    try {
      const client = new Anthropic({ apiKey: k.apiKey, authToken: null, baseURL: "https://api.anthropic.com", dangerouslyAllowBrowser: true, maxRetries: 0 });
      const m = await client.models.retrieve(k.model || DEFAULT_VISUAL_MODEL);
      setMsg({ ok: true, text: t("settings.vision.checkOk", { model: m.display_name ?? m.id }) });
    } catch (e) {
      setMsg({ ok: false, text: `${t("settings.vision.checkFail")} ${e instanceof Error ? e.message : ""}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <VisionModelShell status={status}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={stored ? t("settings.vision.keyStored") : "sk-ant-…"} aria-label={t("settings.vision.key")} data-testid="vision-key" />
        <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_VISUAL_MODEL} aria-label={t("settings.vision.model")} className="sm:w-52" data-testid="vision-model" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={!key && !stored} data-testid="vision-save">{t("settings.vision.save")}</Button>
        <Button size="sm" variant="outline" onClick={check} disabled={!stored || busy} loading={busy} data-testid="vision-check">{t("settings.vision.check")}</Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={!stored} data-testid="vision-remove">{t("settings.vision.remove")}</Button>
      </div>
      {msg && <div className={msg.ok ? "text-xs text-mint" : "text-xs text-[#ff8fa3]"} role="status">{msg.text}</div>}
      <p className="text-xs text-fg-3">{t("settings.vision.browserNote")}</p>
    </VisionModelShell>
  );
}
