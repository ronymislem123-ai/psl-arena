"use client";
import { useEffect } from "react";
import { BASE_PATH } from "@/lib/base-path";

/** Registers the service worker in production builds (dev keeps HMR untouched). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch((e) => console.warn("[pwa] service worker registration failed", e));
  }, []);
  return null;
}
