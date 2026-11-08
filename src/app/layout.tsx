import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { getCurrentUser } from "@/server/auth";
import { Providers } from "./providers";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND.name },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  // the app ships its own German translation; browser page translation breaks React (see lib/dom-guard.ts)
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#07080a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <body>
        <Providers user={user ? { email: user.email, name: user.name } : null}>{children}</Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
