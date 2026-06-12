import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";

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

export const metadata: Metadata = {
  title: "EvoSync — Disparador via Evolution API",
  description:
    "EvoSync — Disparador em massa de mensagens WhatsApp via Evolution API. UI web profissional em Next.js.",
};

export const viewport: Viewport = {
  themeColor: "#0b1411",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <Providers>
          <TooltipProvider delayDuration={150}>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
