"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, XCircle, ArrowRight } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; email: string; tenantName: string }
  | { kind: "submitting" }
  | { kind: "signingIn"; email: string; tenantName: string }
  | { kind: "error"; message: string };

export default function InviteAcceptForm() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invites/${encodeURIComponent(params.token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "invalid", reason: data.error || "Convite inválido" });
        } else {
          setState({
            kind: "valid",
            email: data.invite.email,
            tenantName: data.tenantName,
          });
        }
      } catch (e: any) {
        if (!cancelled) setState({ kind: "invalid", reason: "Erro de rede" });
      }
    })();
    return () => { cancelled = true; };
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "valid") return;
    if (password !== confirm) {
      setState({ kind: "error", message: "As senhas não conferem" });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error || "Erro ao aceitar convite" });
        return;
      }

      // Mostra "Conectando..." enquanto o signIn acontece. Evita a
      // "tela escura" que aparecia antes (estado "done" muito breve
      // sem feedback visual, seguido de navegação client-side com
      // race condition no cookie).
      setState({
        kind: "signingIn",
        email: data.email,
        tenantName: data.tenantName,
      });

      const signInRes = await signIn("credentials", {
        email: data.email,
        password,
        redirect: false,
        callbackUrl: "/conexao",
      });

      if (signInRes?.error) {
        setState({
          kind: "error",
          message:
            "Conta criada, mas falha no login automático. " +
            "Tente fazer login manualmente.",
        });
        return;
      }

      // Login OK: usa window.location.href (full page navigation) em vez
      // de router.push + router.refresh. Garante que o cookie de sessão
      // foi processado pelo browser antes da próxima request, evitando
      // race condition que causava o redirect de volta pro login.
      window.location.href = "/conexao";
    } catch (e: any) {
      setState({ kind: "error", message: "Erro de rede" });
    }
  }

  if (state.kind === "loading") {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Validando convite…</p>
        </CardContent>
      </Card>
    );
  }

  if (state.kind === "invalid") {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          <XCircle className="h-10 w-10 text-red-500" />
          <h2 className="text-lg font-semibold">Convite inválido</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{state.reason}</p>
          <Button variant="outline" className="mt-2" onClick={() => router.push("/admin/login")}>
            Ir para login
          </Button>
        </CardContent>
      </Card>
    );
  }

  // NOVO: estado "signingIn" — mostra feedback visual claro enquanto
  // o signIn acontece e a navegação é feita. Substitui o antigo "done"
  // que piscava e não dava tempo do usuário ver.
  if (state.kind === "signingIn") {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h2 className="text-lg font-semibold">Conta criada!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Conectando como <strong>{state.email}</strong>…
          </p>
          <p className="text-xs text-muted-foreground">
            Você será redirecionado para o <strong>{state.tenantName}</strong> em instantes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aceitar convite</CardTitle>
        <CardDescription>
          Você foi convidado para entrar em <strong>{state.kind === "valid" ? state.tenantName : ""}</strong> como <strong>{state.kind === "valid" ? state.email : ""}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {state.kind === "error" && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {state.message}
            </div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={state.kind === "submitting" || !name || !password || !confirm}
          >
            {state.kind === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta…
              </>
            ) : (
              <>
                Criar conta e entrar
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
