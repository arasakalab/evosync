/**
 * SenderRunner — executa o ciclo de envio de mensagens no MESMO processo
 * (sem worker_threads). Usa AbortSignal + flags para pause/stop.
 *
 * É a versão assíncrona direta do `SenderWorker` Python, com cancelamento
 * cooperativo (checado em cada await).
 *
 * Comportamento:
 *  - Pré-valida números em lote de 50 (se validateFirst)
 *  - Envia texto/mídia com delay aleatório entre contatos
 *  - Warm-up: primeiros 50 envios usam delay 2x maior
 *  - Persiste sent_log.json imediatamente após cada envio
 *  - Reporta status via callback (e o manager propaga via WS)
 */

import { EvoClient, normalizeNumberLocal } from "@/server/evo/client";
import { loadSentLog, markSent } from "@/server/store/sent-log";
import { markPausedByWatchdog } from "@/server/store/watchdog";
import { logger } from "@/lib/logger";
import type { Contact, SendStatus } from "@/lib/types";

export interface StartArgs {
  /**
   * SaaS Phase 4: tenantId é OBRIGATÓRIO. O sender usa pra:
   *  - Carregar sent_log do tenant
   *  - Persistir cada envio no sent_log do tenant
   *  - Validação adicional (futuro: rate limit por tenant)
   */
  tenantId: string;
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
}

export interface RunHandle {
  promise: Promise<void>;
  signal: AbortSignal;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

function defaultStatus(total: number): SendStatus {
  return {
    state: "idle",
    total,
    sent: 0,
    failed: 0,
    pending: total,
    skipped: 0,
    no_whatsapp: 0,
    invalid: 0,
    opt_out: 0,
    current_number: "",
    current_index: 0,
    last_message: "",
    error: "",
    stage: "",
    limit_reached: false,
  };
}

function delaySeconds(sentInSession: number, min: number, max: number): number {
  const isWarmup = sentInSession < 50;
  const lo = isWarmup ? min * 2 : min;
  const hi = isWarmup ? max * 2 : max;
  return lo + Math.random() * (hi - lo);
}

function renderTemplate(contact: Contact, template: string): string {
  let out = template;
  for (const [k, v] of Object.entries(contact.fields || {})) {
    out = out.replaceAll("{" + k + "}", String(v));
  }
  return out;
}

/**
 * Helper: detecta se uma mensagem de erro indica 401/403 (auth/ban).
 * Usado em todos os pontos do runner pra acionar o watchdog.
 */
function isAuthError(msg: string): boolean {
  return msg.includes("401") || msg.includes("403");
}

/**
 * Aciona o watchdog per-tenant. Best-effort: erros aqui NÃO devem
 * quebrar o fluxo principal do runner.
 */
function triggerWatchdog(
  tenantId: string,
  reason: string,
  onLog: (line: string, level: "info" | "ok" | "warn" | "error") => void
): void {
  try {
    const r = markPausedByWatchdog(tenantId, reason);
    onLog(
      `🛑 Watchdog: tenant pausado${r.changed ? " (novo)" : " (já estava)"} — ${reason}`,
      "error"
    );
  } catch (e: any) {
    logger.error({ err: e, tenantId }, "Falha ao acionar watchdog");
    onLog(`⚠ Falha ao acionar watchdog: ${e?.message || e}`, "error");
  }
}

/**
 * Dorme `ms` milissegundos respeitando pause/stop.
 * - Se stopSignal for acionado, retorna true (stop solicitado).
 * - Se pauseSignal for acionado, espera liberar (ou stop).
 * - Retorna false se dormiu o tempo todo.
 */
async function sleepInterruptible(
  ms: number,
  abortSignal: AbortSignal,
  pauseFlag: () => boolean
): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, ms);
  while (Date.now() < deadline) {
    if (abortSignal.aborted) return true;
    if (pauseFlag()) {
      // Espera liberar (ou stop)
      await new Promise<void>((resolve) => {
        const onAbort = () => {
          abortSignal.removeEventListener("abort", onAbort);
          resolve();
        };
        abortSignal.addEventListener("abort", onAbort, { once: true });
        // Poll leve para checar pause
        const i = setInterval(() => {
          if (!pauseFlag() || abortSignal.aborted) {
            clearInterval(i);
            abortSignal.removeEventListener("abort", onAbort);
            resolve();
          }
        }, 200);
      });
      if (abortSignal.aborted) return true;
    }
    const remaining = deadline - Date.now();
    const slice = Math.min(500, Math.max(50, remaining));
    await new Promise((r) => setTimeout(r, slice));
  }
  return abortSignal.aborted;
}

export function startRunner(
  args: StartArgs,
  onStatus: (s: SendStatus) => void,
  onLog: (line: string, level: "info" | "ok" | "warn" | "error") => void
): RunHandle {
  const abortCtl = new AbortController();
  let pauseFlag = false;

  const handle: RunHandle = {
    promise: Promise.resolve(),
    signal: abortCtl.signal,
    pause: () => {
      pauseFlag = true;
    },
    resume: () => {
      pauseFlag = false;
    },
    stop: () => {
      pauseFlag = false;
      abortCtl.abort();
    },
  };

  handle.promise = (async () => {
    const client = new EvoClient(args.url, args.apiKey, args.instance);
    const sentLog = new Set<string>(loadSentLog(args.tenantId));
    const status = defaultStatus(args.contacts.length);
    let sentInSession = 0;

    status.state = "running";
    status.error = "";
    onStatus(status);
    onLog(
      `Iniciando envio: ${args.contacts.length} contatos, delay ${args.delayMin}-${args.delayMax}s, limite ${args.dailyLimit}/dia`,
      "info"
    );

    try {
      const invalid = new Set<string>();

      if (args.validateFirst) {
        status.stage = "prevalidating";
        onStatus(status);
        onLog("… validando números no WhatsApp (em lote)…", "info");
        const seen = new Set<string>();
        const toValidate: string[] = [];
        for (const c of args.contacts) {
          const n = normalizeNumberLocal(c.number);
          if (!n) continue;
          if (seen.has(n)) continue;
          seen.add(n);
          toValidate.push(n);
        }
        for (let i = 0; i < toValidate.length; i += 50) {
          if (abortCtl.signal.aborted) break;
          if (pauseFlag) {
            await new Promise((r) => setTimeout(r, 200));
            if (abortCtl.signal.aborted) break;
          }
          const batch = toValidate.slice(i, i + 50);
          const { data, err } = await client.checkWhatsapp(batch);
          if (data === null) {
            status.error = `Falha na validação prévia: ${err}`;
            onStatus(status);
            onLog(`⚠ ${err}`, "warn");
            const fatal =
              err.includes("instance does not exist") ||
              err.includes("404") ||
              isAuthError(err);
            if (fatal) {
              // Watchdog: pausa SÓ este tenant, não afeta outros
              if (isAuthError(err)) {
                triggerWatchdog(
                  args.tenantId,
                  `Auth/ban na validação prévia: ${err.slice(0, 200)}`,
                  onLog
                );
              }
              status.pending = 0;
              abortCtl.abort();
              return;
            }
            break;
          }
          for (const d of data) {
            const num = String(d.number || "").replace(/^\+/, "");
            if (!d.exists) invalid.add(num);
          }
        }
        if (invalid.size) {
          const preview = Array.from(invalid).slice(0, 5).sort().join(", ");
          const suffix = invalid.size > 5 ? "..." : "";
          status.error = `${invalid.size} número(s) sem WhatsApp: ${preview}${suffix}`;
          onStatus(status);
        }
        status.stage = "prevalidated";
        onStatus(status);
      }

      // Pré-checagem da instância WhatsApp (uma vez antes do loop).
      // Se não estiver "open", tenta reconectar/esperar algumas vezes
      // antes de abortar o envio inteiro. Evita perder 1 round de delay
      // por contato quando a instância está close.
      status.stage = "connecting";
      onStatus(status);
      onLog("... verificando estado da instância WhatsApp", "info");
      {
        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 15_000;
        let instState: string | null = null;
        let instErr = "";
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (abortCtl.signal.aborted) break;
          const r = await client.connectionState();
          instState = r.state;
          instErr = r.err;
          if (
            instState &&
            ["open", "connected", "online"].includes(
              String(instState).toLowerCase()
            )
          ) {
            onLog(`✓ instância ${instState} (tentativa ${attempt})`, "ok");
            break;
          }
          // Erros fatais: aborta imediatamente
          if (instState === null && instErr) {
            if (
              instErr.includes("instance does not exist") ||
              instErr.includes("404") ||
              isAuthError(instErr)
            ) {
              // Watchdog: pausa SÓ este tenant
              if (isAuthError(instErr)) {
                triggerWatchdog(
                  args.tenantId,
                  `Auth/ban no pre-connection: ${instErr.slice(0, 200)}`,
                  onLog
                );
              }
              status.error = `Instância indisponível: ${instErr}. Abortando envio.`;
              onStatus(status);
              onLog(`!! ${status.error}`, "error");
              status.pending = 0;
              abortCtl.abort();
              break;
            }
          }
          if (attempt < MAX_RETRIES) {
            onLog(
              `… instância ${instState ?? "?"} ainda não está open; aguardando ${RETRY_DELAY_MS / 1000}s (${attempt}/${MAX_RETRIES})`,
              "warn"
            );
            if (
              await sleepInterruptible(RETRY_DELAY_MS, abortCtl.signal, () => pauseFlag)
            ) {
              break;
            }
          }
        }
        if (!abortCtl.signal.aborted) {
          const ok = instState &&
            ["open", "connected", "online"].includes(
              String(instState).toLowerCase()
            );
          if (!ok) {
            status.error = `Instância ${instState ?? "?"} não ficou open após ${MAX_RETRIES} tentativas. Abortando envio.`;
            onStatus(status);
            onLog(`!! ${status.error}`, "error");
            status.pending = 0;
            abortCtl.abort();
          }
        }
      }

      for (let idx = 0; idx < args.contacts.length; idx++) {
        if (abortCtl.signal.aborted) break;
        const c = args.contacts[idx];
        status.current_index = idx + 1;

        // FASE 4 (ADR-001): checa opt-out ANTES de validar/enviar.
        // LGPD/anti-ban: contato com opt_out=true nunca é contactado.
        if (c.opt_out) {
          status.current_number = String(c.number);
          status.error = "";
          status.stage = "opt_out";
          status.skipped += 1;
          status.opt_out += 1;
          status.pending = Math.max(0, status.pending - 1);
          onStatus(status);
          onLog(`-- ${c.number} pulado (opt-out)`, "info");
          continue;
        }

        const number = normalizeNumberLocal(c.number);
        if (!number) {
          status.current_number = String(c.number);
          status.error = `numero invalido: ${c.number}`;
          status.stage = "validating";
          status.failed += 1;
          status.invalid += 1;
          status.pending = Math.max(0, status.pending - 1);
          onStatus(status);
          onLog(`✗ ${c.number} número inválido`, "warn");
          continue;
        }
        status.current_number = number;

        if (invalid.has(number)) {
          status.error = `${number} não tem WhatsApp — pulando`;
          status.stage = "no_whatsapp";
          status.failed += 1;
          status.no_whatsapp += 1;
          status.pending = Math.max(0, status.pending - 1);
          onStatus(status);
          onLog(`✗ ${number} não tem WhatsApp — pulando`, "warn");
          continue;
        }

        if (args.skipSentHistory && sentLog.has(number)) {
          status.error = "";
          status.stage = "skip";
          status.skipped += 1;
          status.pending = Math.max(0, status.pending - 1);
          onStatus(status);
          onLog(`-- ${number} pulado (já enviado antes)`, "info");
          continue;
        }

        if (sentInSession >= args.dailyLimit) {
          status.error = "Limite diário atingido";
          status.stage = "limit";
          status.limit_reached = true;
          onStatus(status);
          onLog(`!! Limite diário atingido (${args.dailyLimit})`, "warn");
          break;
        }

        // Aguarda pause (sem abort)
        if (pauseFlag) {
          while (pauseFlag && !abortCtl.signal.aborted) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (abortCtl.signal.aborted) break;
        }

        // checa conexão (instância já validada antes do loop;
        // se chegar aqui, podemos enviar)
        status.stage = "connecting";
        status.last_message = renderTemplate(c, args.template).slice(0, 120);
        onStatus(status);
        onLog(`... enviando para ${number}`, "info");

        // envia
        status.stage = "sending";
        status.error = "";
        onStatus(status);
        const text = renderTemplate(c, args.template);
        const sendResult = args.mediaPath
          ? await client.sendMedia(number, args.mediaPath, text, args.mediatype)
          : await client.sendText(number, text);

        if (sendResult.ok) {
          status.sent += 1;
          sentLog.add(number);
          // Persiste incrementalmente (1 INSERT) em vez de regravar tudo
          markSent(args.tenantId, number);
          sentInSession += 1;
          status.error = "";
          status.pending = Math.max(0, status.pending - 1);
          status.stage = "sent";
          onStatus(status);
          onLog(`✓ ${number} enviado (aceito pela API)`, "ok");
        } else {
          status.failed += 1;
          if (isAuthError(sendResult.msg)) {
            status.stage = "auth";
            status.error = "Auth/ban — verifique a conta";
            onStatus(status);
            onLog(`!! Auth/ban — verifique a conta`, "error");
            // Watchdog: pausa SÓ este tenant. Outros tenants
            // continuam podendo enviar normalmente.
            triggerWatchdog(
              args.tenantId,
              `Auth/ban no envio (após ${sentInSession} envios): ${sendResult.msg.slice(0, 200)}`,
              onLog
            );
            break;
          }
          status.error = sendResult.msg;
          onStatus(status);
          onLog(`!! Falha: ${sendResult.msg}`, "error");
          if (await sleepInterruptible(5_000, abortCtl.signal, () => pauseFlag)) break;
          continue;
        }

        if (abortCtl.signal.aborted) break;
        const isLast = idx === args.contacts.length - 1;
        if (isLast || status.pending === 0) break;

        const d = delaySeconds(sentInSession, args.delayMin, args.delayMax);
        status.stage = `waiting ${Math.round(d)}s`;
        status.error = "";
        onStatus(status);
        onLog(`   aguardando ${Math.round(d)}s antes do próximo…`, "info");
        if (await sleepInterruptible(d * 1000, abortCtl.signal, () => pauseFlag)) break;
      }
    } catch (e: any) {
      status.error = String(e?.message || e);
      onStatus(status);
      onLog(`!! Erro: ${status.error}`, "error");
    } finally {
      if (!abortCtl.signal.aborted) status.state = "idle";
      else status.state = "stopped";
      status.current_number = "";
      status.stage = "done";
      onStatus(status);
    }
  })();

  return handle;
}
