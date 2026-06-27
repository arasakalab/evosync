"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; email: string; tenantName: string; role?: string }
  | { kind: "submitting" }
  | { kind: "signingIn"; email: string; tenantName: string }
  | { kind: "error"; message: string; email: string; tenantName: string; role?: string };

export function InviteFormFallback() {
  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-elev-1 space-y-5">
      <div className="space-y-2">
        <div className="h-5 w-40 shimmer rounded" />
        <div className="h-4 w-full shimmer rounded" />
      </div>
      <div className="h-16 shimmer rounded-xl" />
      <div className="space-y-2">
        <div className="h-4 w-20 shimmer rounded" />
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

function InviteShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/80 backdrop-blur-sm",
        "shadow-elev-1 overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const label = role === "owner" ? "Owner" : "Operator";
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-2xs font-mono uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

export default function InviteAcceptForm() {
  const params = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invites/${encodeURIComponent(params.token)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "invalid", reason: data.error || "Convite inválido" });
        } else {
          setState({
            kind: "valid",
            email: data.invite.email,
            tenantName: data.tenantName,
            role: data.invite.role,
          });
        }
      } catch {
        if (!cancelled) setState({ kind: "invalid", reason: "Erro de rede" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "valid" && state.kind !== "error") return;
    const { email: inviteEmail, tenantName: inviteTenant, role } = state;
    if (password !== confirm) {
        setState({
          kind: "error",
          message: "As senhas não conferem.",
          email: inviteEmail,
          tenantName: inviteTenant,
          role,
        });
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
        setState({
          kind: "error",
          message: data.error || "Erro ao aceitar convite",
          email: inviteEmail,
          tenantName: inviteTenant,
          role,
        });
        return;
      }

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
            "Conta criada, mas falha no login automático. Tente fazer login manualmente.",
          email: data.email,
          tenantName: data.tenantName,
          role,
        });
        return;
      }

      window.location.href = "/conexao";
    } catch {
      setState({
        kind: "error",
        message: "Erro de rede. Tente novamente.",
        email: inviteEmail,
        tenantName: inviteTenant,
        role,
      });
    }
  }

  if (state.kind === "loading") {
    return <InviteFormFallback />;
  }

  if (state.kind === "invalid") {
    return (
      <InviteShell>
        <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-subtle ring-1 ring-danger/20">
            <XCircle className="h-7 w-7 text-danger" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold font-display text-foreground">
              Convite indisponível
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">{state.reason}</p>
          </div>
          <Button variant="outline" asChild className="mt-2">
            <Link href="/admin/login">Ir para login</Link>
          </Button>
        </div>
      </InviteShell>
    );
  }

  if (state.kind === "signingIn") {
    return (
      <InviteShell>
        <div className="px-6 py-10 flex flex-col items-center text-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-success/30 blur-lg" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-success-subtle ring-1 ring-success/30">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold font-display text-foreground">
              Conta criada!
            </h2>
            <p className="text-sm text-muted-foreground">
              Conectando como{" "}
              <strong className="text-foreground">{state.email}</strong>…
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecionando para <strong>{state.tenantName}</strong>
            </p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </InviteShell>
    );
  }

  const tenantName =
    state.kind === "valid" || state.kind === "error"
      ? state.tenantName
      : "";
  const email =
    state.kind === "valid" || state.kind === "error" ? state.email : "";
  const role =
    state.kind === "valid" || state.kind === "error" ? state.role : undefined;
  const errorMessage = state.kind === "error" ? state.message : null;
  const isSubmitting = state.kind === "submitting";

  return (
    <InviteShell>
      <div className="border-b border-border bg-surface-alt/50 px-6 py-5">
        <h2 className="text-lg font-bold font-display text-foreground lg:hidden">
          Aceitar convite
        </h2>
        <p className="text-sm text-muted-foreground mt-1 lg:mt-0">
          Você foi convidado para entrar em{" "}
          <strong className="text-foreground">{tenantName}</strong>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground truncate max-w-[140px] sm:max-w-none">
              {tenantName}
            </span>
            <RoleBadge role={role} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm min-w-0 flex-1 sm:flex-initial">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground truncate">{email}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Seu nome
          </Label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoFocus
              disabled={isSubmitting}
              placeholder="Como você quer aparecer no painel"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isSubmitting}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="pl-10 h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-sm font-medium">
            Confirmar senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              disabled={isSubmitting}
              placeholder="Repita a senha"
              autoComplete="new-password"
              className="pl-10 h-11"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-foreground animate-fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          variant="gradient"
          className="w-full group"
          disabled={isSubmitting || !name || !password || !confirm}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Criando conta…
            </>
          ) : (
            <>
              Criar conta e entrar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>

        <p className="text-2xs text-center text-muted-foreground leading-relaxed">
          Ao continuar, você terá acesso ao workspace{" "}
          <strong className="text-foreground/80">{tenantName}</strong>. Na
          sequência, conecte o WhatsApp na aba Conexão.
        </p>
      </form>
    </InviteShell>
  );
}
