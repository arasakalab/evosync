/**
 * Persistência e validação de agendamentos (scheduled_messages.json).
 * Port direto de scheduler_store.py.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { SCHEDULE_FILE } from "@/server/paths";
import type { Contact, ContactMode, Schedule, ScheduleStatus } from "@/lib/types";

const VALID_STATUSES: ScheduleStatus[] = [
  "pending",
  "running",
  "sent",
  "failed",
  "missed",
  "cancelled",
];

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Garante que a string ISO tenha o marcador de timezone (Z ou offset).
 * Strings sem timezone são interpretadas como local pelo JS, o que causa
 * deslocamento quando o servidor e o cliente estão em fusos diferentes.
 *
 * Migração retroativa: dados antigos salvos com o bug (browser e servidor
 * ambos faziam `.slice(0,19)`, somando o offset duas vezes) tinham o UTC
 * "corrompido" por 2× o offset do servidor. Aqui desfazemos subtraindo
 * 2× o offset — o resultado é o UTC original pretendido pelo usuário.
 *
 * IMPORTANTE: esta fórmula assume que o dado veio do web app bugado.
 * Dados do app Python (`datetime.now().isoformat()`) já estão em hora
 * local correta e seriam "corrigidos" incorretamente — mas como o
 * Python armazena em `scheduled_messages.json` e o web tem o seu
 * próprio, na prática não há conflito no deploy local típico.
 */
function ensureUtcIso(s: string): string {
  if (!s) return nowIso();
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return nowIso();
  // d.getTime() = epoch UTC do valor lido como local.
  // Para desfazer as DUAS somas de offset (browser+server), subtraímos 2×.
  // Em BRT (offset=180min): subtrai 6h, recuperando o UTC original.
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - 2 * offsetMs).toISOString();
}

export function newScheduleId(): string {
  return randomUUID().replace(/-/g, "");
}

function asInt(v: any, d: number): number {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : d;
}

function normalize(raw: any): Schedule {
  const status: ScheduleStatus = VALID_STATUSES.includes(raw?.status)
    ? raw.status
    : "pending";
  const contactMode: ContactMode =
    raw?.contact_mode === "current" ? "current" : "snapshot";
  const contacts: Contact[] = Array.isArray(raw?.contacts)
    ? raw.contacts
        .filter((c: any) => c && typeof c === "object")
        .map((c: any) => ({
          number: String(c.number || "").trim(),
          fields:
            c.fields && typeof c.fields === "object" ? { ...c.fields } : {},
        }))
        .filter((c: Contact) => c.number)
    : [];

  return {
    id: String(raw?.id || newScheduleId()),
    created_at: ensureUtcIso(String(raw?.created_at || nowIso())),
    updated_at: ensureUtcIso(String(raw?.updated_at || nowIso())),
    scheduled_at: ensureUtcIso(String(raw?.scheduled_at || nowIso())),
    status,
    message: String(raw?.message || ""),
    media_path: String(raw?.media_path || ""),
    media_type: String(raw?.media_type || "image"),
    delay_min: asInt(raw?.delay_min, 8),
    delay_max: asInt(raw?.delay_max, 25),
    daily_limit: asInt(raw?.daily_limit, 200),
    validate_first:
      raw?.validate_first === undefined ? true : !!raw.validate_first,
    skip_sent_history: !!raw?.skip_sent_history,
    contact_mode: contactMode,
    contacts,
    error: String(raw?.error || ""),
    summary: String(raw?.summary || ""),
  };
}

export function loadSchedules(): Schedule[] {
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf-8"));
    if (!Array.isArray(data)) return [];
    return data.map(normalize);
  } catch {
    return [];
  }
}

export function saveSchedules(schedules: Schedule[]): void {
  const payload = schedules.map(normalize);
  fs.writeFileSync(
    SCHEDULE_FILE,
    JSON.stringify(payload, null, 2),
    "utf-8"
  );
}
