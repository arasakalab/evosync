/**
 * Loop de agendamento — a cada 30s verifica agendamentos pendentes
 * cuja data/hora já chegou e dispara o primeiro. Espelha o _schedule_loop
 * do main.py.
 */
import { loadSchedules, saveSchedules, nowIso } from "@/server/store/schedules";
import { sender } from "@/server/sender/manager";
import { loadSettings } from "@/server/store/settings";
import { loadContacts } from "@/server/store/contacts";
import { EvoClient } from "@/server/evo/client";
import { hub } from "@/server/ws/hub";
import type { Schedule } from "@/lib/types";

interface GlobalLoop {
  interval: NodeJS.Timeout | null;
  startedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var __evoteste_loop: GlobalLoop | undefined;
}

function getLoop(): GlobalLoop {
  if (!globalThis.__evoteste_loop) {
    globalThis.__evoteste_loop = {
      interval: null,
      startedAt: new Date(),
    };
  }
  return globalThis.__evoteste_loop!;
}

function failSchedule(s: Schedule, message: string) {
  s.status = "failed";
  s.updated_at = nowIso();
  s.error = message;
  saveSchedules(loadSchedules().map((x) => (x.id === s.id ? s : x)));
  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line: `Agendamento falhou: ${message}`,
      level: "error",
    },
  });
  hub.broadcast({
    type: "schedule_update",
    payload: { id: s.id, status: s.status, error: message },
  });
}

function markMissed(s: Schedule) {
  s.status = "missed";
  s.updated_at = nowIso();
  s.error = "O app estava fechado no horário agendado.";
  saveSchedules(loadSchedules().map((x) => (x.id === s.id ? s : x)));
  hub.broadcast({
    type: "schedule_update",
    payload: { id: s.id, status: s.status, error: s.error },
  });
}

function markRunning(s: Schedule) {
  s.status = "running";
  s.updated_at = nowIso();
  s.error = "";
  saveSchedules(loadSchedules().map((x) => (x.id === s.id ? s : x)));
  hub.broadcast({
    type: "schedule_update",
    payload: { id: s.id, status: s.status },
  });
}

function markFinished(s: Schedule, status: "sent" | "failed") {
  s.status = status;
  s.updated_at = nowIso();
  saveSchedules(loadSchedules().map((x) => (x.id === s.id ? s : x)));
  hub.broadcast({
    type: "schedule_update",
    payload: { id: s.id, status: s.status },
  });
}

async function startScheduledSend(s: Schedule) {
  const settings = loadSettings();
  const currentContacts = loadContacts();

  const contacts =
    s.contact_mode === "current"
      ? currentContacts
      : (s.contacts || []).filter((c) => c && c.number);

  if (!contacts.length) {
    failSchedule(s, "Nenhum contato disponível para o envio agendado.");
    return;
  }

  const mediaPath = (s.media_path || "").trim() || null;
  if (mediaPath) {
    const fs = await import("node:fs");
    if (!fs.existsSync(mediaPath)) {
      failSchedule(s, `Arquivo de mídia não encontrado: ${mediaPath}`);
      return;
    }
  }
  if (!s.message?.trim() && !mediaPath) {
    failSchedule(s, "Mensagem e mídia vazias.");
    return;
  }

  if (!settings.api_key || !settings.instance) {
    failSchedule(s, "Credenciais da Evolution ausentes ou inválidas.");
    return;
  }

  const client = new EvoClient(settings.url, settings.api_key, settings.instance);
  const { ok, info } = await client.instanceExists();
  if (!ok) {
    markRunning(s); // marca como running para UI e depois corrige
    if (info.startsWith("instancia_inexistente")) {
      failSchedule(
        s,
        `Instância '${settings.instance}' não existe na Evolution. Crie a instância ou ajuste EVO_INSTANCE no .env.`
      );
    } else if (info.startsWith("autenticacao")) {
      failSchedule(
        s,
        `API Key da Evolution rejeitada (${info}). Verifique EVO_APIKEY no .env.`
      );
    } else {
      failSchedule(
        s,
        `Não consegui contatar a Evolution (${info}). Verifique EVO_URL e se o servidor está no ar.`
      );
    }
    return;
  }

  markRunning(s);
  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line: `Iniciando agendamento de ${new Date(s.scheduled_at).toLocaleString("pt-BR")}`,
      level: "info",
    },
  });

  const started = sender.start({
    url: settings.url,
    apiKey: settings.api_key,
    instance: settings.instance,
    contacts,
    template: s.message || "",
    mediaPath,
    mediatype: s.media_type || "image",
    delayMin: s.delay_min,
    delayMax: s.delay_max,
    dailyLimit: s.daily_limit,
    validateFirst: !!s.validate_first,
    skipSentHistory: !!s.skip_sent_history,
    source: "schedule",
  });
  if (started) {
    sender.setActiveScheduleId(s.id);
  } else {
    sender.setActiveScheduleId(null);
    failSchedule(s, "Não foi possível iniciar o envio agendado.");
  }
}

function checkDue() {
  if (sender.isBusy()) return;
  const all = loadSchedules();
  const now = new Date();
  const due = all
    .filter((s) => s.status === "pending")
    .map((s) => {
      const d = new Date(s.scheduled_at);
      return { s, d };
    })
    .filter((x) => !Number.isNaN(x.d.getTime()) && x.d <= now)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  if (!due.length) return;
  void startScheduledSend(due[0].s);
}

function markMissedOnStartup() {
  const loop = getLoop();
  const all = loadSchedules();
  let changed = false;
  for (const s of all) {
    if (s.status === "running") {
      s.status = "failed";
      s.updated_at = nowIso();
      s.error = "O app foi fechado durante este agendamento.";
      changed = true;
      continue;
    }
    if (s.status !== "pending") continue;
    const d = new Date(s.scheduled_at);
    if (Number.isNaN(d.getTime())) continue;
    if (d < loop.startedAt) {
      s.status = "missed";
      s.updated_at = nowIso();
      s.error = "O app estava fechado no horário agendado.";
      changed = true;
    }
  }
  if (changed) saveSchedules(all);
}

export function startSchedulerLoop() {
  const loop = getLoop();
  if (loop.interval) return;
  markMissedOnStartup();
  loop.interval = setInterval(() => {
    try {
      checkDue();
      // Fallback: se por algum motivo o manager não atualizou o status do
      // agendamento (ex: crash), o scheduler loop faz o cleanup aqui.
      const activeId = sender.getActiveScheduleId();
      if (activeId) {
        const st = sender.getStatus();
        const isDone =
          (st.state === "idle" || st.state === "stopped") && st.stage === "done";
        if (isDone) {
          const all = loadSchedules();
          const s = all.find((x) => x.id === activeId);
          if (s && s.status === "running") {
            const incomplete =
              st.failed > 0 ||
              st.pending > 0 ||
              st.limit_reached ||
              (st.state as string) === "stopped";
            s.status = incomplete ? "failed" : "sent";
            s.updated_at = nowIso();
            s.summary = `Enviados: ${st.sent}, Falharam: ${st.failed}, Pulados: ${st.skipped}, Pendentes: ${st.pending}`;
            s.error = incomplete ? st.error || "" : "";
            saveSchedules(all);
            hub.broadcast({
              type: "schedule_update",
              payload: { id: s.id, status: s.status, error: s.error },
            });
          }
          sender.setActiveScheduleId(null);
        }
      }
    } catch (e) {
      // não derruba o loop
    }
  }, 30_000);
}

export function stopSchedulerLoop() {
  const loop = getLoop();
  if (loop.interval) {
    clearInterval(loop.interval);
    loop.interval = null;
  }
}
