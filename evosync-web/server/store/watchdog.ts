/**
 * Watchdog per-tenant anti-ban (Fase B+).
 *
 * Problema: no managed central, todos os tenants compartilham IP e Evolution.
 * Se 1 cliente abusar e tomar ban (401/403), NÃO queremos que isso pause
 * o servidor inteiro — só aquele tenant específico.
 *
 * Comportamento:
 *  1. Runner detecta 401/403 (pré-validação, pre-connection ou send loop)
 *     → chama markPausedByWatchdog(tenantId, reason)
 *  2. Banco marca tenants.pausedByWatchdog = true + reason + at + count++
 *  3. Próximas tentativas de start() são recusadas
 *  4. Scheduler pula tenants pausados
 *  5. Admin vê badge "Pausado pelo watchdog" no /admin/tenants
 *  6. Admin clica "Limpar watchdog" → clearWatchdogPause(tenantId)
 *
 * Auditoria:
 *  - "tenant.watchdog_paused" — quando pausa
 *  - "tenant.watchdog_cleared" — quando admin limpa
 */
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { logAudit } from "@/server/store/audit";
import { logger } from "@/lib/logger";

/**
 * Marca o tenant como pausado pelo watchdog. Idempotente — se já está
 * pausado, apenas atualiza o reason (e mantém o pausedAt original? Não —
 * atualiza tudo por simplicidade).
 *
 * @returns true se o tenant foi pausado agora; false se já estava pausado
 *   (sem mudança efetiva no contador) ou se tenant não existe.
 */
export function markPausedByWatchdog(
  tenantId: string,
  reason: string
): { changed: boolean; tenantId: string } {
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .all()[0];
  if (!tenant) {
    logger.warn({ tenantId }, "markPausedByWatchdog: tenant não existe");
    return { changed: false, tenantId };
  }
  if (tenant.pausedByWatchdog) {
    // Já estava pausado — só atualiza o reason (sem incrementar count)
    db.update(schema.tenants)
      .set({
        pausedReason: reason,
        pausedAt: new Date().toISOString(),
      })
      .where(eq(schema.tenants.id, tenantId))
      .run();
    logAudit({
      tenantId,
      action: "tenant.watchdog_paused",
      details: { reason, alreadyPaused: true },
    });
    return { changed: false, tenantId };
  }
  db.update(schema.tenants)
    .set({
      pausedByWatchdog: true,
      pausedReason: reason,
      pausedAt: new Date().toISOString(),
      pausedCount: (tenant.pausedCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenantId))
    .run();
  logAudit({
    tenantId,
    action: "tenant.watchdog_paused",
    details: { reason, newPause: true, count: (tenant.pausedCount ?? 0) + 1 },
  });
  logger.warn(
    { tenantId, reason, count: (tenant.pausedCount ?? 0) + 1 },
    "Tenant pausado pelo watchdog"
  );
  return { changed: true, tenantId };
}

/**
 * Limpa a pausa do watchdog. Chamado pelo admin via endpoint.
 * Mantém o pausedCount (histórico).
 */
export function clearWatchdogPause(
  tenantId: string,
  actorUserId: string | null,
  note?: string
): { cleared: boolean; wasPaused: boolean } {
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .all()[0];
  if (!tenant) return { cleared: false, wasPaused: false };
  if (!tenant.pausedByWatchdog) {
    return { cleared: false, wasPaused: false };
  }
  db.update(schema.tenants)
    .set({
      pausedByWatchdog: false,
      pausedReason: null,
      pausedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenantId))
    .run();
  logAudit({
    tenantId,
    userId: actorUserId,
    action: "tenant.watchdog_cleared",
    details: {
      previousReason: tenant.pausedReason,
      previousPausedAt: tenant.pausedAt,
      totalPauses: tenant.pausedCount,
      note: note || "",
    },
  });
  logger.info(
    { tenantId, actorUserId, totalPauses: tenant.pausedCount },
    "Pausa do watchdog liberada"
  );
  return { cleared: true, wasPaused: true };
}

/**
 * Checagem rápida se o tenant pode enviar. Retorna null se pode, ou
 * { paused: true, reason } se está bloqueado.
 */
export function checkWatchdogPause(
  tenantId: string
): { paused: true; reason: string; at: string | null } | null {
  const db = getDb();
  const tenant = db
    .select({
      pausedByWatchdog: schema.tenants.pausedByWatchdog,
      pausedReason: schema.tenants.pausedReason,
      pausedAt: schema.tenants.pausedAt,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .all()[0];
  if (!tenant) return null;
  if (!tenant.pausedByWatchdog) return null;
  return {
    paused: true,
    reason: tenant.pausedReason || "Pausado pelo watchdog",
    at: tenant.pausedAt,
  };
}

/**
 * Lista todos os tenants pausados pelo watchdog (para o admin).
 */
export function listPausedTenants(): Array<{
  id: string;
  name: string;
  slug: string;
  status: string;
  pausedReason: string | null;
  pausedAt: string | null;
  pausedCount: number;
  evoMode: string;
}> {
  const db = getDb();
  return db
    .select({
      id: schema.tenants.id,
      name: schema.tenants.name,
      slug: schema.tenants.slug,
      status: schema.tenants.status,
      pausedReason: schema.tenants.pausedReason,
      pausedAt: schema.tenants.pausedAt,
      pausedCount: schema.tenants.pausedCount,
      evoMode: schema.tenants.evoMode,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.pausedByWatchdog, true))
    .orderBy(desc(schema.tenants.pausedAt))
    .all() as any;
}
