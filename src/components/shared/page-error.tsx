"use client";
/**
 * Error boundary for every page: instead of Next's blank "Application error" the
 * user sees what went wrong (the message helps when reporting a problem) and can
 * retry without reloading — battle and rater selections survive a reload anyway.
 */
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-lg" data-testid="page-error">
      <CardBody className="space-y-4 pt-5">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle size={18} className="text-amber" /> {t("errors.title")}
        </div>
        <p className="text-sm text-fg-2">{t("errors.hint")}</p>
        <p className="font-mono text-xs text-fg-3 break-all">{error.message || String(error)}{error.digest ? ` (${error.digest})` : ""}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={reset}>
            <RotateCcw size={14} /> {t("errors.retry")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> {t("errors.reload")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
