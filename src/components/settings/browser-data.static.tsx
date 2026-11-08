"use client";
/** Browser edition: storage status, backup download and restore of the local database. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, HardDrive, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { saveBlob } from "@/static/backend";
import { BackupError, exportDatabase, isPersistent, requestPersistentStorage, restoreDatabase, storageEstimate } from "@/static/runtime";

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

type Msg = { tone: "ok" | "warn" | "err"; text: string };

export function BrowserDataCard() {
  const { t } = useT();
  const [est, setEst] = useState<{ usage: number; quota: number; persisted: boolean | null } | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => {
    void storageEstimate().then(setEst);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const backup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const bytes = await exportDatabase();
      saveBlob(new Blob([bytes.slice()], { type: "application/vnd.sqlite3" }), `psl-arena-backup-${new Date().toISOString().slice(0, 10)}.sqlite`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    if (!confirm(t("browser.restoreConfirm"))) return;
    setBusy(true);
    setMsg(null);
    try {
      await restoreDatabase(new Uint8Array(await file.arrayBuffer()));
      setMsg({ tone: "ok", text: t("browser.restored") });
      refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      const text = e instanceof BackupError ? (code === "not-sqlite" ? t("browser.notSqlite") : t("browser.notBrowserBackup")) : code;
      setMsg({ tone: "err", text: t("browser.restoreFailed", { error: text }) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const protect = async () => {
    const granted = await requestPersistentStorage();
    if (granted === false) setMsg({ tone: "warn", text: t("browser.protectDenied") });
    refresh();
  };

  return (
    <Card className="lg:col-span-2" data-testid="browser-data-card">
      <CardHeader title={t("browser.title")} icon={<HardDrive size={18} />} subtitle={t("browser.sub")} />
      <CardBody className="space-y-4">
        {!isPersistent() && <div className="rounded-xl bg-amber-soft border border-amber/30 px-3 py-2 text-sm text-amber">{t("browser.notPersistent")}</div>}
        {est && (
          <div className="space-y-1.5 text-sm text-fg-2">
            <div>{t("browser.usage", { used: fmtBytes(est.usage), quota: fmtBytes(est.quota) })}</div>
            {est.persisted ? (
              <div className="flex items-center gap-2 text-mint"><ShieldCheck size={14} /> {t("browser.persisted")}</div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span>{t("browser.notPersisted")}</span>
                <Button size="sm" variant="ghost" onClick={protect}>{t("browser.protect")}</Button>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={backup} loading={busy} data-testid="backup-download">
            <Download size={14} /> {t("browser.backup")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="backup-restore">
            <Upload size={14} /> {t("browser.restore")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".sqlite,application/vnd.sqlite3,application/x-sqlite3,application/octet-stream"
            className="hidden"
            data-testid="backup-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
            }}
          />
        </div>
        <p className="text-xs text-fg-3">{t("browser.backupHint")}</p>
        {msg && <div className={msg.tone === "ok" ? "text-sm text-mint" : msg.tone === "warn" ? "text-sm text-amber" : "text-sm text-[#ff8fa3]"} role="status">{msg.text}</div>}
      </CardBody>
    </Card>
  );
}
