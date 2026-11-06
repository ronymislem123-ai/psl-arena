"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Toggle } from "@/components/ui/controls";
import { RecoveryCodes } from "@/components/auth/recovery-codes";
import { PageHeader } from "@/components/layout/app-shell";
import { BRAND } from "@/config/brand";
import { ENGINE_VERSION } from "@/engine/analysis";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { fmt } from "@/lib/utils";
import type { CaptureDistance } from "@/engine/types";

export interface AccountInfo {
  email: string;
  name: string;
  createdAt: string;
}

export function SettingsView({ account }: { account: AccountInfo }) {
  const { t } = useT();
  const s = useSettings();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const deleteAll = async () => {
    if (!confirm(t("settings.deleteAllConfirm"))) return;
    await api.deleteAll();
    setMsg(t("settings.deleted"));
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("nav.settings")} title={t("settings.title")} />
      <div className="grid gap-5 lg:grid-cols-2">
        <AccountCard account={account} />
        <RecoveryCard />
        <Card>
          <CardHeader title={t("settings.appearance")} />
          <CardBody className="space-y-2">
            <Field label={t("settings.language")}>
              <Select value={s.language} onChange={(e) => s.set({ language: e.target.value as "en" | "de" })} className="w-full">
                <option value="en">{t("settings.english")}</option>
                <option value="de">{t("settings.german")}</option>
              </Select>
            </Field>
            <Toggle checked={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} label={t("settings.reducedMotion")} hint={t("settings.reducedMotionHint")} />
            <Toggle checked={s.showMeshByDefault} onChange={(v) => s.set({ showMeshByDefault: v })} label={t("settings.showMesh")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.analysisOptions")} />
          <CardBody className="space-y-3">
            <Toggle checked={s.includeReconstructed} onChange={(v) => s.set({ includeReconstructed: v })} label={t("battle.includeReconstructed")} hint={t("battle.includeReconstructedHint")} />
            <Field label={t("battle.captureDistance")}>
              <Select value={s.defaultCaptureDistance} onChange={(e) => s.set({ defaultCaptureDistance: e.target.value as CaptureDistance })} className="w-full">
                <option value="unknown">{t("battle.captureUnknown")}</option>
                <option value="selfie">{t("battle.captureSelfie")}</option>
                <option value="standard">{t("battle.captureStandard")}</option>
              </Select>
            </Field>
            <Field label={t("settings.uncertaintySamples")}>
              <Select value={s.uncertaintySamples} onChange={(e) => s.set({ uncertaintySamples: Number(e.target.value) })} className="w-full">
                {[0, 20, 40, 80, 120].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.privacy")} icon={<ShieldCheck size={18} />} subtitle={t("settings.privacyNote")} />
          <CardBody className="space-y-3">
            <Toggle checked={s.storeImagesByDefault} onChange={(v) => s.set({ storeImagesByDefault: v })} label={t("battle.storeImages")} hint={t("battle.storeImagesHint")} />
            <div className="flex flex-wrap gap-2 pt-2">
              <a href="/api/data" download>
                <Button variant="outline" size="sm">
                  <Download size={14} /> {t("settings.exportData")}
                </Button>
              </a>
              <Button variant="danger" size="sm" onClick={deleteAll}>
                <Trash2 size={14} /> {t("settings.deleteAll")}
              </Button>
            </div>
            {msg && <div className="text-sm text-mint">{msg}</div>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.about")} />
          <CardBody className="text-sm text-fg-2 space-y-2">
            <div className="font-mono text-xs">
              {BRAND.name} v{BRAND.version} · engine {ENGINE_VERSION} · MediaPipe Face Landmarker (478 points) · runs in-browser
            </div>
            <p>{t("settings.ethics")}</p>
            <p className="text-xs text-fg-3">Reference ranges come from a community facial-harmony guide and are not validated beauty standards. See docs/RATIOS.md and docs/SCORING.md in the repository.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AccountCard({ account }: { account: AccountInfo }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const changePw = () =>
    run(async () => {
      if (next !== confirm) throw new Error(t("auth.mismatch"));
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      return t("auth.passwordChanged");
    });
  const logoutOthers = () =>
    run(async () => {
      await api.logoutOthers();
      return t("auth.sessionsCleared");
    });
  const logout = () =>
    run(async () => {
      await api.logout();
      router.push("/login");
      router.refresh();
    });
  const deleteAcc = () =>
    run(async () => {
      if (!window.confirm(t("auth.deleteAccountConfirm"))) return;
      await api.deleteAccount(deletePw);
      router.push("/signup");
      router.refresh();
    });

  return (
    <Card className="lg:col-span-2">
      <CardHeader title={t("auth.account")} icon={<UserRound size={18} />} subtitle={`${t("auth.signedInAs")} ${account.email} · ${t("auth.memberSince")} ${fmt.date(account.createdAt, lang)}`} />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void changePw();
          }}
        >
          <div className="text-sm font-medium flex items-center gap-2">
            <KeyRound size={16} className="text-cyan" /> {t("auth.changePassword")}
          </div>
          <Field label={t("auth.currentPassword")}>
            <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
            <Input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label={t("auth.confirm")}>
            <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy}>
              {t("auth.changePassword")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={logoutOthers} disabled={busy}>
              <LogOut size={14} /> {t("auth.logoutAll")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={logout} disabled={busy} data-testid="settings-logout">
              {t("auth.logout")}
            </Button>
          </div>
        </form>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void deleteAcc();
          }}
        >
          <div className="text-sm font-medium flex items-center gap-2 text-[#ff8fa3]">
            <Trash2 size={16} /> {t("auth.deleteAccount")}
          </div>
          <p className="text-xs text-fg-3">{t("auth.deleteAccountHint")}</p>
          <Field label={t("auth.password")}>
            <Input type="password" autoComplete="current-password" required value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" variant="danger" disabled={busy || !deletePw}>
            <Trash2 size={14} /> {t("auth.deleteAccount")}
          </Button>
          {msg && <div className="text-sm text-mint">{msg}</div>}
          {err && (
            <div className="text-sm text-[#ff8fa3]" role="alert">
              {err}
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

function RecoveryCard() {
  const { t } = useT();
  const [status, setStatus] = useState<{ remaining: number; total: number } | null>(null);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.recoveryStatus().then(setStatus).catch(() => setStatus(null));
  }, []);
  const regenerate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.regenerateCodes(password);
      setCodes(res.codes);
      setStatus({ remaining: res.remaining, total: res.total });
      setPassword("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={t("auth.recovery")}
        icon={<KeyRound size={18} />}
        subtitle={status ? (status.remaining > 0 ? t("auth.codesRemaining", { n: status.remaining, total: status.total }) : t("auth.codesNone")) : "…"}
        action={status && status.remaining > 0 && status.remaining <= 2 ? <span className="text-xs text-amber">{t("auth.codesWarnLow", { n: status.remaining })}</span> : undefined}
      />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void regenerate();
          }}
        >
          <div className="text-sm font-medium">{t("auth.codesRegenerate")}</div>
          <p className="text-xs text-fg-3">{t("auth.codesRegenerateHint")}</p>
          <Field label={t("auth.password")}>
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" variant="outline" loading={busy} disabled={!password} data-testid="regenerate-codes">
            <KeyRound size={14} /> {t("auth.codesRegenerate")}
          </Button>
          {err && (
            <div className="text-sm text-[#ff8fa3]" role="alert">
              {err}
            </div>
          )}
          <p className="text-xs text-fg-3">{t("auth.noEmailNote")}</p>
        </form>
        <div>
          {codes ? (
            <>
              <div className="text-sm font-medium mb-2">{t("auth.codesNew")}</div>
              <RecoveryCodes codes={codes} compact />
              <p className="mt-2 text-xs text-fg-3">{t("auth.codesSub")}</p>
            </>
          ) : (
            <p className="text-sm text-fg-3">{t("auth.codesSub")}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
