"use client";
import { useState } from "react";
import { Check, Copy, Download, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function RecoveryCodes({ codes, onContinue, continueLabel, compact }: { codes: string[]; onContinue?: () => void; continueLabel?: string; compact?: boolean }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: user can select the text */
    }
  };
  const download = () => {
    const blob = new Blob([`PSL ARENA recovery codes\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "psl-arena-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4" data-testid="recovery-codes">
      {!compact && (
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <KeyRound size={18} className="text-amber" /> {t("auth.codesTitle")}
          </h2>
          <p className="mt-1 text-sm text-fg-2">{t("auth.codesSub")}</p>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg-1/60 p-3 font-mono text-sm select-all" data-testid="recovery-code-list">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-white/5 px-3 py-1.5 tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("auth.codesCopied") : t("auth.codesCopy")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={download}>
          <Download size={14} /> {t("auth.codesDownload")}
        </Button>
        {onContinue && (
          <Button type="button" size="sm" onClick={onContinue} data-testid="codes-continue">
            {continueLabel ?? t("auth.codesContinue")}
          </Button>
        )}
      </div>
    </div>
  );
}
