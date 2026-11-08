import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { Providers } from "./providers";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

/** Root layout of the browser edition (static export): no accounts, data in this browser. */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND.name },
  icons: { icon: `${BASE}/icon.svg`, apple: `${BASE}/icons/apple-touch-icon.png` },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#07080a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers user={null}>{children}</Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
