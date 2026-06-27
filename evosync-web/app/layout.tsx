import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers";
import { resolvePublicAppUrl } from "@/lib/app-url";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EvoSync — Painel administrativo",
  description:
    "EvoSync — Disparador em massa de mensagens WhatsApp via Evolution API. UI web profissional em Next.js.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1411" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publicAppUrl = resolvePublicAppUrl(await headers());

  return (
    <html
      lang="pt-BR"
      data-public-app-url={publicAppUrl}
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} ${mono.variable} ${display.variable} font-sans`}
      >
        <Providers>
          <TooltipProvider delayDuration={150}>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
