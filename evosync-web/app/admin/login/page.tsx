"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
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
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="h-[100dvh] w-full flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* === LADO ESQUERDO: brand (desktop) === */}
      <div className="hidden lg:flex lg:w-1/2 lg:max-w-[720px] lg:shrink-0 relative h-full overflow-hidden bg-surface-sunken">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 h-full w-full bg-gradient-radial" />
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse-soft" />
          <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-info/15 blur-3xl animate-pulse-soft" />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>

        <div className="relative flex flex-col h-full w-full overflow-hidden">
          <header className="shrink-0 flex items-center justify-between gap-4 px-10 xl:px-14 pt-8 xl:pt-10 pb-2">
            <Link href="/" className="flex items-center gap-3 group min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl bg-primary/40 blur-md" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-elev-2 shadow-primary/40">
                  <BrandMark className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-lg font-bold font-display text-foreground">
                  EvoSync
                </div>
                <div className="text-2xs uppercase tracking-widest text-muted-foreground">
                  by Arasaka Lab
                </div>
              </div>
            </Link>
            <ThemeToggle />
          </header>

          <main className="flex-1 flex flex-col justify-center min-h-0 px-10 xl:px-14 py-4 xl:py-6">
            <div className="w-full max-w-lg space-y-5 xl:space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-subtle px-3.5 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Disparador profissional para WhatsApp
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl xl:text-4xl font-bold font-display tracking-tight text-foreground leading-[1.15]">
                  Suas campanhas no WhatsApp dos clientes.
                  <span className="mt-2 block text-gradient-primary">
                    Direto, pessoal, em escala.
                  </span>
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Importe seus contatos, escreva a mensagem usando{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                    {"{nome}"}
                  </code>{" "}
                  e{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                    {"{empresa}"}
                  </code>
                  , e dispare para quem você quiser, na hora que quiser. A gente
                  cuida dos delays, do aquecimento da conta e do respeito a quem
                  pediu pra sair.
                </p>
              </div>

              <ul className="space-y-3 border-t border-border/60 pt-5 xl:pt-6">
                {[
                  { icon: Zap, text: "Conecte seu WhatsApp em 1 minuto, escaneando QR" },
                  { icon: Shield, text: "Delays aleatórios + aquecimento gradual anti-ban" },
                  {
                    icon: CheckCircle2,
                    text: "Personalize cada mensagem com {nome}, {empresa}, {cidade}",
                  },
                ].map((feat) => (
                  <li
                    key={feat.text}
                    className="flex items-start gap-3 text-sm text-foreground/85 leading-relaxed"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle ring-1 ring-primary/20">
                      <feat.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="pt-1">{feat.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </main>

          <footer className="shrink-0 px-10 xl:px-14 pb-6 xl:pb-8 pt-2 text-xs text-muted-foreground">
            v1.1.0 · Next.js 14 ·{" "}
            <span className="text-foreground/60">
              {new Date().getFullYear()} Arasaka Lab
            </span>
          </footer>
        </div>
      </div>

      {/* === LADO DIREITO: formulário === */}
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-y-auto no-scrollbar lg:overflow-hidden">
        <div className="flex justify-end p-3 sm:p-4 lg:hidden shrink-0">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center min-h-0 px-5 sm:px-8 lg:px-12 py-4 sm:py-6 lg:py-8">
          <div className="w-full max-w-[420px]">
            {/* Brand mobile / tablet */}
            <div className="lg:hidden mb-6 sm:mb-8">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-elev-2 shadow-primary/40">
                  <BrandMark className="h-6 w-6 text-white" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
                    EvoSync
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Painel administrativo
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/80 p-5 sm:p-7 shadow-elev-1 backdrop-blur-sm">
              <div className="mb-6 space-y-1.5">
                <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">
                  <span className="lg:hidden">Entrar</span>
                  <span className="hidden lg:inline">Bem-vindo de volta</span>
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Acesse sua conta para gerenciar campanhas, contatos e conexões.
                </p>
              </div>

              <Suspense fallback={<LoginFormFallback />}>
                <LoginForm />
              </Suspense>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed px-2">
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
