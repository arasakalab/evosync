"use client";

/**
 * Banner mostrado no topo da página /conexao quando o tenant
 * foi redirecionado por outro motivo (ex: acabou de aceitar invite,
 * tentou acessar /contatos antes de conectar WhatsApp, etc).
 *
 * Lê o query param `?reason=`:
 *  - "managed_not_connected" → tenant managed, WhatsApp não pareado
 *  - "blocked" → genérico
 *  - ausente → não mostra
 */

import { useSearchParams } from "next/navigation";
import { AlertTriangle, Info, Lock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConnectionNotice() {
  const params = useSearchParams();
  const reason = params.get("reason");

  if (!reason) return null;

  const config: Record<
    string,
    {
      icon: any;
      title: string;
      description: string;
      variant: "warning" | "danger" | "info";
    }
  > = {
    managed_not_connected: {
      icon: Lock,
      title: "Conecte seu WhatsApp para continuar",
      description:
        "Sua conta EvoSync está em modo Managed. Você precisa escanear o QR code abaixo para parear seu WhatsApp antes de usar contatos, envios ou agendamentos.",
      variant: "warning",
    },
    blocked: {
      icon: ShieldAlert,
      title: "Acesso bloqueado",
      description:
        "Sua conta precisa ser liberada antes de continuar. Contate o administrador.",
      variant: "danger",
    },
  };

  const c = config[reason];
  if (!c) return null;
  const Icon = c.icon;

  const styles = {
    warning: "border-warning/30 bg-warning/10 text-foreground",
    danger: "border-danger/30 bg-danger/10 text-foreground",
    info: "border-blue/30 bg-blue/10 text-foreground",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        styles[c.variant]
      )}
    >
      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{c.title}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {c.description}
        </div>
      </div>
    </div>
  );
}
