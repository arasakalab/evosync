/**
 * Loop de agendamento — a cada 30s verifica agendamentos PENDENTES
 * cuja data/hora já chegou em CADA TENANT ATIVO, e dispara o primeiro
 * que encontrar. Espelha o _schedule_loop do main.py.
 *
 * SaaS Phase 4: itera sobre todos os tenants ativos (não mais sobre
 * uma lista global).
 */
import { logger } from "@/lib/logger";
const log = logger.child({ module: "scheduler" });
import { eq } from "drizzle-orm";
import {
  listSchedules,
  getSchedule,
  listDuePending,
  updateSchedule,
} from "@/server/store/schedules";
import { listContacts } from "@/server/store/contacts";
import { loadTenantSettings } from "@/server/store/settings";
import { getDb, schema } from "@/lib/db";
import { sender } from "@/server/sender/manager";
import { EvoClient } from "@/server/evo/client";
import { hub } from "@/server/ws/hub";
import { checkWatchdogPause } from "@/server/store/watchdog";
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

/**
 * Lista todos os tenants ativos (pra iterar).
 */
function listActiveTenants(): { id: string; name: string }[] {
  const db = getDb();
  return db
    .select({ id: schema.tenants.id, name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.status, "active"))
    .all();
}

function failSchedule(s: Schedule, message: string) {
  if (!s.tenantId) {
    log.error({ scheduleId: s.id, message }, "failSchedule sem tenantId — não consegue atualizar DB");
    hub.broadcast({
      type: "log",
      payload: {
        ts: new Date().toISOString(),
        line: `Agendamento falhou: ${message}`,
        level: "error",
      },
    });
    return;
  }
  updateSchedule(s.tenantId, s.id, {
    status: "failed",
    error: message,
  });
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
    payload: { id: s.id, status: "failed", error: message },
  });
}

function markRunning(s: Schedule) {
  if (!s.tenantId) {
    log.error({ scheduleId: s.id }, "markRunning sem tenantId — não consegue atualizar DB");
    return;
  }
  updateSchedule(s.tenantId, s.id, { status: "running" });
  hub.broadcast({
    type: "schedule_update",
    payload: { id: s.id, status: "running" },
  });
}

function markFinished(s: Schedule, status: "sent" | "failed") {
  updateSchedule(s.tenantId || "", s.id, { status });
  hub.broadcast({
    type: "schedule_update",
    payload: { id: s.id, status },
  });
}

async function startScheduledSend(s: Schedule) {
  log.info({ scheduleId: s.id, tenantId: s.tenantId }, "Iniciando agendamento");
  if (!s.tenantId) {
    failSchedule(s, "Schedule sem tenantId (inválido).");
    return;
  }

  // Watchdog defense-in-depth: checa de novo aqui (caso pause foi
  // acionada entre checkDue e startScheduledSend)
  const pause = checkWatchdogPause(s.tenantId);
  if (pause) {
    failSchedule(
      s,
      `Tenant pausado pelo watchdog desde ${pause.at || "?"}: ${pause.reason}. ` +
        `Contate o administrador para liberar.`
    );
    return;
  }

  const settings = loadTenantSettings(s.tenantId);
  log.info(
    { scheduleId: s.id, hasUrl: !!settings.url, hasKey: !!settings.api_key, hasInstance: !!settings.instance, contactsMode: s.contact_mode, contactsLen: s.contacts?.length || 0 },
    "Settings + contatos carregados"
  );

  // Para contact_mode='current', pega os contatos ATUAIS do tenant
  // FASE 3: filtra pelos selected_contact_ids persistidos (lista congelada no
  // momento do agendamento). Se vazio, fallback para o catálogo inteiro.
  const currentResult = listContacts(s.tenantId);
  const allContacts = currentResult.contacts;
  let contacts: typeof allContacts;
  if (s.contact_mode === "current") {
    const selectedIds = s.selected_contact_ids || [];
    if (selectedIds.length === 0) {
      failSchedule(
        s,
        "Agendamento sem contatos selecionados. Edite o agendamento ou marque contatos em Contatos."
      );
      return;
    }
    const idSet = new Set(selectedIds);
    contacts = allContacts.filter((c) => idSet.has(c.id));
  } else {
    contacts = (s.contacts || []).filter((c) => c && c.number) as typeof allContacts;
  }

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
    failSchedule(
      s,
      "Credenciais da Evolution ausentes ou inválidas. Configure em /conexao."
    );
    return;
  }

  log.info({ scheduleId: s.id, url: settings.url, instance: settings.instance }, "Validando Evolution API");
  const client = new EvoClient(settings.url, settings.api_key, settings.instance);
  const { ok, info } = await client.instanceExists();
  if (!ok) {
    markRunning(s);
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
  log.info({ scheduleId: s.id }, "Evolution API OK, iniciando sender");

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
    tenantId: s.tenantId,
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

/**
 * Verifica todos os tenants e dispara o PRIMEIRO schedule due que encontrar.
 * Se o sender está ocupado, pula essa iteração.
 */
function checkDue() {
  if (sender.isBusy()) return;
  const tenants = listActiveTenants();
  for (const t of tenants) {
    // Watchdog anti-ban: pula tenants pausados
    const pause = checkWatchdogPause(t.id);
    if (pause) {
      log.warn(
        { tenantId: t.id, reason: pause.reason },
        "Tenant pausado pelo watchdog — pulando verificação de agendamentos"
      );
      continue;
    }
    const due = listDuePending(t.id);
    if (due.length > 0) {
      log.info(
        { tenantId: t.id, tenantName: t.name, count: due.length, scheduleId: due[0].id },
        "Agendamento devido encontrado"
      );
      // Pega o mais antigo (já vem ordenado de listDuePending)
      void startScheduledSend(due[0]).catch((e) => {
        log.error(
          { err: e?.message || String(e), scheduleId: due[0].id },
          "Exceção async em startScheduledSend"
        );
      });
      return; // um por vez (sender não suporta paralelo)
    }
  }
}

function markMissedOnStartup() {
  const loop = getLoop();
  const tenants = listActiveTenants();
  for (const t of tenants) {
    const all = listSchedules(t.id);
    for (const s of all) {
      if (s.status === "running") {
        updateSchedule(t.id, s.id, {
          status: "failed",
          error: "O app foi fechado durante este agendamento.",
        });
        continue;
      }
      if (s.status !== "pending") continue;
      const d = new Date(s.scheduled_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d < loop.startedAt) {
        updateSchedule(t.id, s.id, {
          status: "missed",
          error: "O app estava fechado no horário agendado.",
        });
      }
    }
  }
}

export function startSchedulerLoop() {
  const loop = getLoop();
  if (loop.interval) return;
  log.info("Scheduler loop iniciando");
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
          // Sem saber o tenantId, busca em todos os tenants
          const tenants = listActiveTenants();
          for (const t of tenants) {
            const sched = getSchedule(t.id, activeId);
            if (sched && sched.status === "running") {
              const incomplete =
                st.failed > 0 ||
                st.pending > 0 ||
                st.limit_reached ||
                (st.state as string) === "stopped";
              updateSchedule(t.id, activeId, {
                status: incomplete ? "failed" : "sent",
                summary: `Enviados: ${st.sent}, Falharam: ${st.failed}, Pulados: ${st.skipped}, Pendentes: ${st.pending}`,
                error: incomplete ? st.error || "" : "",
              });
              hub.broadcast({
                type: "schedule_update",
                payload: {
                  id: activeId,
                  status: incomplete ? "failed" : "sent",
                  error: incomplete ? st.error || "" : "",
                },
              });
              break;
            }
          }
          sender.setActiveScheduleId(null);
        }
      }
    } catch (e: any) {
      log.error({ err: e?.message || e }, "Erro no scheduler tick");
    }
  }, 30_000);
  log.info({ intervalMs: 30_000 }, "Scheduler loop ativo");
}

export function stopSchedulerLoop() {
  const loop = getLoop();
  if (loop.interval) {
    clearInterval(loop.interval);
    loop.interval = null;
  }
}

export function isSchedulerLoopRunning(): boolean {
  const loop = getLoop();
  return loop.interval !== null;
}
