import { Suspense } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  MessageCircle,
  Shield,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import InviteAcceptForm, { InviteFormFallback } from "./form";

export const dynamic = "force-dynamic";

export default function InvitePage() {
  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Painel esquerdo — brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-sunken">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 h-full w-full bg-gradient-radial" />
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse-soft" />
          <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-info/15 blur-3xl animate-pulse-soft" />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>

        <div className="relative flex flex-col justify-between p-12 w-full">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-primary/40 blur-md" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-elev-2 shadow-primary/40">
                  <BrandMark className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold font-display text-foreground">
                  EvoSync
                </div>
                <div className="text-2xs uppercase tracking-widest text-muted-foreground">
                  by Arasaka Lab
                </div>
              </div>
            </Link>
            <ThemeToggle />
          </div>

          <div className="space-y-6 max-w-md">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-subtle px-3 py-1 text-xs font-medium text-primary">
              <UserPlus className="h-3 w-3" />
              Convite exclusivo
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold font-display tracking-tight text-foreground leading-[1.1]">
              Entre na equipe e comece a
              <span className="text-gradient-primary"> disparar em minutos.</span>
            </h1>
            <p className="text-base text-muted-foreground max-w-md leading-relaxed">
              Crie sua conta, conecte o WhatsApp da empresa e gerencie contatos,
              mensagens e campanhas em um painel feito para operação em escala.
            </p>

            <ul className="space-y-2.5 pt-2">
              {[
                { icon: Building2, text: "Acesso ao workspace da sua empresa" },
                { icon: MessageCircle, text: "Conexão WhatsApp via QR code" },
                { icon: Shield, text: "Ambiente seguro com convite de uso único" },
              ].map((feat) => (
                <li
                  key={feat.text}
                  className="flex items-center gap-2.5 text-sm text-foreground/80"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-subtle ring-1 ring-primary/20">
                    <feat.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  {feat.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Link válido por tempo limitado
            </span>
            <span className="mx-2 text-border">·</span>
            {new Date().getFullYear()} Arasaka Lab
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex justify-end p-4 lg:hidden">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-elev-2 shadow-primary/40">
                <BrandMark className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold font-display text-foreground">
                  Aceitar convite
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  EvoSync · Arasaka Lab
                </p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-subtle ring-1 ring-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Onboarding
                </p>
                <h2 className="text-xl font-bold font-display text-foreground">
                  Crie sua conta
                </h2>
              </div>
            </div>

            <Suspense fallback={<InviteFormFallback />}>
              <InviteAcceptForm />
            </Suspense>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Já tem conta?{" "}
              <Link
                href="/admin/login"
                className="text-primary hover:underline underline-offset-2"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="6" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="12" cy="18" r="2" fill="currentColor" />
      <path d="M7.5 7.5L11 16.5" />
      <path d="M16.5 7.5L13 16.5" />
      <path d="M8 6H16" />
    </svg>
  );
}
