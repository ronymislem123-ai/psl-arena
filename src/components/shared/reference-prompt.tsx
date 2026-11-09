"use client";
/**
 * "Schlechtes Foto? Kein Problem!": shows the Universal Facial Reference Optimization
 * prompt (src/lib/reference-prompt.ts, verbatim) and copies exactly that text. The app
 * does no image editing itself — the user runs the prompt in ChatGPT with their photo
 * and uploads the result here like any other photo.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Copy, Info, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/controls";
import { useT } from "@/lib/i18n";
import { REFERENCE_PROMPT } from "@/lib/reference-prompt";
import { cn } from "@/lib/utils";

/** Copies text; resolves true only when the browser confirmed the copy. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path (e.g. insecure context, denied permission) */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Heading lines of the prompt (display only — the text itself is not changed). */
const isHeading = (line: string) => /^\d{1,2}\. [^a-zäöüß]+$/.test(line) || (/^[^a-zäöüß]+$/.test(line) && /[A-ZÄÖÜ]{3}/.test(line));

export function ReferencePromptButton({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "failed">("idle");
  const copy = async () => {
    setState("idle");
    setState((await copyText(REFERENCE_PROMPT)) ? "ok" : "failed");
  };
  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setState("idle");
          setOpen(true);
        }}
        data-testid="reference-prompt-open"
      >
        <Sparkles size={14} /> Schlechtes Foto? Kein Problem!
      </Button>
      {open &&
        createPortal(
          <Dialog open={open} onClose={() => setOpen(false)} title="Universal Facial Reference Optimization" wide>
            <div className="space-y-4" data-testid="reference-prompt-modal">
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={copy} data-testid="reference-prompt-copy">
                  <Copy size={16} /> Elite-Prompt kopieren
                </Button>
                <span aria-live="polite" className="text-sm">
                  {state === "ok" && (
                    <span className="inline-flex items-center gap-1.5 text-mint" data-testid="reference-prompt-copied">
                      <CheckCircle2 size={16} /> Prompt erfolgreich kopiert
                    </span>
                  )}
                  {state === "failed" && (
                    <span className="inline-flex items-center gap-1.5 text-[#ff8fa3]" data-testid="reference-prompt-copy-failed">
                      <XCircle size={16} /> {t("referencePrompt.copyFailed")}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex gap-2.5 rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-fg-1" data-testid="reference-prompt-hint">
                <Info size={18} className="mt-0.5 shrink-0 text-cyan" />
                <p>So funktioniert&apos;s: Kopiere den Prompt, füge ihn zusammen mit deinem Originalbild in ChatGPT ein und aktiviere den Modus ‚Intensives Nachdenken‘. ChatGPT erstellt anschließend eine technisch optimierte Version deines Fotos, die du hier wieder hochladen und für deine Analyse verwenden kannst.</p>
              </div>
              <div className="rounded-xl border border-line bg-bg-1/60 px-4 py-4 sm:px-5" data-testid="reference-prompt-text" lang="de">
                {REFERENCE_PROMPT.split("\n").map((line, i) =>
                  line === "" ? (
                    <div key={i} className="h-2.5" aria-hidden />
                  ) : (
                    <p key={i} className={cn("whitespace-pre-wrap break-words text-[15px] leading-relaxed", isHeading(line) ? "font-display font-semibold text-fg-0 tracking-wide pt-2" : "text-fg-1", i === 0 && "pt-0 text-base")}>
                      {line}
                    </p>
                  ),
                )}
              </div>
            </div>
          </Dialog>,
          document.body,
        )}
    </>
  );
}
