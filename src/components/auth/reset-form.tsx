"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Zap } from "lucide-react";
import { BRAND } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function ResetForm({ next }: { next?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("auth.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.resetPassword({ email, code, newPassword: password });
      setDone(res.remainingCodes > 0 ? t("auth.resetDone", { n: res.remainingCodes }) : t("auth.resetDoneNoCodes"));
      setTimeout(() => {
        router.push(res.remainingCodes > 0 ? target : "/settings");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        <form onSubmit={submit} className="glass-strong rounded-3xl p-6 md:p-8 space-y-5" data-testid="auth-reset">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <KeyRound size={20} className="text-amber" /> {t("auth.resetTitle")}
            </h1>
            <p className="mt-1 text-sm text-fg-2">{t("auth.resetSub")}</p>
          </div>
          <Field label={t("auth.email")}>
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label={t("auth.recoveryCode")}>
            <Input type="text" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("auth.recoveryCodePlaceholder")} className="font-mono tracking-wider uppercase" />
          </Field>
          <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
            <Input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={t("auth.confirm")}>
            <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && (
            <div className="rounded-xl bg-rose-soft border border-rose/30 px-3 py-2 text-sm text-[#ff8fa3]" role="alert">
              {error}
            </div>
          )}
          {done && (
            <div className="rounded-xl bg-mint-soft border border-mint/30 px-3 py-2 text-sm text-mint" role="status">
              {done}
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!!done}>
            {t("auth.resetAction")}
          </Button>
          <div className="text-center text-sm text-fg-2">
            <Link href="/login" className="text-accent hover:underline">
              {t("auth.loginAction")}
            </Link>
          </div>
        </form>
        <p className="mt-6 text-center text-xs text-fg-3">{t("auth.noEmailNote")}</p>
      </div>
    </div>
  );
}
