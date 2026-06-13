/**
 * Persistência de agendamentos POR TENANT (SaaS Phase 4).
 *
 * Antes: scheduled_messages.json global
 * Agora: tabela `schedules` no SQLite, filtrada por tenantId.
 *
 * Mantém as funções `nowIso`, `newScheduleId`, `ensureUtcIso` (migração
 * retroativa) e `normalize` (que agora atua num row do Drizzle).
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
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

export function newScheduleId(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * Garante que a string ISO tenha o marcador de timezone (Z ou offset).
 * Ver lib/store/settings.ts para explicação completa.
 */
function ensureUtcIso(s: string): string {
  if (!s) return nowIso();
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return nowIso();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - 2 * offsetMs).toISOString();
}

function asInt(v: any, d: number): number {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : d;
}

/**
 * Converte uma row do banco (snake_case) para o tipo Schedule (camelCase).
 */
function rowToSchedule(row: typeof schema.schedules.$inferSelect): Schedule {
  return {
    id: row.id,
    tenantId: row.tenantId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    scheduled_at: row.scheduledAt,
    status: row.status,
    message: row.message,
    media_path: row.mediaPath,
    media_type: row.mediaType,
    delay_min: row.delayMin,
    delay_max: row.delayMax,
    daily_limit: row.dailyLimit,
    validate_first: row.validateFirst,
    skip_sent_history: row.skipSentHistory,
    contact_mode: row.contactMode as ContactMode,
    contacts: safeParseContacts(row.contacts),
    error: row.error,
    summary: row.summary,
  };
}

function safeParseContacts(
  raw: string | null | undefined
): Contact[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((c) => c && typeof c === "object")
        .map((c) => ({
          number: String(c.number || "").trim(),
          fields:
            c.fields && typeof c.fields === "object" ? { ...c.fields } : {},
        }))
        .filter((c) => c.number);
    }
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Lista todos os schedules do tenant, ordenados por scheduledAt asc.
 */
export function listSchedules(tenantId: string): Schedule[] {
  if (!tenantId) return [];
  const db = getDb();
  const rows = db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.tenantId, tenantId))
    .orderBy(schema.schedules.scheduledAt)
    .all();
  return rows.map(rowToSchedule);
}

/**
 * Retorna 1 schedule pelo id (escopado por tenant).
 */
export function getSchedule(
  tenantId: string,
  id: string
): Schedule | null {
  if (!tenantId || !id) return null;
  const db = getDb();
  const row = db
    .select()
    .from(schema.schedules)
    .where(
      and(eq(schema.schedules.tenantId, tenantId), eq(schema.schedules.id, id))
    )
    .all()[0];
  return row ? rowToSchedule(row) : null;
}

/**
 * Lista schedules PENDING cuja data já chegou (pra scheduler).
 * Equivalente ao `checkDue` do single-tenant.
 */
export function listDuePending(tenantId: string): Schedule[] {
  if (!tenantId) return [];
  const db = getDb();
  const now = nowIso();
  const rows = db
    .select()
    .from(schema.schedules)
    .where(
      and(
        eq(schema.schedules.tenantId, tenantId),
        eq(schema.schedules.status, "pending"),
        lte(schema.schedules.scheduledAt, now)
      )
    )
    .orderBy(schema.schedules.scheduledAt)
    .all();
  return rows.map(rowToSchedule);
}

/**
 * Cria um novo schedule.
 */
export function createSchedule(
  tenantId: string,
  data: Partial<Schedule> & { scheduled_at: string; message: string }
): Schedule {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  const db = getDb();
  const id = newScheduleId();
  const now = nowIso();

  const status: ScheduleStatus = VALID_STATUSES.includes(
    data.status as ScheduleStatus
  )
    ? (data.status as ScheduleStatus)
    : "pending";
  const contactMode: ContactMode =
    data.contact_mode === "current" ? "current" : "snapshot";

  db.insert(schema.schedules)
    .values({
      id,
      tenantId,
      scheduledAt: ensureUtcIso(data.scheduled_at),
      status,
      message: data.message || "",
      mediaPath: data.media_path || "",
      mediaType: data.media_type || "image",
      delayMin: asInt(data.delay_min, 8),
      delayMax: asInt(data.delay_max, 25),
      dailyLimit: asInt(data.daily_limit, 200),
      validateFirst:
        data.validate_first === undefined ? true : !!data.validate_first,
      skipSentHistory: !!data.skip_sent_history,
      contactMode,
      contacts: JSON.stringify(data.contacts || []),
      error: data.error || "",
      summary: data.summary || "",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getSchedule(tenantId, id)!;
}

/**
 * Atualiza um schedule existente.
 */
export function updateSchedule(
  tenantId: string,
  id: string,
  data: Partial<Schedule>
): Schedule | null {
  if (!tenantId || !id) return null;
  const db = getDb();
  const updates: Partial<typeof schema.schedules.$inferInsert> = {
    updatedAt: nowIso(),
  };
  if (data.scheduled_at !== undefined) {
    updates.scheduledAt = ensureUtcIso(data.scheduled_at);
  }
  if (data.status !== undefined && VALID_STATUSES.includes(data.status)) {
    updates.status = data.status;
  }
  if (data.message !== undefined) updates.message = data.message;
  if (data.media_path !== undefined) updates.mediaPath = data.media_path;
  if (data.media_type !== undefined) updates.mediaType = data.media_type;
  if (data.delay_min !== undefined) updates.delayMin = asInt(data.delay_min, 8);
  if (data.delay_max !== undefined) updates.delayMax = asInt(data.delay_max, 25);
  if (data.daily_limit !== undefined)
    updates.dailyLimit = asInt(data.daily_limit, 200);
  if (data.validate_first !== undefined)
    updates.validateFirst = !!data.validate_first;
  if (data.skip_sent_history !== undefined)
    updates.skipSentHistory = !!data.skip_sent_history;
  if (data.contact_mode !== undefined)
    updates.contactMode =
      data.contact_mode === "current" ? "current" : "snapshot";
  if (data.contacts !== undefined)
    updates.contacts = JSON.stringify(data.contacts);
  if (data.error !== undefined) updates.error = data.error;
  if (data.summary !== undefined) updates.summary = data.summary;

  db.update(schema.schedules)
    .set(updates)
    .where(
      and(eq(schema.schedules.tenantId, tenantId), eq(schema.schedules.id, id))
    )
    .run();

  return getSchedule(tenantId, id);
}

/**
 * Remove 1 ou mais schedules.
 */
export function removeSchedules(tenantId: string, ids: string[]): number {
  if (!tenantId || !ids.length) return 0;
  const db = getDb();
  const before = db
    .select({ id: schema.schedules.id })
    .from(schema.schedules)
    .where(
      and(
        eq(schema.schedules.tenantId, tenantId),
        inArray(schema.schedules.id, ids)
      )
    )
    .all().length;
  db.delete(schema.schedules)
    .where(
      and(
        eq(schema.schedules.tenantId, tenantId),
        inArray(schema.schedules.id, ids)
      )
    )
    .run();
  return before;
}

/**
 * Remove TODOS os schedules do tenant.
 */
export function removeAllSchedules(tenantId: string): number {
  if (!tenantId) return 0;
  const db = getDb();
  const before = db
    .select({ id: schema.schedules.id })
    .from(schema.schedules)
    .where(eq(schema.schedules.tenantId, tenantId))
    .all().length;
  db.delete(schema.schedules)
    .where(eq(schema.schedules.tenantId, tenantId))
    .run();
  return before;
}
