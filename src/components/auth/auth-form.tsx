"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, UserPlus, Zap } from "lucide-react";
import { BRAND } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { RecoveryCodes } from "./recovery-codes";

export function AuthForm({ mode, next, signupAllowed = true, firstAccount = false }: { mode: "login" | "signup"; next?: string; signupAllowed?: boolean; firstAccount?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mfa, setMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const finish = () => {
    router.push(target);
    router.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password !== confirm) {
      setError(t("auth.mismatch"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await api.signup({ email, password, name: name || undefined });
        setCodes(res.recoveryCodes ?? []);
        return;
      }
      const res = await api.login({ email, password });
      if (res.mfaRequired) {
        setMfa(true);
        return;
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.loginTotp(useRecovery ? { recoveryCode: mfaCode } : { code: mfaCode });
      if (res.usedRecoveryCode) {
        setNotice(t("auth.mfaRecoveryUsed", { n: res.remainingCodes ?? 0 }));
        setTimeout(finish, 1500);
        return;
      }
      finish();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (/sign in again/i.test(msg)) {
        setMfa(false);
        setMfaCode("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/20 text-accent">
            <Zap size={18} />
          </span>
          <span className="font-display font-bold tracking-[0.14em]">{BRAND.name}</span>
        </div>
        {mfa ? (
          <form onSubmit={submitMfa} className="glass-strong rounded-3xl p-6 md:p-8 space-y-5" data-testid="auth-mfa">
            <div>
              <h1 className="font-display text-2xl font-bold flex items-center gap-2">
                <ShieldCheck size={20} className="text-cyan" /> {t("auth.mfaTitle")}
              </h1>
              <p className="mt-1 text-sm text-fg-2">{useRecovery ? t("auth.resetSub").split(",")[0] : t("auth.mfaSub")}</p>
            </div>
            <Field label={useRecovery ? t("auth.recoveryCode") : t("auth.mfaCode")}>
              <Input
                type="text"
                inputMode={useRecovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoFocus
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder={useRecovery ? t("auth.recoveryCodePlaceholder") : "123456"}
                className="font-mono tracking-[0.3em] text-lg text-center"
                maxLength={useRecovery ? 12 : 6}
              />
            </Field>
            {error && (
              <div className="rounded-xl bg-rose-soft border border-rose/30 px-3 py-2 text-sm text-[#ff8fa3]" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl bg-mint-soft border border-mint/30 px-3 py-2 text-sm text-mint" role="status">
                {notice}
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!!notice}>
              <ShieldCheck size={18} /> {t("auth.mfaAction")}
            </Button>
            <div className="text-center text-sm">
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setMfaCode("");
                  setError(null);
                }}
              >
                {useRecovery ? t("auth.mfaUseApp") : t("auth.mfaUseRecovery")}
              </button>
            </div>
          </form>
        ) : codes ? (
          <div className="glass-strong rounded-3xl p-6 md:p-8">
            <RecoveryCodes codes={codes} onContinue={finish} />
          </div>
        ) : (
        <form onSubmit={submit} className="glass-strong rounded-3xl p-6 md:p-8 space-y-5" data-testid={`auth-${mode}`}>
          <div>
            <h1 className="font-display text-2xl font-bold">{mode === "login" ? t("auth.loginTitle") : t("auth.signupTitle")}</h1>
            <p className="mt-1 text-sm text-fg-2">{mode === "login" ? t("auth.loginSub") : firstAccount ? t("auth.firstAccount") : t("auth.signupSub")}</p>
          </div>
          {mode === "signup" && !signupAllowed && <div className="rounded-xl bg-amber-soft border border-amber/30 px-3 py-2 text-sm text-amber">{t("auth.signupDisabled")}</div>}
          <Field label={t("auth.email")}>
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          {mode === "signup" && (
            <Field label={t("auth.name")} hint={t("auth.nameHint")}>
              <Input type="text" autoComplete="nickname" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field label={t("auth.password")} hint={mode === "signup" ? t("auth.passwordHint") : undefined}>
            <Input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 10 : 1} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {mode === "login" && (
            <div className="-mt-2 text-right text-xs">
              <Link href={`/reset${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-fg-2 hover:text-fg-0 underline underline-offset-2">
                {t("auth.forgot")}
              </Link>
            </div>
          )}
          {mode === "signup" && (
            <Field label={t("auth.confirm")}>
              <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          )}
          {error && (
            <div className="rounded-xl bg-rose-soft border border-rose/30 px-3 py-2 text-sm text-[#ff8fa3]" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={mode === "signup" && !signupAllowed}>
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === "login" ? t("auth.loginAction") : t("auth.signupAction")}
          </Button>
          <div className="text-center text-sm text-fg-2">
            {mode === "login" ? (
              <>
                {t("auth.noAccount")}{" "}
                <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent hover:underline">
                  {t("auth.signupAction")}
                </Link>
              </>
            ) : (
              <>
                {t("auth.haveAccount")}{" "}
                <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent hover:underline">
                  {t("auth.loginAction")}
                </Link>
              </>
            )}
          </div>
        </form>
        )}
        <p className="mt-6 text-center text-xs text-fg-3">{t("auth.localNote")}</p>
      </div>
    </div>
  );
}
