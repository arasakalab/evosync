"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Save,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  ListChecks,
  RefreshCcw,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  MediaAttachmentField,
  type MediaType,
} from "@/components/media-attachment-field";
import { StatusBadge } from "@/components/status-badge";
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
import { cn, formatDateTime, onlyDigits } from "@/lib/utils";
import type { Schedule, ScheduleStatus } from "@/lib/types";

type AgendaContactMode = "snapshot_selected" | "current";

function todayDateInput(d = new Date()) {
  return format(d, "dd/MM/yyyy");
}
function nowTimeInput(d = new Date()) {
  return format(d, "HH:mm");
}

export default function AgendaPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const schedules = useAppStore((s) => s.schedules);
  const setSchedules = useAppStore((s) => s.setSchedules);
  const updateSchedule = useAppStore((s) => s.updateSchedule);
  const contactSelectedIds = useAppStore((s) => s.selectedIds);

  const [date, setDate] = useState(todayDateInput());
  const [time, setTime] = useState(nowTimeInput(addDays(new Date(), 1)));
  const [contactMode, setContactMode] = useState<AgendaContactMode>("snapshot_selected");
  const [message, setMessage] = useState("");
  const [mediaPath, setMediaPath] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [validateFirst, setValidateFirst] = useState(true);
  const [resendSent, setResendSent] = useState(settings.resend_sent);

  const refresh = async () => {
    try {
      const list = await api.schedules.list();
      setSchedules(list);
    } catch {
      /* noop */
    }
  };

  const copyCurrentMessage = () => {
    setMessage(settings.last_message || "");
    setMediaPath(settings.last_media_path || "");
    setMediaType((settings.last_media_type as MediaType) || "image");
    toast.success("Mensagem e mídia atuais copiadas para a agenda");
  };

  const resetForm = () => {
    setDate(todayDateInput());
    setTime(nowTimeInput(addDays(new Date(), 1)));
    setContactMode("snapshot_selected");
    setMessage("");
    setMediaPath("");
    setMediaType("image");
    setValidateFirst(true);
    setResendSent(settings.resend_sent);
    setEditingId(null);
  };

  const onSave = async () => {
    setSubmitting(true);
    try {
      const dt = parseDateTime(date, time);
      if (!dt) {
        toast.error("Data/hora inválidas. Use DD/MM/AAAA e HH:MM.");
        return;
      }
      if (dt.getTime() <= Date.now()) {
        toast.error("Escolha uma data e hora no futuro.");
        return;
      }
      if (!message.trim() && !mediaPath.trim()) {
        toast.error("Digite uma mensagem ou selecione uma mídia.");
        return;
      }

      if (contactSelectedIds.size === 0) {
        toast.error(
          "Marque contatos em Contatos antes de agendar. Nenhum destinatário selecionado."
        );
        return;
      }

      const payload = {
        scheduled_at: dt.toISOString(),
        message: message.trim(),
        media_path: mediaPath.trim(),
        media_type: mediaType,
        contact_mode:
          contactMode === "current" ? ("current" as const) : ("snapshot" as const),
        contact_ids: Array.from(contactSelectedIds),
        delay_min: settings.delay_min,
        delay_max: settings.delay_max,
        daily_limit: settings.daily_limit,
        validate_first: validateFirst,
        skip_sent_history: !resendSent,
      };

      if (editingId) {
        const updated = await api.schedules.update(editingId, payload);
        updateSchedule(editingId, updated);
        toast.success("Agendamento atualizado");
      } else {
        const created = await api.schedules.create(payload);
        setSchedules([...schedules, created]);
        toast.success("Agendamento criado");
      }
      resetForm();
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (s: Schedule) => {
    if (s.status !== "pending") {
      toast.error("Somente agendamentos pendentes podem ser editados");
      return;
    }
    try {
      const d = parseISO(s.scheduled_at);
      setDate(format(d, "dd/MM/yyyy"));
      setTime(format(d, "HH:mm"));
      setMessage(s.message);
      setMediaPath(s.media_path);
      setMediaType((s.media_type as MediaType) || "image");
      setContactMode(
        s.contact_mode === "current" ? "current" : "snapshot_selected"
      );
      setValidateFirst(!!s.validate_first);
      setResendSent(!s.skip_sent_history);
      setEditingId(s.id);
    } catch {
      toast.error("Agendamento com data inválida");
    }
  };

  const onDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Selecione ao menos um agendamento");
      return;
    }
    const running = schedules.find(
      (s) => ids.includes(s.id) && s.status === "running"
    );
    if (running) {
      toast.error("Não é possível excluir um agendamento em execução");
      setConfirmDelete(false);
      return;
    }
    try {
      const r = await api.schedules.removeMany(ids);
      toast.success(`${r.removed} agendamento(s) excluído(s)`);
      setSelectedIds(new Set());
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir");
    } finally {
      setConfirmDelete(false);
    }
  };

  const onDeleteAll = async () => {
    if (schedules.some((s) => s.status === "running")) {
      toast.error("Não é possível excluir tudo com agendamento em execução");
      setConfirmDeleteAll(false);
      return;
    }
    try {
      const r = await api.schedules.removeAll();
      toast.success(`${r.removed} agendamento(s) excluído(s)`);
      setSelectedIds(new Set());
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setConfirmDeleteAll(false);
    }
  };

  const ordered = useMemo(
    () =>
      [...schedules].sort((a, b) =>
        (a.scheduled_at || "").localeCompare(b.scheduled_at || "")
      ),
    [schedules]
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          Agenda
        </h1>
        <p className="section-subtitle">
          Programe um disparo único com mensagem própria e envio automático.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Editar agendamento" : "Novo agendamento"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div>
              <Label htmlFor="time">Hora</Label>
              <Input
                id="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="HH:MM"
              />
            </div>
            <div className="col-span-2">
              <Label>Contatos</Label>
              {contactSelectedIds.size === 0 ? (
                <p className="mt-2 text-sm text-warn flex items-start gap-2 rounded-md border border-warn/40 bg-warn/5 px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Marque contatos na aba Contatos antes de agendar.
                </p>
              ) : (
                <Select
                  value={contactMode}
                  onValueChange={(v) => setContactMode(v as AgendaContactMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snapshot_selected">
                      Congelar selecionados ({contactSelectedIds.size})
                    </SelectItem>
                    <SelectItem value="current">
                      Usar seleção atual ({contactSelectedIds.size}) no horário
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div>
            <Label>Mensagem agendada</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Texto enviado no horário marcado..."
              className="min-h-[130px]"
            />
          </div>

          <div>
            <Label>Mídia (opcional)</Label>
            <div className="mt-2">
              <MediaAttachmentField
                mediaPath={mediaPath}
                mediaType={mediaType}
                onMediaPathChange={setMediaPath}
                onMediaTypeChange={setMediaType}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={validateFirst}
                onCheckedChange={setValidateFirst}
              />
              <span>Validar números antes</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={resendSent} onCheckedChange={setResendSent} />
              <span>Reenviar números do histórico</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              onClick={onSave}
              disabled={submitting || contactSelectedIds.size === 0}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? "Salvar edição" : "Agendar"}
            </Button>
            <Button variant="neutral" onClick={copyCurrentMessage}>
              <Copy className="h-4 w-4" /> Copiar mensagem atual
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={resetForm}>
                <X className="h-4 w-4" /> Cancelar edição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted">
        <AlertCircle className="h-3.5 w-3.5" />
        O agendamento usa os delays, limite diário, validação e mídia configurados
        atualmente na aba Disparo e Mensagem.
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Agendamentos</CardTitle>
            <CardDescription>
              {ordered.length} mensagem(ns) · {ordered.filter((s) => s.status === "pending").length} pendente(s)
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="neutral"
              size="sm"
              disabled={!selectedIds.size}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Excluir ({selectedIds.size})
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!schedules.length}
              onClick={() => setConfirmDeleteAll(true)}
            >
              <Trash2 className="h-4 w-4" /> Excluir todas
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCcw className="h-4 w-4" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {ordered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
              <CalendarClock className="h-10 w-10 opacity-40" />
              <p className="text-sm">Nenhum agendamento ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-panel-alt">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="w-10 px-3 py-2.5"></th>
                    <th className="px-3 py-2.5 font-semibold">Data/Hora</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold text-center">
                      Contatos
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Modo</th>
                    <th className="px-3 py-2.5 font-semibold">Mensagem</th>
                    <th className="px-3 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((s) => {
                    const checked = selectedIds.has(s.id);
                    const msg = (s.message || s.summary || s.error || "").replace(
                      /\n/g,
                      " "
                    );
                    const truncated = msg.length > 90 ? msg.slice(0, 87) + "…" : msg;
                    return (
                      <tr
                        key={s.id}
                        className={cn(
                          "border-b border-border/60 transition-colors hover:bg-neutral/30",
                          checked && "bg-primary/10"
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.id)) next.delete(s.id);
                                else next.add(s.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-border bg-[#0d1713] accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-text whitespace-nowrap">
                          {formatDateTime(s.scheduled_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted">
                          {s.contact_mode === "current"
                            ? s.selected_contact_ids?.length ?? 0
                            : (s.contacts?.length ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {s.contact_mode === "current"
                            ? `Atual (${s.selected_contact_ids?.length ?? 0})`
                            : "Congelado"}
                        </td>
                        <td className="px-3 py-2.5 text-text/80 max-w-[420px]">
                          {truncated || <span className="text-muted/60">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={s.status !== "pending"}
                            onClick={() => onEdit(s)}
                            title="Editar pendente"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamentos</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {selectedIds.size} agendamento(s) selecionado(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteSelected}
              className="bg-danger text-white hover:bg-danger-hover"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todos</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir todas as {schedules.length} mensagens agendadas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteAll}
              className="bg-danger text-white hover:bg-danger-hover"
            >
              Excluir todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function parseDateTime(date: string, time: string): Date | null {
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const t = time.match(/^(\d{2}):(\d{2})$/);
  if (!m || !t) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const hour = parseInt(t[1], 10);
  const min = parseInt(t[2], 10);
  const d = new Date(year, month, day, hour, min, 0, 0);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}
