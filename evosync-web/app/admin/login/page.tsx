"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (!res || res.error) {
        setError("Email ou senha incorretos.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          E-mail
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            autoFocus
            disabled={pending}
            className="pl-10 h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          Senha
        </Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={pending}
            className="pl-10 h-11"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-foreground animate-fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        variant="gradient"
        className="w-full group"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            Entrar
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-4 w-12 shimmer rounded" />
        <div className="h-11 shimmer rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 shimmer rounded" />
        <div className="h-11 shimmer rounded-lg" />
      </div>
      <div className="h-11 shimmer rounded-lg" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* === LADO ESQUERDO: brand/ilustração === */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-sunken">
        {/* Decorative gradients */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 h-full w-full bg-gradient-radial" />
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse-soft" />
          <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-info/15 blur-3xl animate-pulse-soft" />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>

        <div className="relative flex flex-col justify-between p-12 w-full">
          {/* Top: logo + theme toggle */}
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

          {/* Middle: hero */}
          <div className="space-y-6 max-w-md">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-subtle px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Disparador profissional para WhatsApp
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold font-display tracking-tight text-foreground leading-[1.1]">
              Suas campanhas no WhatsApp dos clientes.
              <span className="text-gradient-primary"> Direto, pessoal, em escala.</span>
            </h1>
            <p className="text-base text-muted-foreground max-w-md leading-relaxed">
              Importe seus contatos, escreva a mensagem usando{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                {"{nome}"}
              </code>{" "}
              e{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                {"{empresa}"}
              </code>
              , e dispare para quem você quiser, na hora que quiser. A gente
              cuida dos delays, do aquecimento da conta e do respeito a quem
              pediu pra sair.
            </p>

            {/* Feature pills */}
            <ul className="space-y-2.5 pt-2">
              {[
                { icon: Zap, text: "Conecte seu WhatsApp em 1 minuto, escaneando QR" },
                { icon: Shield, text: "Delays aleatórios + aquecimento gradual anti-ban" },
                { icon: CheckCircle2, text: "Personalize cada mensagem com {nome}, {empresa}, {cidade}" },
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

          {/* Bottom: footer */}
          <div className="text-xs text-muted-foreground">
            v1.1.0 · Next.js 14 ·{" "}
            <span className="text-foreground/60">
              {new Date().getFullYear()} Arasaka Lab
            </span>
          </div>
        </div>
      </div>

      {/* === LADO DIREITO: form === */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-4 lg:hidden">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-sm">
            {/* Mobile-only brand */}
            <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-elev-2 shadow-primary/40">
                <BrandMark className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold font-display text-foreground">
                  EvoSync
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Painel administrativo
                </p>
              </div>
            </div>

            {/* Header (desktop) */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">
                Bem-vindo de volta
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Acesse sua conta para gerenciar tenants e licenças.
              </p>
            </div>

            <Suspense fallback={<LoginFormFallback />}>
              <LoginForm />
            </Suspense>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Acesso restrito a super admins e usuários autorizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  // Logo conceitual: 3 nós conectados por curvas (sincronização/conexão)
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
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
