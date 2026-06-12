/**
 * SenderManager — singleton que controla o ciclo de envio de mensagens.
 * Roda no MESMO processo (sem worker_threads) usando o runner assíncrono.
 * Expõe start/pause/resume/stop para as rotas e o scheduler.
 */
import type { Contact, SendStatus } from "@/lib/types";
import { hub } from "@/server/ws/hub";
import { startRunner, type RunHandle } from "@/server/sender/runner";
import { getSchedule, updateSchedule, listSchedules } from "@/server/store/schedules";

interface StartArgs {
  url: string;
  apiKey: string;
  instance: string;
  contacts: Contact[];
  template: string;
  mediaPath: string | null;
  mediatype: string;
  delayMin: number;
  delayMax: number;
  dailyLimit: number;
  validateFirst: boolean;
  skipSentHistory: boolean;
  source?: "manual" | "schedule";
  /**
   * SaaS Phase 4: OBRIGATÓRIO. Indica de qual tenant são os contatos
   * e onde salvar o sent_log. Sem isso o sender não deve ser chamado.
   */
  tenantId: string;
}

interface GlobalState {
  handle: RunHandle | null;
  busy: boolean;
  status: SendStatus;
  activeScheduleId: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __evoteste_sender: GlobalState | undefined;
}

function defaultStatus(): SendStatus {
  return {
    state: "idle",
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    no_whatsapp: 0,
    invalid: 0,
    current_number: "",
    current_index: 0,
    last_message: "",
    error: "",
    stage: "",
    limit_reached: false,
  };
}

function getState(): GlobalState {
  if (!globalThis.__evoteste_sender) {
    globalThis.__evoteste_sender = {
      handle: null,
      busy: false,
      status: defaultStatus(),
      activeScheduleId: null,
    };
  }
  return globalThis.__evoteste_sender!;
}

function logToHub(
  line: string,
  level: "info" | "ok" | "warn" | "error"
) {
  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line,
      level,
    },
  });
}

export const sender = {
  getStatus(): SendStatus {
    return getState().status;
  },
  isBusy(): boolean {
    return getState().busy;
  },
  getActiveScheduleId(): string | null {
    return getState().activeScheduleId;
  },
  setActiveScheduleId(id: string | null) {
    getState().activeScheduleId = id;
  },
  start(args: StartArgs): boolean {
    const s = getState();
    if (s.busy) return false;
    s.busy = true;
    s.status = defaultStatus();
    s.status.total = args.contacts.length;
    s.status.pending = args.contacts.length;
    s.status.state = "running";
    s.activeScheduleId = null;

    const handle = startRunner(
      args,
      (status) => {
        s.status = status;
        hub.broadcast({ type: "status", payload: status });
        if (
          (status.state === "idle" || status.state === "stopped") &&
          status.stage === "done"
        ) {
          const summary =
            `Finalizado: ${status.sent} enviados, ${status.failed} falharam, ` +
            `${status.skipped} pulados, ${status.pending} pendentes`;
          hub.broadcast({
            type: "done",
            payload: { summary, counts: status },
          });
          logToHub(
            summary,
            status.failed > 0 ? "warn" : "ok"
          );
          s.busy = false;
          s.handle = null;
          // Atualiza o agendamento (se houver) e limpa activeScheduleId
          const activeId = s.activeScheduleId;
          s.activeScheduleId = null;
          if (activeId) {
            try {
              // Sem saber o tenantId, busca em todos os tenants ativos
              // (geralmente só 1-2). O scheduler loop já cuida do cleanup
              // primário, isto é fallback.
              // Não usamos await aqui porque o callback onStatus é sync.
              const { getDb, schema } = require("@/lib/db");
              const { eq } = require("drizzle-orm");
              const db = getDb();
              const tenants = db
                .select({ id: schema.tenants.id })
                .from(schema.tenants)
                .where(eq(schema.tenants.status, "active"))
                .all();
              for (const t of tenants) {
                const sched = getSchedule(t.id, activeId);
                if (sched && sched.status === "running") {
                  const incomplete =
                    status.failed > 0 ||
                    status.pending > 0 ||
                    status.limit_reached ||
                    (status.state as string) === "stopped";
                  updateSchedule(t.id, activeId, {
                    status: incomplete ? "failed" : "sent",
                    summary: `Enviados: ${status.sent}, Falharam: ${status.failed}, Pulados: ${status.skipped}, Pendentes: ${status.pending}`,
                    error: incomplete ? status.error || "" : "",
                  });
                  hub.broadcast({
                    type: "schedule_update",
                    payload: {
                      id: sched.id,
                      status: incomplete ? "failed" : "sent",
                      error: incomplete ? status.error || "" : "",
                    },
                  });
                  break;
                }
              }
            } catch (e) {
              // best-effort: log mas não bloqueia
              logToHub(`Erro ao atualizar agendamento: ${String((e as any)?.message || e)}`, "error");
            }
          }
        }
      },
      logToHub
    );
    s.handle = handle;
    handle.promise.catch((e) => {
      logToHub(`SenderRunner erro: ${String(e?.message || e)}`, "error");
      s.busy = false;
      s.handle = null;
      s.status.state = "idle";
      s.status.stage = "done";
      s.status.error = String(e?.message || e);
      hub.broadcast({ type: "status", payload: s.status });
    });
    return true;
  },
  pause() {
    const s = getState();
    s.handle?.pause();
    s.status.state = "paused";
    s.status.error = "";
    hub.broadcast({ type: "status", payload: s.status });
    logToHub("Pausado pelo usuário", "info");
  },
  resume() {
    const s = getState();
    s.handle?.resume();
    s.status.state = "running";
    hub.broadcast({ type: "status", payload: s.status });
    logToHub("Retomado pelo usuário", "info");
  },
  stop() {
    const s = getState();
    s.handle?.stop();
    s.status.state = "stopped";
    hub.broadcast({ type: "status", payload: s.status });
    logToHub("Parada solicitada pelo usuário", "warn");
  },
  async dispose() {
    const s = getState();
    s.handle?.stop();
    s.handle = null;
    s.busy = false;
  },
};
