/**
 * Diretório de dados do app. Espelha os arquivos que o app Python já usa.
 * Aqui fica .env, config.json, persisted_contacts.json, scheduled_messages.json,
 * sent_log.json, send_run.log, e uploads/ para mídias.
 */
import path from "node:path";

const isDev = process.env.NODE_ENV !== "production";

export const APP_DIR = isDev
  ? path.resolve(process.cwd())
  : path.resolve(process.cwd());

export const DATA_DIR = APP_DIR;

export const ENV_FILE = path.join(DATA_DIR, ".env");
export const SETTINGS_FILE = path.join(DATA_DIR, "config.json");
export const CONTACTS_FILE = path.join(DATA_DIR, "persisted_contacts.json");
export const SCHEDULE_FILE = path.join(DATA_DIR, "scheduled_messages.json");
export const SENT_LOG = path.join(DATA_DIR, "sent_log.json");
export const LOG_FILE = path.join(DATA_DIR, "send_run.log");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export const DEFAULT_EVO_URL = "http://localhost:8080";

// =============================================================================
// Managed central (Fase B) — URL e API key da Evolution API centralizada que
// serve múltiplos tenants via /instance/create. Lidas do .env do app e usadas
// pelo provision/QR endpoints. Nunca expostas ao cliente.
// =============================================================================

/**
 * URL base da Evolution central. Default: atrás do nginx no mesmo VPS
 * (path /evo/ proxy_pass para 127.0.0.1:8080).
 */
export const CENTRAL_EVO_URL =
  process.env.EVOLUTION_CENTRAL_URL?.trim() || "";

/**
 * API key da Evolution central. OBRIGATÓRIA em produção managed. Sem ela,
 * as operações de provision/connect/delete falham com erro explícito.
 */
export const CENTRAL_EVO_APIKEY =
  process.env.EVOLUTION_CENTRAL_APIKEY?.trim() || "";

/**
 * Indica se o modo managed está habilitado no ambiente. Quando true, o admin
 * pode criar tenants com evo_mode="managed" e o backend chamará a Evolution
 * central automaticamente. Quando false (default dev), só permite "byo".
 */
export const CENTRAL_EVO_ENABLED =
  Boolean(CENTRAL_EVO_URL) && Boolean(CENTRAL_EVO_APIKEY);

/**
 * Constrói um EvoClient apontando para a Evolution central. Use isso em
 * todas as rotas de provision/QR/connect/delete de instâncias managed.
 *
 * @throws se CENTRAL_EVO_ENABLED for false (variáveis de env não configuradas)
 */
export function getCentralEvoClient(): import("./evo/client").EvoClient {
  if (!CENTRAL_EVO_ENABLED) {
    throw new Error(
      "Modo managed não configurado. Defina EVOLUTION_CENTRAL_URL e " +
        "EVOLUTION_CENTRAL_APIKEY no .env do app."
    );
  }
  // Import tardio para evitar ciclo em tempo de carregamento.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EvoClient } = require("./evo/client") as typeof import("./evo/client");
  return new EvoClient(CENTRAL_EVO_URL, CENTRAL_EVO_APIKEY, "__central__");
}
