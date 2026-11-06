"use client";
import { useEffect } from "react";

/** Registers the service worker in production builds (dev keeps HMR untouched). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[pwa] service worker registration failed", e));
  }, []);
  return null;
}
