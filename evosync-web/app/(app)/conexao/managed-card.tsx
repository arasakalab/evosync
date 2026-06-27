"use client";

/**
 * Card exibido na aba Conexão quando o tenant está em modo managed.
 *
 * Comportamento:
 *  - Polling do QR a cada 2s quando status === ready (QR expira rápido)
 *  - Status de conexão vem do sync global (app-shell, 5s + WS)
 *  - Estados visuais:
 *      pending (instância não existe) → mensagem pedindo pro admin provisionar
 *      provisioning → spinner
 *      ready → QR code + "Abra o WhatsApp > Aparelhos conectados"
 *      connected → ✅ verde + info + botão "Desconectar"
 *      failed → erro + botão "Tentar novamente"
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2,
  QrCode,
  Wifi,
  WifiOff,
  AlertCircle,
  Smartphone,
  RefreshCw,
  LogOut,
  Server,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ManagedStatus } from "@/lib/types";

interface ConnectionStatus {
  ok: boolean;
  state: string | null;
  mode: "byo" | "managed";
  managedStatus: ManagedStatus | null;
  error: string | null;
}

interface QrResponse {
  qr: { base64: string | null; code: string | null; pairingCode: string | null } | null;
  expiresInMs: number;
  instance: string;
  cached: boolean;
  state: string | null;
  error: string | null;
}

/**
 * Formata o pairing code para ficar mais legível.
 * A Evolution API retorna algo tipo "ABC1-DEF2-GHI3" (já com hífens) ou
 * "ABCDEFGHIJKL" sem formatação. Adiciona hífens a cada 4 chars se não
 * tiver, preserva formatação existente.
 */
function formatPairingCode(raw: string): string {
  const clean = raw.replace(/[-\s]/g, "").toUpperCase();
  if (clean.length === 0) return raw;
  if (raw.includes("-")) return raw.toUpperCase();
  return clean.match(/.{1,4}/g)?.join("-") ?? raw;
}

const STATUS_COPY: Record<
  ManagedStatus,
  { title: string; description: string; color: string; icon: any }
> = {
  pending: {
    title: "Aguardando provisionamento",
    description:
      "Sua instância ainda não foi provisionada. Contate o administrador.",
    color: "text-muted-foreground",
    icon: Server,
  },
  provisioning: {
    title: "Preparando conexão...",
    description: "Estamos configurando seu WhatsApp no painel. Aguarde um instante.",
    color: "text-blue",
    icon: Loader2,
  },
  ready: {
    title: "Escaneie o QR Code",
    description:
      "Abra o WhatsApp no celular → Menu (⋮) → Aparelhos conectados → Conectar um aparelho → Aponte para este QR.",
    color: "text-warning",
    icon: QrCode,
  },
  connected: {
    title: "WhatsApp conectado",
    description: "Sua conta está pareada e pronta para enviar mensagens.",
    color: "text-success",
    icon: Wifi,
  },
  failed: {
    title: "Falha no provisionamento",
    description: "Tente novamente ou contate o administrador.",
    color: "text-danger",
    icon: AlertCircle,
  },
};

export default function ManagedConnectionCard() {
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const cancelled = useRef(false);
  const prevManagedStatus = useRef<string | null>(null);

  const selectionLoaded = useAppStore((s) => s.selectionLoaded);
  const connection = useAppStore((s) => s.connection);
  const managedStatus = useAppStore((s) => s.settings.managed_status);
  const managedError = useAppStore((s) => s.settings.managed_error);
  const setSettings = useAppStore((s) => s.setSettings);

  const status: ConnectionStatus | null = selectionLoaded
    ? {
        ok: connection.ok,
        state: connection.state ?? null,
        mode: "managed",
        managedStatus: managedStatus,
        error: managedError || (connection.msg !== "—" ? connection.msg : null),
      }
    : null;

  useEffect(() => {
    if (
      prevManagedStatus.current === "ready" &&
      managedStatus === "connected"
    ) {
      toast.success("WhatsApp conectado! Menu liberado.");
    }
    prevManagedStatus.current = managedStatus;
  }, [managedStatus]);

  const fetchStatus = useCallback(async () => {
    const s = await api.connection.status();
    if (s.managedStatus) {
      const current = useAppStore.getState().settings;
      setSettings({ ...current, managed_status: s.managedStatus });
    }
    useAppStore.getState().setConnection({
      ok: s.ok,
      state: s.state,
      msg: s.error || (s.ok ? "Conectado" : "Desconectado"),
      checkedAt: new Date().toISOString(),
    });
    return s;
  }, [setSettings]);

  const fetchQr = useCallback(async () => {
    if (managedStatus !== "ready") return;
    try {
      const q = await api.connection.qr();
      setQr(q);
      setCountdown(Math.floor(q.expiresInMs / 1000));
    } catch (e: any) {
      // Silencioso — vai tentar de novo no próximo poll
      console.warn("QR fetch falhou:", e?.message);
    }
  }, [managedStatus]);

  // QR polling quando aguardando pareamento (status vem do sync global)
  useEffect(() => {
    cancelled.current = false;
    if (managedStatus !== "ready") return;
    fetchQr();
    const id = setInterval(() => {
      if (!cancelled.current) fetchQr();
    }, 2000);
    return () => {
      cancelled.current = true;
      clearInterval(id);
    };
  }, [managedStatus, fetchQr]);

  // Countdown do cache
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown, qr?.cached]);

  const onRefresh = async () => {
    setBusy(true);
    try {
      await fetchStatus();
      await fetchQr();
      toast.success("Atualizado");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    if (
      !window.confirm(
        "Desconectar este WhatsApp? Você precisará escanear o QR novamente."
      )
    )
      return;
    setBusy(true);
    try {
      const r = await api.connection.logout();
      if (r.ok) {
        toast.success("WhatsApp desconectado");
      } else {
        toast.error(r.info || "Erro ao desconectar");
      }
      await fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const current = status.managedStatus ?? "pending";
  const copy = STATUS_COPY[current];
  const Icon = copy.icon;
  const isConnected = current === "connected";
  const isReady = current === "ready";
  const isProvisioning = current === "provisioning";
  const isFailed = current === "failed";
  const isPending = current === "pending";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Conexão WhatsApp (Managed)
              </CardTitle>
              <CardDescription>
                Hospedagem centralizada — você não precisa instalar nada.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={busy}
              title="Atualizar status"
            >
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status bar */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              isConnected
                ? "border-success/30 bg-success/10"
                : isFailed
                ? "border-danger/30 bg-danger/10"
                : isReady
                ? "border-warning/30 bg-warning/10"
                : "border-border bg-surface-alt/40"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 mt-0.5 shrink-0",
                copy.color,
                isProvisioning && "animate-spin"
              )}
            />
            <div className="flex-1 min-w-0">
              <div className={cn("font-medium", copy.color)}>{copy.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {copy.description}
              </div>
              {status.error && status.error !== "OK" && (
                <div className="text-xs text-danger-foreground mt-1 font-mono">
                  {status.error}
                </div>
              )}
            </div>
          </div>

          {/* QR Code (apenas quando ready) */}
          {isReady && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="relative p-4 bg-white rounded-xl border-2 border-border shadow-elev-2">
                  {qr?.qr?.base64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr.qr.base64}
                      alt="QR Code WhatsApp"
                      className="w-full max-w-[16rem] h-auto aspect-square object-contain"
                    />
                  ) : (
                    <div className="w-full max-w-[16rem] aspect-square flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {qr?.qr?.pairingCode && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="text-xs text-muted-foreground">
                    Ou use o código de pareamento:
                  </div>
                  <code
                    onClick={() => {
                      navigator.clipboard.writeText(qr.qr!.pairingCode!);
                      toast.success("Código copiado");
                    }}
                    title="Clique para copiar"
                    className="cursor-pointer select-all text-base sm:text-lg font-mono font-bold tracking-[0.2em] text-foreground bg-surface-alt hover:bg-surface px-4 py-2 rounded-md border border-border max-w-full break-all text-center transition-colors"
                  >
                    {formatPairingCode(qr.qr.pairingCode)}
                  </code>
                  <div className="text-[10px] text-muted-foreground/70">
                    Clique para copiar
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                <span>
                  QR atualiza automaticamente a cada{" "}
                  {countdown > 0 ? `${countdown}s` : "alguns segundos"}
                </span>
              </div>
            </div>
          )}

          {/* Conectado — info + ações */}
          {isConnected && (
            <div className="space-y-3">
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium text-foreground">
                    Sessão ativa
                  </span>
                </div>
                <code className="text-xs font-mono text-muted-foreground">
                  {qr?.instance || "—"}
                </code>
              </div>
              <Button
                variant="outline"
                onClick={onLogout}
                disabled={busy}
                className="w-full"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Desconectar WhatsApp
              </Button>
            </div>
          )}

          {/* Pending — admin precisa provisionar */}
          {isPending && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-foreground/80">
              Sua instância ainda não foi provisionada. O administrador precisa
              clicar em <strong>Provisionar</strong> na sua empresa para que o QR
              apareça aqui. Em instâncias já conectadas antes, o sistema
              mantém a sessão — só mostra este aviso se a instância foi
              removida da Evolution.
            </div>
          )}

          {/* Failed — botão tentar de novo */}
          {isFailed && (
            <Button onClick={onRefresh} disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Tentar novamente
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info card de ajuda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            A conexão do WhatsApp é feita <strong>100% pelo painel</strong> — sem
            instalar programas, sem configurar servidores e sem depender do seu
            computador.
          </p>
          <p>
            Para vincular, escaneie o QR code acima no celular (WhatsApp →
            Aparelhos conectados → Conectar um aparelho). Se precisar trocar de
            aparelho, desconecte e escaneie um novo código quando quiser.
          </p>
          <p className="text-2xs uppercase tracking-widest text-muted-foreground/80 pt-1">
            by Arasaka Lab — infraestrutura hospedada e administrada por nós.
            Sua sessão fica segura na nuvem, pronta para suas campanhas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
