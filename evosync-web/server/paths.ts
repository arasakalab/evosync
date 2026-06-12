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
