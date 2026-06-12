"use client";

import { Suspense, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cable, LogIn, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      router.push(res.url || callbackUrl);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-border bg-panel-alt p-6 space-y-4 shadow-lg shadow-black/30"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-soft">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Entrar
      </Button>
    </form>
  );
}

function LoginFormFallback() {
  return (
    <div className="rounded-lg border border-border bg-panel-alt p-6 space-y-4 shadow-lg shadow-black/30">
      <div className="h-10 bg-panel/50 rounded animate-pulse" />
      <div className="h-10 bg-panel/50 rounded animate-pulse" />
      <div className="h-10 bg-panel/50 rounded animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cable className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-text">EvoSync</h1>
            <p className="text-sm text-muted mt-1">Painel administrativo</p>
          </div>
        </div>

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-muted mt-4">
          Acesso restrito a administradores e usuários autorizados.
        </p>
      </div>
    </div>
  );
}
