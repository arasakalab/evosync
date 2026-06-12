import { getDb, schema } from "@/lib/db";
import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import crypto from "crypto";

export interface AuditEntry {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  details: string;
  createdAt: string;
}

export interface LogAuditArgs {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  details?: Record<string, any>;
}

/**
 * Registra uma entrada no audit log. Best-effort: erros são silenciados
 * (audit nunca deve bloquear a operação principal). O caller pode passar
 * `details` como objeto — será serializado como JSON.
 */
export function logAudit(args: LogAuditArgs): void {
  try {
    const db = getDb();
    db.insert(schema.auditLog)
      .values({
        id: "aud-" + crypto.randomBytes(10).toString("hex"),
        tenantId: args.tenantId ?? null,
        userId: args.userId ?? null,
        action: args.action,
        details: args.details ? JSON.stringify(args.details) : "{}",
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (e) {
    // Best-effort: nunca propaga erro
    // eslint-disable-next-line no-console
    console.error("[audit] falha ao registrar:", args.action, e);
  }
}

export interface ListAuditOpts {
  tenantId?: string;
  userId?: string;
  action?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
  offset?: number;
}

export function listAudit(opts: ListAuditOpts = {}): {
  entries: AuditEntry[];
  total: number;
} {
  const db = getDb();
  const where: any[] = [];
  if (opts.tenantId) where.push(eq(schema.auditLog.tenantId, opts.tenantId));
  if (opts.userId) where.push(eq(schema.auditLog.userId, opts.userId));
  if (opts.action) where.push(eq(schema.auditLog.action, opts.action));
  if (opts.from) where.push(gte(schema.auditLog.createdAt, opts.from));
  if (opts.to) where.push(lte(schema.auditLog.createdAt, opts.to));

  const limit = Math.min(opts.limit ?? 50, 500);
  const offset = opts.offset ?? 0;

  let q = db.select().from(schema.auditLog);
  if (where.length === 1) q = q.where(where[0]) as typeof q;
  else if (where.length > 1) q = q.where(and(...where)) as typeof q;

  const rows = q
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  // Count total (sem limit/offset)
  let cq = db.select({ c: sql<number>`count(*)` }).from(schema.auditLog);
  if (where.length === 1) cq = cq.where(where[0]) as typeof cq;
  else if (where.length > 1) cq = cq.where(and(...where)) as typeof cq;
  const total = cq.get()?.c ?? 0;

  return {
    entries: rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      userId: r.userId,
      action: r.action,
      details: r.details,
      createdAt: r.createdAt,
    })),
    total,
  };
}

/**
 * Lista as ações distintas (pra popular dropdown de filtros).
 */
export function listAuditActions(): string[] {
  const db = getDb();
  const rows = db
    .selectDistinct({ action: schema.auditLog.action })
    .from(schema.auditLog)
    .orderBy(schema.auditLog.action)
    .all();
  return rows.map((r) => r.action);
}
