import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { getCurrentUser } from "@/server/auth";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
};

export const viewport: Viewport = { themeColor: "#07080a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers user={user ? { email: user.email, name: user.name } : null}>{children}</Providers>
      </body>
    </html>
  );
}
