/**
 * Logger estruturado (pino). Singleton.
 *
 * Em produção: logs JSON em stdout, capturados por journald (systemd).
 * Em dev: human-readable, mas só se stdout for TTY (e.g. rodando local).
 *
 * Níveis (configurável via LOG_LEVEL env):
 *   - trace: muito verboso (não usar em prod)
 *   - debug: debugging
 *   - info: eventos normais (startup, requests, ações do usuário)
 *   - warn: algo inesperado mas recuperável
 *   - error: falha
 *   - fatal: crash iminente
 *
 * IMPORTANTE: NÃO usar `transport: pino-pretty` aqui. O `thread-stream` que
 * ele usa depende de um worker file que o Next.js webpack não consegue
 * empacotar corretamente, gerando uncaughtException que mata o processo.
 * Use JSON puro em dev também — é menos bonito mas estável.
 */
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL || (isDev ? "debug" : "info");

export const logger = pino({
  level,
  // JSON puro sempre (sem transport). Estável, parseável, journald-friendly.
  base: {
    app: "evosync",
    env: process.env.NODE_ENV || "development",
  },
  // Redige campos sensíveis
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "ENCRYPTION_KEY",
      "AUTH_SECRET",
      "EVO_APIKEY",
      "apiKey",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Helper pra criar child loggers com contexto fixo.
 * Ex: const log = logger.child({ module: "sender" });
 */
export function childLogger(bindings: Record<string, any>) {
  return logger.child(bindings);
}
