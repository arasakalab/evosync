/**
 * Persistência do sent_log POR TENANT (SaaS Phase 4).
 *
 * Antes: sent_log.json global (array de strings)
 * Agora: tabela `sent_log` (PK composta tenant_id + number) no SQLite.
 */
import { and, eq, count } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/**
 * Retorna o set de números já enviados pelo tenant.
 * Equivalente a `loadSentLog()` do single-tenant.
 */
export function loadSentLog(tenantId: string): Set<string> {
  if (!tenantId) return new Set();
  const db = getDb();
  const rows = db
    .select({ number: schema.sentLog.number })
    .from(schema.sentLog)
    .where(eq(schema.sentLog.tenantId, tenantId))
    .all();
  return new Set(rows.map((r) => r.number));
}

/**
 * Marca um número como enviado pelo tenant (upsert).
 * Equivalente a `saveSentLog(set.add(number))` do single-tenant.
 */
export function markSent(tenantId: string, number: string): void {
  if (!tenantId) return;
  const db = getDb();
  // INSERT OR REPLACE
  db.insert(schema.sentLog)
    .values({
      tenantId,
      number,
      sentAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [schema.sentLog.tenantId, schema.sentLog.number],
      set: { sentAt: new Date().toISOString() },
    })
    .run();
}

/**
 * Conta quantos números o tenant já enviou.
 */
export function sentLogCount(tenantId: string): number {
  if (!tenantId) return 0;
  const db = getDb();
  const result = db
    .select({ value: count() })
    .from(schema.sentLog)
    .where(eq(schema.sentLog.tenantId, tenantId))
    .all()[0];
  return result?.value ?? 0;
}

/**
 * Reseta (deleta) todo o histórico de envios do tenant.
 * Retorna quantos registros foram removidos.
 */
export function resetSentLog(tenantId: string): number {
  if (!tenantId) return 0;
  const before = sentLogCount(tenantId);
  const db = getDb();
  db.delete(schema.sentLog)
    .where(eq(schema.sentLog.tenantId, tenantId))
    .run();
  return before;
}

/**
 * Compat: aceita Set (interface do single-tenant) e persiste tudo.
 * Usado pelo sender worker durante o envio.
 */
export function saveSentLogSet(tenantId: string, set: Set<string>): void {
  if (!tenantId) return;
  const db = getDb();
  const now = new Date().toISOString();
  // Performance: para Sets grandes, isso é O(n) inserts.
  // O sender adiciona 1 a 1, então na prática é ok.
  for (const number of set) {
    db.insert(schema.sentLog)
      .values({ tenantId, number, sentAt: now })
      .onConflictDoUpdate({
        target: [schema.sentLog.tenantId, schema.sentLog.number],
        set: { sentAt: now },
      })
      .run();
  }
}
