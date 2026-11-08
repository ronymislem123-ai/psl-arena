"use client";
import type { ReactNode } from "react";
import { downloadApi } from "@/lib/api";
import { IS_STATIC } from "@/lib/base-path";

/**
 * Link to a GET /api/... export. Server app: a normal link (download or new tab).
 * Browser edition: there is no server URL, so the click runs the route in the page
 * and saves the response as a file.
 */
export function ApiLink({ href, children, newTab, className }: { href: string; children: ReactNode; newTab?: boolean; className?: string }) {
  if (!IS_STATIC) {
    return newTab ? (
      <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>
    ) : (
      <a href={href} download className={className}>{children}</a>
    );
  }
  return (
    <a
      href="#"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        downloadApi(href).catch((err: unknown) => alert(err instanceof Error ? err.message : String(err)));
      }}
    >
      {children}
    </a>
  );
}
