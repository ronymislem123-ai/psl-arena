"use client";
/**
 * Page wrapper of the browser edition. Server pages read the database while
 * rendering; here the page waits for the local database, then calls `load`
 * synchronously with the same repository functions and renders the result. It
 * re-runs whenever the data changes (after a write in this or another tab) or the
 * query string changes, which replaces router.refresh() of the server app.
 */
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/config/brand";
import { LEGACY_USER_ID } from "@/server/db-schema";
import { getDataVersion, subscribeDataVersion } from "./data-version";
import { ensureLocalDb, isLocalDbReady } from "./runtime";

export interface LocalContext {
  userId: string;
  query: URLSearchParams;
}

type Loader = (ctx: LocalContext) => ReactNode | null;

export function LocalPage({ title, load }: { title?: string; load: Loader }) {
  return (
    <Suspense fallback={<LocalLoading />}>
      <LocalPageInner title={title} load={load} />
    </Suspense>
  );
}

function LocalPageInner({ title, load }: { title?: string; load: Loader }) {
  const params = useSearchParams();
  const version = useSyncExternalStore(subscribeDataVersion, getDataVersion, () => 0);
  const [ready, setReady] = useState(isLocalDbReady);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    ensureLocalDb().then(
      () => alive && setReady(true),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [ready]);

  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : BRAND.name;
  }, [title]);

  if (error) return <LocalError message={error} />;
  if (!ready) return <LocalLoading />;
  let content: ReactNode | null;
  try {
    content = load({ userId: LEGACY_USER_ID, query: new URLSearchParams(params.toString()) });
  } catch (e) {
    return <LocalError message={e instanceof Error ? e.message : String(e)} />;
  }
  // `version` is read so that a data change re-renders this component and re-runs `load`.
  return <div data-data-version={version}>{content ?? <LocalNotFound />}</div>;
}

export function LocalLoading() {
  const { t } = useT();
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-fg-2" data-testid="local-loading">
      <Loader2 size={18} className="animate-spin" /> {t("browser.loading")}
    </div>
  );
}

export function LocalNotFound() {
  const { t } = useT();
  return (
    <Card className="mx-auto mt-10 max-w-lg" data-testid="local-not-found">
      <CardBody className="space-y-4 text-center">
        <SearchX size={28} className="mx-auto text-fg-3" />
        <p className="text-sm text-fg-2">{t("browser.notFound")}</p>
        <Link href="/"><Button variant="outline" size="sm">{t("browser.backHome")}</Button></Link>
      </CardBody>
    </Card>
  );
}

function LocalError({ message }: { message: string }) {
  const { t } = useT();
  return (
    <Card className="mx-auto mt-10 max-w-lg" data-testid="local-error">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} className="text-amber" /> {t("browser.errorTitle")}</div>
        <p className="text-sm text-fg-2">{t("browser.errorHint")}</p>
        <p className="font-mono text-xs text-fg-3 break-all">{message}</p>
      </CardBody>
    </Card>
  );
}

/** Client-side replacement for redirect() in server pages. */
export function LocalRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return <LocalLoading />;
}
