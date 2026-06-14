"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Play,
  Pause,
  RotateCcw,
  Square,
  Eraser,
  Settings2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Hash,
  CheckCheck,
  CircleDashed,
  XOctagon,
  Clock,
  FileWarning,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { formatTime, cn } from "@/lib/utils";

export default function DisparoPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const status = useAppStore((s) => s.status);
  const contacts = useAppStore((s) => s.contacts);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const mode = useAppStore((s) => s.contactsMode);
  const logs = useAppStore((s) => s.logs);
  const clearLogs = useAppStore((s) => s.clearLogs);

  const [delayMin, setDelayMin] = useState(settings.delay_min);
  const [delayMax, setDelayMax] = useState(settings.delay_max);
  const [dailyLimit, setDailyLimit] = useState(settings.daily_limit);
  const [validateFirst, setValidateFirst] = useState(true);
  const [resendSent, setResendSent] = useState(settings.resend_sent);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [acting, setActing] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDelayMin(settings.delay_min);
    setDelayMax(settings.delay_max);
    setDailyLimit(settings.daily_limit);
    setResendSent(settings.resend_sent);
  }, [settings]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const persistParams = async () => {
    const next = {
      ...settings,
      delay_min: delayMin,
      delay_max: delayMax,
      daily_limit: dailyLimit,
      resend_sent: resendSent,
    };
    const saved = await api.settings.save(next);
    setSettings(saved);
  };

  const onStart = async () => {
    if (status.state === "running" || status.state === "paused") {
      toast.error("Já existe um disparo em andamento");
      return;
    }
    // FASE 5: se o modo é "selected", envia apenas os IDs marcados.
    // Caso contrário, envia o catálogo inteiro.
    const useSelection = mode === "selected" && selectedIds.size > 0;
    if (useSelection) {
      // OK — usa selectedIds
    } else if (!contacts.length) {
      toast.error("Importe ou adicione contatos antes de iniciar");
      return;
    } else if (mode === "selected" && selectedIds.size === 0) {
      toast.error(
        "Nenhum contato selecionado. Vá em Contatos e marque quem vai para o disparo."
      );
      return;
    }
    setActing(true);
    try {
      await persistParams();
      await api.send.start({
        template: settings.last_message || "",
        mediaPath: null,
        mediatype: "image",
        delayMin,
        delayMax,
        dailyLimit,
        validateFirst,
        skipSentHistory: !resendSent,
        contactIds: useSelection ? Array.from(selectedIds) : undefined,
      });
      clearLogs();
      toast.success(
        useSelection
          ? `Disparo iniciado (${selectedIds.size} selecionado${selectedIds.size !== 1 ? "s" : ""})`
          : "Disparo iniciado"
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao iniciar");
    } finally {
      setActing(false);
    }
  };

  const onPause = async () => {
    setActing(true);
    try {
      await api.send.pause();
    } finally {
      setActing(false);
    }
  };
  const onResume = async () => {
    setActing(true);
    try {
      await api.send.resume();
    } finally {
      setActing(false);
    }
  };
  const onStop = async () => {
    setActing(true);
    try {
      await api.send.stop();
    } finally {
      setActing(false);
      setConfirmStop(false);
    }
  };
  const onReset = async () => {
    setActing(true);
    try {
      const r = await api.send.resetHistory();
      toast.success(`${r.removed} número(s) removido(s) do histórico`);
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setActing(false);
      setConfirmReset(false);
    }
  };

  const total = Math.max(1, status.total);
  const done = status.sent + status.failed + status.skipped;
  const percent = Math.min(100, Math.round((done / total) * 100));

  const isRunning = status.state === "running";
  const isPaused = status.state === "paused";
  const isIdle = status.state === "idle" || status.state === "stopped";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title flex items-center gap-2">
          <Send className="h-6 w-6 text-primary" />
          Disparo
        </h1>
        <p className="section-subtitle">
          Configure velocidade, validação e execução. Acompanhe o andamento em tempo real.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted" /> Parâmetros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Param
              id="min"
              label="Delay mínimo (s)"
              value={delayMin}
              onChange={(v) => setDelayMin(Math.max(1, v))}
            />
            <Param
              id="max"
              label="Delay máximo (s)"
              value={delayMax}
              onChange={(v) => setDelayMax(Math.max(delayMin, v))}
            />
            <Param
              id="limit"
              label="Limite diário"
              value={dailyLimit}
              onChange={(v) => setDailyLimit(Math.max(1, v))}
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={validateFirst} onCheckedChange={setValidateFirst} />
              <span>Validar números no WhatsApp antes (recomendado)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={resendSent} onCheckedChange={setResendSent} />
              <span>Reenviar números já no histórico (não precisa resetar)</span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={onStart} disabled={!isIdle || acting}>
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Iniciar
            </Button>
            <Button
              variant="neutral"
              onClick={onPause}
              disabled={!isRunning || acting}
            >
              <Pause className="h-4 w-4" /> Pausar
            </Button>
            <Button
              variant="neutral"
              onClick={onResume}
              disabled={!isPaused || acting}
            >
              <RotateCcw className="h-4 w-4" /> Retomar
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmStop(true)}
              disabled={isIdle || acting}
            >
              <Square className="h-4 w-4" /> Parar
            </Button>
            <Button
              variant="neutral"
              onClick={() => setConfirmReset(true)}
              disabled={acting}
            >
              <Eraser className="h-4 w-4" /> Resetar histórico
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {status.current_index > 0
                ? `[${status.current_index}/${status.total}]`
                : ""}{" "}
              {status.current_number
                ? `Atual: ${status.current_number}`
                : "—"}
            </span>
            <span className="text-muted font-mono">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
          {status.stage && status.stage.startsWith("waiting") && (
            <p className="text-xs text-warn flex items-center gap-1">
              <Clock className="h-3 w-3" /> {status.stage}
            </p>
          )}
          {status.error && (
            <p className="text-xs text-danger-soft flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {status.error}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Counter
          icon={<CheckCheck className="h-4 w-4" />}
          label="Enviados"
          value={status.sent}
          color="text-success"
        />
        <Counter
          icon={<XCircle className="h-4 w-4" />}
          label="Falharam"
          value={status.failed}
          color="text-danger-soft"
        />
        <Counter
          icon={<CircleDashed className="h-4 w-4" />}
          label="Pendentes"
          value={status.pending}
          color="text-warn"
        />
        <Counter
          icon={<Hash className="h-4 w-4" />}
          label="Pulados"
          value={status.skipped}
          color="text-muted"
          hint="histórico"
        />
        <Counter
          icon={<FileWarning className="h-4 w-4" />}
          label="Sem WhatsApp"
          value={status.no_whatsapp}
          color="text-muted"
        />
        <Counter
          icon={<Ban className="h-4 w-4" />}
          label="Opt-out"
          value={status.opt_out ?? 0}
          color="text-warn"
          hint="LGPD"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Log</CardTitle>
            <CardDescription>
              Acompanhe cada etapa em tempo real.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={clearLogs}>
            Limpar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="h-72 overflow-y-auto rounded-md border border-border bg-[#0a1310] p-3 font-mono text-[12.5px] leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-muted">Nenhum evento ainda.</p>
            ) : (
              logs.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2",
                    l.level === "error" && "text-danger-soft",
                    l.level === "warn" && "text-warn",
                    l.level === "ok" && "text-success",
                    l.level === "info" && "text-text/90"
                  )}
                >
                  <span className="text-muted/70 shrink-0">
                    [{formatTime(l.ts)}]
                  </span>
                  <span className="whitespace-pre-wrap break-words">
                    {l.line}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-md border border-border bg-panel-alt/50 p-3 text-xs text-muted">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Os primeiros 50 envios usam delay 2× maior (warm-up). Em caso de erro
          401/403, o envio pausa automaticamente por suspeita de ban/auth.
        </p>
      </div>

      <AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar disparo</AlertDialogTitle>
            <AlertDialogDescription>
              Encerrar o disparo? O que já foi enviado permanece no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onStop}
              className="bg-danger text-white hover:bg-danger-hover"
            >
              Parar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar histórico</AlertDialogTitle>
            <AlertDialogDescription>
              Isto apaga o sent_log.json. Os números serão REENVIADOS no próximo
              disparo. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onReset}
              className="bg-danger text-white hover:bg-danger-hover"
            >
              Resetar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Param({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="font-mono"
      />
    </div>
  );
}

function Counter({
  icon,
  label,
  value,
  color,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
          {icon}
          {label}
        </div>
        <div className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>
          {value}
        </div>
        {hint && <div className="text-[10px] text-muted/70">{hint}</div>}
      </CardContent>
    </Card>
  );
}
