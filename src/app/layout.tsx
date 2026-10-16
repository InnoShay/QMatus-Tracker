import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { CursorEffects } from "@/components/fx/cursor-effects";
import { Toaster } from "@/components/ui/toast";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "QMatus Team Tracker", template: "%s · QMatus" },
  description: "Private work tracker for the QMatus team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F4F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0B0E" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The theme is a cookie so the server renders the right tokens before first
  // paint: no flash, no blocking script.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas text-fg antialiased">
        {children}
        <Toaster />
        <CursorEffects />
      </body>
    </html>
  );
}
